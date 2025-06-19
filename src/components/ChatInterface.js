import React, { useState, useRef, useEffect } from "react";
import { Button, Container, Typography, Box, Paper, TextField, IconButton, Tooltip } from "@mui/material";
import { Person as UserIcon } from "@mui/icons-material";
import "@fontsource/roboto";
import ReactMarkdown from "react-markdown";
import { debounce } from "lodash";
import TransitionAnimation from "./TransitionAnimation";
import PreparingAnimation from "./PreparingAnimation"; // Adjust the import path as needed

const BIG3_EXPERIENCE_NAME = "Big 3 Weekly Check-In";
const QTRPLAN_EXPERIENCE_NAME = "Quarterly Planning"
const ASK_EXPERIENCE_NAME = "Ask Factor Mind"
const INTEL_EXPERIENCE_NAME = "Intel Report"
const QTRUPDATE_EXPERIENCE_NAME = "Quarterly Planning Update"
const CHALLENGE_EXPERIENCE_NAME = "Challenge Factor Mind"

// Fetch experiences from the Lambda function
const fetchExperiences = async (allowedExperiences, manualOverrides) => {
  try {
    const response = await fetch(
      "https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/experiences"
    );
    const data = await response.json();

    if (!data.success || !data.experiences) {
      throw new Error("Invalid response format: missing 'success' or 'experiences'");
    }

    // Filter experiences based on allowedExperiences
    const filteredExperiences = data.experiences.filter((experience) =>
      allowedExperiences.includes(experience.experience_name)
    );

    // Add lock status and reason based on manual_overrides
    const experiencesWithLocks = filteredExperiences.map((experience) => {
      const lockedExperience = manualOverrides?.locked_experiences?.[experience.experience_name];

      // Determine if the experience is locked based on its type and completion status
      let isLocked = false;
      let lockReason = "";

      if (lockedExperience) {
        if (experience.experience_name.endsWith("Update")) {
          // For {Role} Update: Lock if "completed" is false, unlock if "completed" is true
          isLocked = lockedExperience.completed === false;
          lockReason = isLocked ? lockedExperience.reason : "";
        } else if (experience.experience_name.endsWith("Interview") || experience.experience_name.endsWith("Planning")) {
          // For {Role} Interview: Lock if "completed" is true, unlock if "completed" is false
          isLocked = lockedExperience.completed === true;
          lockReason = isLocked ? lockedExperience.reason : "";
        } else {
          // Default behavior for other experiences: Lock if "completed" is false
          isLocked = lockedExperience.completed === false;
          lockReason = isLocked ? lockedExperience.reason : "";
        }
      }

      return {
        ...experience,
        isLocked, // True if the experience is locked and not completed
        lockReason, // Reason for the lock (if applicable)
      };
    });

    return experiencesWithLocks;
  } catch (error) {
    console.error("Error fetching experiences:", error);
    throw error;
  }
};

// Transform fetched experiences into the required format
const transformExperiences = (experiences) => {
  return experiences.reduce((acc, experience) => {
    acc[experience.experience_name.toLowerCase().replace(/\s+/g, "")] = {
      label: experience.experience_name,
      introText: experience.description,
      prompt: experience.ai_prompt,
      isLocked: experience.isLocked, // Include lock status
      lockReason: experience.lockReason, // Include lock reason
    };
    return acc;
  }, {});
};

const callOpenAIProxy = async (messages, maxTokens = 1000) => {
  try {
    const response = await fetch(
      "https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/ai",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages, // Pass the chat messages
          max_tokens: maxTokens, // Optional: Pass max_tokens
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error calling OpenAI proxy:", error);
    throw error;
  }
};

const queryPineconeForRoleInterviews = async (userEmail, roleType) => {
  try {
    const response = await fetch(
      "https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/vectors",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "search",
          query_text: roleType,
          filter: {
            user_email: userEmail,
            experience_type: [`${roleType}interview`, `${roleType}update`], // Pass as an array
          },
          include_metadata: true,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Error querying Pinecone: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.matches; // Extract the "matches" array from the response
  } catch (error) {
    console.error("Error querying Pinecone:", error);
    throw error;
  }
};

const queryPineconeForQuarterlyPlanning = async (userEmail, expType) => {
  try {
    const response = await fetch(
      "https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/vectors",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "search",
          query_text: expType,
          filter: {
            user_email: userEmail,
            experience_type: ["quarterlyplanning", "quarterlyplanningupdate"], // Pass as an array
          },
          include_metadata: true,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Error querying Pinecone: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.matches; // Extract the "matches" array from the response
  } catch (error) {
    console.error("Error querying Pinecone:", error);
    throw error;
  }
};

const queryPineconeForInsights = async (userEmail, experienceType, excludeIds = []) => {
  try {
    const response = await fetch(
      "https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/vectors",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "search",
          query_text: experienceType, // Use experience type as the query text
          experience_type: experienceType, // Use experience type to route the filters in Lambda correctly
          include_metadata: true, // Include metadata for filtering
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Error querying Pinecone: ${response.statusText}`);
    }

    const data = await response.json();

    // 🔹 **Filter out previously used insights manually**
    const filteredResults = data.data.matches.filter(
      (match) => !excludeIds.includes(match.id) // Exclude if the ID is in excludeIds
    );

    return filteredResults;
  } catch (error) {
    console.error("Error querying Pinecone:", error);
    throw error;
  }
};

const fetchRoles = async (userEmail, experienceName) => {
  try {
    const response = await fetch(
      `https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/roles?user_email=${encodeURIComponent(userEmail)}&experience_name=${encodeURIComponent(experienceName)}`
    );
    const data = await response.json();

    if (!data.success || !data.dynamicContext) {
      throw new Error("Invalid response format: missing 'success' or 'dynamicContext'");
    }

    return data.dynamicContext;
  } catch (error) {
    console.error("Error fetching roles:", error);
    throw error;
  }
};

const fetchBig3Entries = async (userEmail, weekStart = null) => {
  try {
    // Construct the URL with optional week_start query parameter
    let url = `https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/big3?user_email=${encodeURIComponent(userEmail)}`;

    if (weekStart) {
      url += `&week_start=${encodeURIComponent(weekStart)}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Error fetching Big 3 entries: ${response.statusText}`);
    }

    const data = await response.json();
    return data.entries;
  } catch (error) {
    console.error("Error fetching Big 3 entries:", error);
    throw error;
  }
};

const fetchKeyInsights = async (sessionId) => {
  try {
    const response = await fetch(
      `https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/sessions/${sessionId}/messages?is_key_insight=true`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Error fetching key insights: ${response.statusText}`);
    }

    const data = await response.json();
    return data.messages;
  } catch (error) {
    console.error("Error fetching key insights:", error);
    throw error;
  }
};

const saveBig3Entry = async (sessionId, summaries, userEmail, weekStart) => {
  const payload = {
    session_id: sessionId,
    user_email: userEmail, // Add user_email
    week_start: weekStart, // Add week_start
    last_weeks_big3_summary: summaries.last_weeks_big3_summary || "No Big 3 submission last week.",
    this_weeks_big3_summary: summaries.this_weeks_big3_summary || "No Big 3 submitted yet.",
  };

  //console.log("Saving Big 3 Entry with Payload:", payload);

  try {
    const response = await fetch("https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/big3", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.REACT_APP_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("API Error Response:", errorData);
      throw new Error(`API Error: ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    if (data.success) {
      //console.log("✅ Big 3 entry saved successfully.");
    } else {
      console.error("❌ Error saving Big 3 entry:", data.error);
    }
  } catch (error) {
    console.error("❌ Error saving Big 3 entry:", error);
    throw error; // Re-throw the error to propagate it
  }
};

// Helper function to check if a message contains a summary confirmation
const isSummaryConfirmationMessage = (message) => {
  // Check if the message contains key phrases indicating a summary confirmation
  const confirmationPhrases = [
    /summary of insights/i,
    /key takeaways/i,
    /opportunities\/risks/i,
    /actionable steps/i,
  ];

  return confirmationPhrases.some((phrase) => phrase.test(message));
};

const checkAndEnableCompleteButton = (aiResponse, selectedExperience, setIsSummaryGenerated) => {
  const isBig3Experience = selectedExperience === BIG3_EXPERIENCE_NAME.toLowerCase().replace(/\s+/g, "");
  if (isBig3Experience && /This Week['’]s Big 3/i.test(aiResponse)) {
    setIsSummaryGenerated(true); // Enable the "Complete" button
    //console.log("✅ Complete button enabled.");
  }
};

const generateSummary = async (keyInsights) => {
  try {
    const combinedText = keyInsights.map((msg) => `${msg.sender === "user" ? "You:" : "Factor Mind:"} ${msg.message_text}`).join("\n");

    const data = await callOpenAIProxy(combinedText);
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error generating summary:", error);
    throw error;
  }
};

const storeSummary = async (sessionId, summaryText) => {
  try {
    const response = await fetch(
      "https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/summaries",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          summary_text: summaryText,
          summary_type: "key_insight_summary",
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Error storing summary: ${response.statusText}`);
    }

    const data = await response.json();
    return data.summaryId;
  } catch (error) {
    console.error("Error storing summary:", error);
    throw error;
  }
};

// Utility function to get the start of the week (Sunday) for a given date
const getWeekStartDate = (date) => {
  const dayOfWeek = date.getDay(); // 0 (Sunday) to 6 (Saturday)
  const diff = date.getDate() - dayOfWeek; // Move back to the most recent Sunday
  const weekStartDate = new Date(date.setDate(diff));

  // Ensure consistent formatting without relying on toISOString()
  const year = weekStartDate.getFullYear();
  const month = String(weekStartDate.getMonth() + 1).padStart(2, "0"); // Ensure two-digit month
  const day = String(weekStartDate.getDate()).padStart(2, "0"); // Ensure two-digit day

  return `${year}-${month}-${day}`; // Format as "YYYY-MM-DD"
};

const updateSessionWithTranscript = async (sessionId, sessionCloseType) => {
  try {
    // Fetch messages for the session from the factor_mind_messages table
    const response = await fetch(
      `https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/sessions/${sessionId}/messages`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Error fetching session messages: ${response.statusText}`);
    }

    const data = await response.json();
    const messages = data.messages;

    // Generate a transcript from the fetched messages
    const transcript = messages
      .filter((msg) => msg.sender !== "system") // Exclude system messages
      .map((msg) => `${msg.sender === "user" ? "You:" : "Factor Mind:"} ${msg.message_text}`)
      .join("\n");

    //console.log("Transcript:", transcript);

    // Update the session with the transcript, end_time, and session_close_type
    const updateResponse = await fetch(
      `https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/sessions/${sessionId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript: transcript, // Write transcript to the new field
          end_time: new Date().toISOString(), // Add the end_time
          session_close_type: sessionCloseType, // Add session_close_type
        }),
      }
    );

    if (!updateResponse.ok) {
      throw new Error(`Error updating session: ${updateResponse.statusText}`);
    }

    const updateData = await updateResponse.json();
    //console.log("✅ Session updated successfully:", updateData);
  } catch (error) {
    console.error("Error updating session with transcript:", error);
    throw error;
  }
};

const extractSummaries = async (aiResponse) => {
  try {
    // Define prompts for extracting summaries
    const lastWeekPrompt = `
      You are an AI assistant that extracts the "Last Week’s Big 3" summary from a given text.
      If the text mentions "Last Week’s Big 3," return only the summary.
      If it does not mention "Last Week’s Big 3," return "No Big 3 submission last week."

      Text: """${aiResponse}"""
    `;

    const thisWeekPrompt = `
      You are an AI assistant that extracts the "This Week’s Big 3" summary from a given text.
      If the text mentions "This Week’s Big 3," return only the summary.
      If it does not mention "This Week’s Big 3," return "No Big 3 submitted yet."

      Text: """${aiResponse}"""
    `;

    // Extract "Last Week’s Big 3"
    const lastWeekData = await callOpenAIProxy(lastWeekPrompt);
    const lastWeeksBig3Summary = lastWeekData.choices[0].message.content.trim();

    // Extract "This Week’s Big 3"
    const thisWeekData = await callOpenAIProxy(thisWeekPrompt);
    const thisWeeksBig3Summary = thisWeekData.choices[0].message.content.trim();

    return {
      last_weeks_big3_summary: lastWeeksBig3Summary,
      this_weeks_big3_summary: thisWeeksBig3Summary,
    };
  } catch (error) {
    console.error("Error extracting summaries:", error);
    return {
      last_weeks_big3_summary: "No Big 3 submission last week.",
      this_weeks_big3_summary: "No Big 3 submitted yet.",
    };
  }
};

// Estimate token count using a simple approximation
const estimateTokenCount = (text) => {
  return Math.ceil(text.split(/\s+/).length * 1.33); // Rough estimate: ~1.33 tokens per word
};

const ChatInterface = ({ user, userData, onEditProfile, refreshUserData }) => {
  const userEmail = user?.signInDetails?.loginId; // Define userEmail here
  const [selectedExperience, setSelectedExperience] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [experiences, setExperiences] = useState({});
  const [isLoading, setIsLoading] = useState(true); // Loading state
  const [error, setError] = useState(null); // Error state
  const [sessionId, setSessionId] = useState(null); // Store the session ID
  const [customPrompt, setCustomPrompt] = useState("");
  const chatEndRef = useRef(null);
  const [isSummaryGenerated, setIsSummaryGenerated] = useState(false); // New state variable
  const [isSummaryConfirmed, setIsSummaryConfirmed] = useState(false);
  const [usedVectorIds, setUsedVectorIds] = useState(new Set());
  const [isTransitioning, setIsTransitioning] = useState(false); // State to control animation visibility
  const [isPreparing, setIsPreparing] = useState(false); // State for "Preparing Your Session" animation
  const [summaries, setSummaries] = useState({
    last_weeks_big3_summary: null,
    this_weeks_big3_summary: null,
  });

  // handleAIResponse function
  const handleAIResponse = async (aiResponse, sessionId, userEmail, weekStart) => {
    try {
      // Extract summaries for Big 3 Experience (existing logic)
      const extractedSummaries = await extractSummaries(aiResponse);
      setSummaries({
        last_weeks_big3_summary: extractedSummaries.last_weeks_big3_summary || null,
        this_weeks_big3_summary: extractedSummaries.this_weeks_big3_summary || null,
      });

      // Skip key insight evaluation for Big 3 and Intel Report experiences
      const isBig3Experience = selectedExperience === BIG3_EXPERIENCE_NAME.toLowerCase().replace(/\s+/g, "");
      const isChallengeExperience = selectedExperience === CHALLENGE_EXPERIENCE_NAME.toLowerCase().replace(/\s+/g, "");
      console.log("Is Challenge Experience:", isChallengeExperience);
      const isIntelReportExperience = selectedExperience === "intelreport"; // Replace with the actual key for Intel Report Experience

      if (isBig3Experience || isIntelReportExperience || isChallengeExperience) {
        console.log("Skipping key insight evaluation for Big 3, Challenge Factor Mind, or Intel Report experiences.");
        return; // Exit early for these experiences
      }

      // Guard clause: Ensure there are at least two messages (AI prompt and user response)
      if (messages.length < 3 || !messages[messages.length - 3]?.content || !messages[messages.length - 2]?.content) {
        console.log("Messages:", messages);
        console.log("Insufficient messages for key insight evaluation. Skipping.");
        return;
      }

      // Retrieve the AI's prompt and the user's response
      const aiPrompt = messages[messages.length - 3].content; // Second-to-last message is the AI's prompt
      const userResponse = messages[messages.length - 2].content; // Last message is the user's response

      console.log("Messages", messages);
      console.log("AI Prompt:", aiPrompt);
      console.log("User Response:", userResponse);

      // Evaluate the user's response for key insights
      const evaluationPrompt = `
        Evaluate the user’s most recent response along with the previous question from the AI.
        Identify if the response contains any key insights relevant to the commercial real estate and land business.
        A key insight is defined as a significant observation, an actionable detail, or an important piece of information that contributes to evaluating opportunities in this domain.
        If a key insight is found, return the key insight text. If no key insight is found, return "no key insight".

        AI Prompt: """${aiPrompt}"""
        User Response: """${userResponse}"""
      `;

      const evaluationData = await callOpenAIProxy(evaluationPrompt);
      const evaluationResult = evaluationData.choices[0].message.content.trim();

      if (evaluationResult.toLowerCase().includes("no key insight")) {
        console.log("No key insight found.");
      } else {
        console.log("Key insight found:", evaluationResult);

        // Generate a label for the key insight
        const labelPrompt = `
          Generate a concise label (less than 50 characters) for the following key insight.
          The label should summarize the insight in a way that is useful for categorization and retrieval.
          Examples of labels include "Market Trend", "Investment Opportunity", "Risk Analysis", etc.

          Key Insight: """${evaluationResult}"""
        `;

        const labelData = await callOpenAIProxy(labelPrompt);
        const keyInsightLabel = labelData.choices[0].message.content.trim().substring(0, 50); // Ensure the label is <= 50 characters

        console.log("Generated key insight label:", keyInsightLabel);

        // Bundle the AI prompt and user response
        const bundledText = `AI Prompt: ${aiPrompt}\nUser Response: ${userResponse}`;

        // Send the bundled text to Pinecone
        const vectorResponse = await fetch(
          "https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/vectors",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "store",
              text: bundledText,
              vector_id: sessionId, // Use sessionId as the vector ID
              role_type: userData?.role_type,
              metadata: {
                message_type: "key_insight",
                experience_type: selectedExperience,
                user_email: userEmail,
                key_insight_label: keyInsightLabel, // Include the key insight label
              },
            }),
          }
        );

        if (!vectorResponse.ok) {
          throw new Error("Error storing key insight vector.");
        }

        console.log("✅ Key insight vectorized and stored in Pinecone.");

        // Update the message record in factor_mind_messages
        const messageId = messages[messages.length - 2].messageId; // Assuming the message object has an `id` field
        const updateMessageResponse = await fetch(
          `https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/sessions/${sessionId}/messages/${messageId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              is_vectorized: 1, // Mark the message as vectorized
              is_key_insight: true, // Mark the message as containing a key insight
              key_insight_type: keyInsightLabel, // Set the key insight label
            }),
          }
        );

        if (!updateMessageResponse.ok) {
          throw new Error(`Error updating message: ${updateMessageResponse.statusText}`);
        }

        console.log("✅ Message updated with key insight details.");
      }
    } catch (error) {
      console.error("❌ Error handling AI response:", error);
      throw error;
    }
  };

  // Scroll to the latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch experiences on component mount
  useEffect(() => {
    const loadExperiences = async () => {
      setIsLoading(true);
      try {
        // Use the allowed_experiences and manual_overrides from userData
        const allowedExperiences = userData?.allowed_experiences || [];
        const manualOverrides = userData?.manual_overrides || {};
        const data = await fetchExperiences(allowedExperiences, manualOverrides);
        const transformedData = transformExperiences(data);
        setExperiences(transformedData);
        setError(null); // Clear any previous errors
      } catch (error) {
        console.error("Error loading experiences:", error);
        setError("Failed to load experiences. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    loadExperiences();
  }, [userData]); // Re-fetch experiences if userData changes

  useEffect(() => {
    const evaluateSummaryConfirmation = () => {
      const isIntelExperience = selectedExperience === INTEL_EXPERIENCE_NAME.toLowerCase().replace(/\s+/g, "");

      if (isIntelExperience) {
        // Check if the latest AI message contains a summary confirmation
        const latestAIMessage = messages
          .slice()
          .reverse()
          .find((msg) => msg.role === "assistant");

        if (latestAIMessage && isSummaryConfirmationMessage(latestAIMessage.content)) {
          setIsSummaryGenerated(true); // Enable the "Complete" button
          setIsSummaryConfirmed(true); // Mark the summary as confirmed
        }
      }
    };

    if (messages.length > 0) {
      evaluateSummaryConfirmation();
    }
  }, [messages, selectedExperience]);

  useEffect(() => {
    const evaluateKeyInsight = async () => {
      // Skip key insight evaluation for Big 3 and Intel Report experiences
      const isBig3Experience = selectedExperience === BIG3_EXPERIENCE_NAME.toLowerCase().replace(/\s+/g, "");
      const isIntelReportExperience = selectedExperience === INTEL_EXPERIENCE_NAME.toLowerCase().replace(/\s+/g, "");
      const isAskFactorMind = selectedExperience === ASK_EXPERIENCE_NAME.toLowerCase().replace(/\s+/g, "");
      const isChallengeFactorMind = selectedExperience === CHALLENGE_EXPERIENCE_NAME.toLowerCase().replace(/\s+/g, "");

      if (isBig3Experience || isIntelReportExperience || isAskFactorMind || isChallengeFactorMind ) {
        console.log("Skipping key insight evaluation for Big 3, Intel Report, Ask or Challenge Factor Mind experiences.");
        return; // Exit early for these experiences
      }

      // Check if the latest AI message contains a summary
      const latestAIMessage = messages
        .slice()
        .reverse()
        .find((msg) => msg.role === "assistant");

      if (latestAIMessage && isSummaryConfirmationMessage(latestAIMessage.content)) {
        setIsSummaryGenerated(true); // Enable the "Complete" button
      }

      if (messages.length < 3 || !messages[messages.length - 3]?.content || !messages[messages.length - 2]?.content) {
        console.log("Messages:", messages);
        console.log("Insufficient messages for key insight evaluation. Skipping.");
        return;
      }

      const aiPrompt = messages[messages.length - 3].content; // Second-to-last message is the AI's prompt
      const userResponse = messages[messages.length - 2].content; // Last message is the user's response

      console.log("Messages", messages);
      console.log("AI Prompt:", aiPrompt);
      console.log("User Response:", userResponse);

      // Evaluate the user's response for key insights
      const evaluationPrompt = `
        Evaluate the user’s most recent response along with the previous question from the AI.
        Identify if the response contains any key insights relevant to the commercial real estate and land business.
        A key insight is defined as a significant observation, an actionable detail, or an important piece of information that contributes to evaluating opportunities in this domain.
        If a key insight is found, return the key insight text. If no key insight is found, return "no key insight".

        AI Prompt: """${aiPrompt}"""
        User Response: """${userResponse}"""
      `;

      const evaluationData = await callOpenAIProxy(evaluationPrompt);
      const evaluationResult = evaluationData.choices[0].message.content.trim();

      if (evaluationResult.toLowerCase().includes("no key insight")) {
        console.log("No key insight found.");
      } else {
        console.log("Key insight found:", evaluationResult);

        // Generate a label for the key insight
        const labelPrompt = `
          Generate a concise label (less than 50 characters) for the following key insight.
          The label should summarize the insight in a way that is useful for categorization and retrieval.
          Examples of labels include "Market Trend", "Investment Opportunity", "Risk Analysis", etc.

          Key Insight: """${evaluationResult}"""
        `;

        const labelData = await callOpenAIProxy(labelPrompt);
        const keyInsightLabel = labelData.choices[0].message.content.trim().substring(0, 50); // Ensure the label is <= 50 characters

        console.log("Generated key insight label:", keyInsightLabel);

        // Bundle the AI prompt and user response
        const bundledText = `AI Prompt: ${aiPrompt}\nUser Response: ${userResponse}`;

        // Send the bundled text to Pinecone
        const vectorResponse = await fetch(
          "https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/vectors",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "store",
              text: bundledText,
              vector_id: sessionId, // Use sessionId as the vector ID
              role_type: userData?.role_type,
              metadata: {
                message_type: "key_insight",
                experience_type: selectedExperience,
                user_email: userEmail, // Use userEmail here
                key_insight_label: keyInsightLabel, // Include the key insight label
              },
            }),
          }
        );

        if (!vectorResponse.ok) {
          throw new Error("Error storing key insight vector.");
        }

        console.log("✅ Key insight vectorized and stored in Pinecone.");

        // Update the message record in factor_mind_messages
        const messageId = messages[messages.length - 2].messageId; // Assuming the message object has an `id` field
        const updateMessageResponse = await fetch(
          `https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/sessions/${sessionId}/messages/${messageId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              is_vectorized: 1, // Mark the message as vectorized
              is_key_insight: true, // Mark the message as containing a key insight
              key_insight_type: keyInsightLabel, // Set the key insight label
            }),
          }
        );

        if (!updateMessageResponse.ok) {
          throw new Error(`Error updating message: ${updateMessageResponse.statusText}`);
        }

        console.log("✅ Message updated with key insight details.");
      }
    };

    if (messages.length > 2) {
      evaluateKeyInsight();
    }
  }, [messages, sessionId, userData?.role_type, selectedExperience, userEmail]); // Add userEmail to the dependency array

  // Create a new session
  const createSession = async (userEmail, experienceType) => {
    try {
      //console.log("Creating session with:", { userEmail, experienceType });

      const response = await fetch(
        "https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/sessions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ user_email: userEmail, experience_type: experienceType }),
        }
      );

      //console.log("Session creation response:", response);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      //console.log("Session created successfully:", data);
      return data.sessionId;
    } catch (error) {
      console.error("Error creating session:", error);
      throw error;
    }
  };

  // Log a new message
  const logMessage = async (sessionId, sender, messageText) => {
    try {
      //console.log("Logging message with:", { sessionId, sender, messageText });

      const response = await fetch(
        `https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/sessions/${sessionId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sender, message_text: messageText }),
        }
      );

      //console.log("Message logging response:", response);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      //console.log("Message logged successfully:", data);
      return data;
    } catch (error) {
      console.error("Error logging message:", error);
      throw error;
    }
  };

  // Update the session with the AI summary
  const updateSession = async (sessionId, aiSummary) => {
    try {
      const response = await fetch(
        `https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/sessions/${sessionId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ai_summary: aiSummary }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error updating session:", error);
      throw error;
    }
  };

  // In ChatInterface.js
  const handleProfileNavigation = async () => {
    try {
      // Check if a sessionId exists
      if (sessionId) {
        // Check if the session has any user messages
        const response = await fetch(
          `https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/sessions/${sessionId}/messages`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Error fetching session messages: ${response.statusText}`);
        }

        const data = await response.json();
        const userMessages = data.messages.filter((msg) => msg.sender === "user");

        // If the session has no user messages, delete it
        if (userMessages.length === 0) {
          const deleteResponse = await fetch(
            `https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/sessions/${sessionId}`,
            {
              method: "DELETE",
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          if (!deleteResponse.ok) {
            throw new Error(`Error deleting session: ${deleteResponse.statusText}`);
          }
        } else {
          // Update the session with the transcript and mark it as "navigation"
          await updateSessionWithTranscript(sessionId, "navigation");
        }
      }

      // Navigate to the profile setup
      onEditProfile();
    } catch (error) {
      console.error("Error handling profile navigation:", error);
    }
  };

  const handleCancel = async () => {
    try {
      // Check if the session has any user messages
      const response = await fetch(
        `https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/sessions/${sessionId}/messages`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      // Handle 404 (No messages found)
      if (response.status === 404) {
        console.log("No messages found for this session. Deleting session...");

        // Delete the session if no messages exist
        const deleteResponse = await fetch(
          `https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/sessions/${sessionId}`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!deleteResponse.ok) {
          const deleteErrorData = await deleteResponse.json();
          throw new Error(`Error deleting session: ${deleteErrorData.message || deleteResponse.statusText}`);
        }

        // Reset the chat interface
        setSelectedExperience(null);
        setSessionId(null);
        setMessages([]);
        return; // Exit early
      }

      // Handle other errors
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Error fetching session messages: ${errorData.message || response.statusText}`);
      }

      const data = await response.json();
      const userMessages = data.messages.filter((msg) => msg.sender === "user");

      // If the session has no user messages, delete it
      if (userMessages.length === 0) {
        const deleteResponse = await fetch(
          `https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/sessions/${sessionId}`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!deleteResponse.ok) {
          const deleteErrorData = await deleteResponse.json();
          throw new Error(`Error deleting session: ${deleteErrorData.message || deleteResponse.statusText}`);
        }
      } else {
        // Update the session with the transcript and mark it as "canceled"
        await updateSessionWithTranscript(sessionId, "canceled");
      }

      // Reset the chat interface
      setSelectedExperience(null);
      setSessionId(null);
      setMessages([]);
    } catch (error) {
      console.error("Error canceling session:", error);
      setMessages([
        ...messages,
        { role: "assistant", content: "⚠️ Error canceling the session. Please try again." },
      ]);
    }
  };


  const handleComplete = async () => {
    setIsTransitioning(true); // Show the animation

    const startTime = Date.now(); // Track when the animation started
    const minimumAnimationDuration = 8000; // 8 seconds (adjust as needed)

    try {
      // Check if the session has any user messages
      const response = await fetch(
        `https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/sessions/${sessionId}/messages`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Error fetching session messages: ${response.statusText}`);
      }

      const data = await response.json();
      const userMessages = data.messages.filter((msg) => msg.sender === "user");

      // If the session has no user messages, delete it
      if (userMessages.length === 0) {
        const deleteResponse = await fetch(
          `https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/sessions/${sessionId}`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!deleteResponse.ok) {
          throw new Error(`Error deleting session: ${deleteResponse.statusText}`);
        }

        // Reset the chat interface
        setSelectedExperience(null);
        setSessionId(null);
        setMessages([]);
        console.log("Session deleted due to no engagement.");
        return;
      }

      // Update the session with the transcript and mark it as "completed"
      await updateSessionWithTranscript(sessionId, "completed");

      // Handle Big 3 experience separately
      const isBig3Experience = selectedExperience === BIG3_EXPERIENCE_NAME.toLowerCase().replace(/\s+/g, "");
      const isIntelExperience = selectedExperience === INTEL_EXPERIENCE_NAME.toLowerCase().replace(/\s+/g, "");
      const isAskFactorMindExperience = selectedExperience === ASK_EXPERIENCE_NAME.toLowerCase().replace(/\s+/g, "");

      if (isBig3Experience) {
        // Existing Big 3 logic
        const finalAssistantMessage = messages
          .slice() // Create a copy of the messages array
          .reverse() // Reverse to find the latest assistant message
          .find((msg) => msg.role === "assistant" && /This Week['’]s Big 3/i.test(msg.content));

        if (finalAssistantMessage) {
          const summaries = await extractSummaries(finalAssistantMessage.content);
          await saveBig3Entry(sessionId, summaries, user?.signInDetails?.loginId, getWeekStartDate(new Date()));

          const fullSummaryText = [
            summaries.last_weeks_big3_summary ? `Last week's goals: ${summaries.last_weeks_big3_summary}` : "No Big 3 submission last week.",
            summaries.this_weeks_big3_summary ? `This week's goals: ${summaries.this_weeks_big3_summary}` : "No Big 3 submitted yet.",
          ].join("\n\n");

          const summaryResponse = await fetch(
            "https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/summaries",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                session_id: sessionId,
                summary_text: fullSummaryText,
                summary_type: "big3_summary",
              }),
            }
          );

          if (!summaryResponse.ok) {
            throw new Error(`Error creating summary: ${summaryResponse.statusText}`);
          }

          const summaryData = await summaryResponse.json();

          // Vectorize the Big 3 summary and store it in Pinecone
          const vectorResponse = await fetch(
            "https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/vectors",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                action: "store",
                text: fullSummaryText,
                vector_id: summaryData.summaryId,
                role_type: userData?.role_type,
                metadata: {
                  message_type: "big3_summary",
                  experience_type: selectedExperience,
                  user_email: user?.signInDetails?.loginId,
                },
              }),
            }
          );

          if (!vectorResponse.ok) {
            throw new Error("Error storing Big 3 summary vector.");
          }

          // Mark the summary as vectorized
          const updateSummaryResponse = await fetch(
            `https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/summaries/${summaryData.summaryId}`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                is_vectorized: 1,
              }),
            }
          );

          if (!updateSummaryResponse.ok) {
            throw new Error(`Error updating summary: ${updateSummaryResponse.statusText}`);
          }
        }
      } else if (isIntelExperience) {
        // Handle Intel Report experience
        const finalAssistantMessage = messages
          .slice() // Create a copy of the messages array
          .reverse() // Reverse to find the latest assistant message
          .find((msg) => msg.role === "assistant" && isSummaryConfirmationMessage(msg.content));

        if (finalAssistantMessage) {
          // Extract the summary from the assistant's message
          const summaryText = finalAssistantMessage.content;

          // Save the summary to the factor_mind_summaries table
          const summaryResponse = await fetch(
            "https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/summaries",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                session_id: sessionId,
                summary_text: summaryText,
                summary_type: "intel_summary",
              }),
            }
          );

          if (!summaryResponse.ok) {
            throw new Error(`Error creating summary: ${summaryResponse.statusText}`);
          }

          const summaryData = await summaryResponse.json();

          // Vectorize the Intel summary and store it in Pinecone
          const vectorResponse = await fetch(
            "https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/vectors",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                action: "store",
                text: summaryText,
                vector_id: summaryData.summaryId,
                role_type: userData?.role_type,
                metadata: {
                  message_type: "intel_summary",
                  experience_type: selectedExperience,
                  user_email: user?.signInDetails?.loginId,
                },
              }),
            }
          );

          if (!vectorResponse.ok) {
            throw new Error("Error storing Intel summary vector.");
          }

          // Mark the summary as vectorized
          const updateSummaryResponse = await fetch(
            `https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/summaries/${summaryData.summaryId}`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                is_vectorized: 1,
              }),
            }
          );

          if (!updateSummaryResponse.ok) {
            throw new Error(`Error updating summary: ${updateSummaryResponse.statusText}`);
          }
        }
      }

      // Handle key insights for other experiences (e.g., Quarterly Planning, Role Interviews)
      if (!isBig3Experience && !isIntelExperience && !isAskFactorMindExperience) {
        try {
          // Fetch key insights for the session
          const keyInsightsResponse = await fetch(
            `https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/sessions/${sessionId}/messages?is_key_insight=true`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          // Handle 404 (No key insights found)
          if (keyInsightsResponse.status === 404) {
            console.log("No key insights found for this session.");
            // Refresh user data to reflect updated manual_overrides
            if (refreshUserData) {
              await refreshUserData();
            }

            // Reset the chat interface
            setSelectedExperience(null);
            setSessionId(null);
            setMessages([]);
            setIsSummaryGenerated(false);
            setIsSummaryConfirmed(false);
            return; // Exit early if no key insights are found
          }

          // Handle other errors
          if (!keyInsightsResponse.ok) {
            throw new Error(`Error fetching key insights: ${keyInsightsResponse.statusText}`);
          }

          const keyInsightsData = await keyInsightsResponse.json();
          const keyInsights = keyInsightsData.messages;

          if (keyInsights.length > 0) {
            // Generate a summary using the generateSummary function
            const gptSummary = await generateSummary(keyInsights);

            // Save the GPT-generated summary to the factor_mind_summaries table
            const summaryResponse = await fetch(
              "https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/summaries",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  session_id: sessionId,
                  summary_text: gptSummary,
                  summary_type: "key_insight_summary",
                }),
              }
            );

            if (!summaryResponse.ok) {
              throw new Error(`Error creating key insight summary: ${summaryResponse.statusText}`);
            }

            const summaryData = await summaryResponse.json();

            // Vectorize the GPT-generated summary and store it in Pinecone
            const vectorResponse = await fetch(
              "https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/vectors",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  action: "store",
                  text: gptSummary,
                  vector_id: summaryData.summaryId,
                  role_type: userData?.role_type,
                  metadata: {
                    message_type: "key_insight_summary",
                    experience_type: selectedExperience,
                    user_email: user?.signInDetails?.loginId,
                  },
                }),
              }
            );

            if (!vectorResponse.ok) {
              throw new Error("Error storing key insight summary vector.");
            }

            // Mark the summary as vectorized
            const updateSummaryResponse = await fetch(
              `https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/summaries/${summaryData.summaryId}`,
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  is_vectorized: 1,
                }),
              }
            );

            if (!updateSummaryResponse.ok) {
              throw new Error(`Error updating key insight summary: ${updateSummaryResponse.statusText}`);
            }
          } else {
            console.log("No key insights found for this session.");
          }
        } catch (error) {
          console.error("Error handling key insights:", error);
          // Optionally, you can log the error or show a user-friendly message
          setMessages([
            ...messages,
            { role: "assistant", content: "⚠️ Error processing key insights. Please try again." },
          ]);
        }
      }

      // Refresh user data to reflect updated manual_overrides
      if (refreshUserData) {
        await refreshUserData();
      }

      // Reset the chat interface
      setSelectedExperience(null);
      setSessionId(null);
      setMessages([]);
      setIsSummaryGenerated(false);
      setIsSummaryConfirmed(false);

      console.log("Session completed and summary saved.");
    } catch (error) {
      console.error("Error completing the session:", error);
      setMessages([
        ...messages,
        { role: "assistant", content: "⚠️ Error saving the transcript. Please try again." },
      ]);
    } finally {
      // Ensure the animation runs for at least the minimum duration
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minimumAnimationDuration - elapsedTime);

      setTimeout(() => {
        setIsTransitioning(false); // Hide the animation
      }, remainingTime);
    }
  };

  const handleExperienceSelect = async (experience) => {
    setIsPreparing(true); // Show the "Preparing Your Session" animation
    const userEmail = user?.signInDetails?.loginId;

    if (!userEmail || !experiences[experience]?.label) {
      console.error("Missing required parameters: user.email or experience.label");
      setIsPreparing(false); // Hide the animation if there's an error
      return;
    }

    setSelectedExperience(experience);
    setIsSummaryGenerated(false); // Reset when a new experience is selected

    try {
      let dynamicContextText = ""; // Placeholder for dynamic context
      let dynamicInstructions = "";
      let aiPrompt = experiences[experience].prompt;
      const isBig3Experience = experiences[experience]?.label === BIG3_EXPERIENCE_NAME;
      const isQuarterlyPlanningExperience = experiences[experience]?.label === QTRPLAN_EXPERIENCE_NAME; // New condition
      const isAskFactorMindExperience = experiences[experience]?.label === ASK_EXPERIENCE_NAME; // New condition
      const isQuarterlyPlanningUpdateExperience = experiences[experience]?.label === QTRUPDATE_EXPERIENCE_NAME; // New condition
      const isChallengeFactorMindExperience = experiences[experience]?.label === CHALLENGE_EXPERIENCE_NAME; // New condition
      // Define a list of role-based update experiences
      const roleUpdateTypes = ["Partner", "Director", "Associate", "Analyst"];

      // Check if the selected experience is a role-based update
      const isRoleUpdateExperience = roleUpdateTypes.some(role =>
          experiences[experience]?.label === `${role} Update`
      );

      // Define currentWeekStart outside the if block
      const currentWeekStart = getWeekStartDate(new Date());

      if (isBig3Experience) {
          // 🔹 Initialize variables
          let lastWeekBig3Summary = "No Big 3 submission last week.";
          let thisWeekBig3Summary = "No Big 3 submitted yet.";
          let additionalNotes = "No additional notes.";

          // 🔹 Fetch Big 3 entries for the current week
          const currentWeekEntries = await fetchBig3Entries(userEmail, currentWeekStart);

          // 🔹 Check if the user has already submitted a Big 3 for the current week
          const hasCurrentWeekBig3 = currentWeekEntries.length > 0;

          // 🔹 Initialize dynamic context and instructions
          let dynamicContextText = "";
          let dynamicInstructions = "";

          if (hasCurrentWeekBig3) {
              // 🔹 User has already submitted a Big 3 for the current week
              thisWeekBig3Summary = currentWeekEntries
                  .map((entry) => entry.this_weeks_big3_summary || "No Big 3 submitted yet.")
                  .join("\n");

              dynamicContextText += `📌 **Current Week’s Big 3 (Planned):**\n${thisWeekBig3Summary}\n`;
              dynamicContextText += "**Here are your current goals for the **week**. Would you like to update them?**\n";

              dynamicInstructions = `- **This Week’s Big 3 exists.** Show the current goals for the **week** and ask if they need to make changes.`;
              // Use the AI prompt **without** last week's review
              aiPrompt = aiPrompt.replace(" while optionally reviewing progress from the **previous week** (if applicable).", "");
          } else {
              // 🔹 User has not submitted a Big 3 for the current week
              const previousWeekStart = getWeekStartDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
              const previousWeekEntries = await fetchBig3Entries(userEmail, previousWeekStart);

              // 🔹 Format the previous week's Big 3 (if available)
              if (previousWeekEntries.length > 0) {
                  lastWeekBig3Summary = previousWeekEntries
                      .map((entry) => entry.this_weeks_big3_summary || "No Big 3 submitted yet.")
                      .join("\n");

                  dynamicContextText += `📌 **Review of Last Week’s Big 3:**\n${lastWeekBig3Summary}\n`;
                  dynamicContextText += "**How did you progress on last week’s goals? Should any unfinished goals carry forward to the **week**?**\n";
              }

              dynamicContextText += "📌 **Current Week’s Big 3 (Planned):**\n🔹 No Big 3 submitted yet.\n";

              dynamicInstructions = `- **No Big 3 submitted for the upcoming week.** Show last week’s Big 3 (if available) and ask how they progressed. Then, guide them to set new goals for the **week**.`;
          }

          // 🔹 Build the LAST_WEEK_SECTION and THIS_WEEK_SECTION dynamically
          let lastWeekSection = "";
          let thisWeekSection = "";

          if (hasCurrentWeekBig3) {
              // Skip the last week's section
              thisWeekSection = `✅ Summarize this week’s Big 3 goals separately:
            **This Week’s Big 3**
            - ${thisWeekBig3Summary}
            *Additional Notes: ${additionalNotes}*`;
          } else {
              // Include the last week's section
              lastWeekSection = `✅ If prior Big 3 feedback was given, summarize last week’s progress:
            **Recap of Last Week’s Big 3**
            - ${lastWeekBig3Summary}`;

              thisWeekSection = `✅ Summarize this week’s Big 3 goals separately:
            **This Week’s Big 3**
            - ${thisWeekBig3Summary}
            *Additional Notes: ${additionalNotes}*`;
          }

          // 🔹 Replace placeholders dynamically
          aiPrompt = aiPrompt
              .replace("{{DYNAMIC_CONTEXT}}", dynamicContextText || "")
              .replace("{{DYNAMIC_INSTRUCTIONS}}", dynamicInstructions || "")
              .replace("{{LAST_WEEK_SECTION}}", lastWeekSection || "")
              .replace("{{THIS_WEEK_SECTION}}", thisWeekSection || "");

          //console.log("AI Prompt:", aiPrompt);
      } else if (isQuarterlyPlanningExperience) {
          // New Quarterly Planning logic
          const dynamicContext = await fetchRoles(userEmail, QTRPLAN_EXPERIENCE_NAME);

          dynamicContextText += `📌 **Role-Specific Guidance:**\n${dynamicContext}\n`;
          dynamicContextText += "\n**Let’s plan your quarterly goals based on your role and responsibilities.**\n";

          dynamicInstructions = `- **Quarterly Planning:** Guide the user to set quarterly goals based on their role and responsibilities.`;

          // Retrieve prompt from RDS & replace placeholders dynamically
          aiPrompt = aiPrompt
              .replace("{{DYNAMIC_CONTEXT}}", dynamicContextText || "")
              .replace("{{DYNAMIC_INSTRUCTIONS}}", dynamicInstructions || "");
      } else if (isAskFactorMindExperience) {
          // New "Ask Factor Mind" logic
          aiPrompt = `You are a helpful assistant. Answer the user's question based on the context provided.`;
      } else if (isRoleUpdateExperience) {
          // New logic for Role Update experience
          const roleType = experiences[experience]?.label.replace(" Update", "").toLowerCase();
          console.log("Experience Update Type:", roleType);

          // Query Pinecone for previous interviews
          const previousInterviews = await queryPineconeForRoleInterviews(userEmail, roleType);
          console.log("Previous Interviews in Pinecone:", previousInterviews);

          // Check if there are any matches
          if (previousInterviews && previousInterviews.length > 0) {
            dynamicContextText += `📌 **Previous ${roleType} Interviews:**\n`;
            previousInterviews.forEach((interview, index) => {
              dynamicContextText += `**Interview ${index + 1}:**\n${interview.metadata.text}\n\n`;
            });
            dynamicContextText += "**Let’s update your role based on these previous interviews.**\n";
          } else {
            dynamicContextText += "📌 **No previous interviews found.**\n";
            dynamicContextText += "**Let’s start fresh and update your role.**\n";
          }

          dynamicInstructions = `- **Role Update:** Guide the user to update their role based on previous interviews or start fresh if no interviews are found.`;
          console.log("Dynamic Context:", dynamicContextText);
          console.log("Dynamic Instructions:", dynamicInstructions);

          // Retrieve prompt from RDS & replace placeholders dynamically
          aiPrompt = aiPrompt
            .replace("{{DYNAMIC_CONTEXT}}", dynamicContextText || "")
            .replace("{{DYNAMIC_INSTRUCTIONS}}", dynamicInstructions || "");

          console.log("AI Prompt:", aiPrompt);
      } else if (isQuarterlyPlanningUpdateExperience) {
          // New logic for Role Update experience
          const expType = "quarterlyplanning"
          console.log("Experience Update Type:", expType);

          // Query Pinecone for previous interviews
          const previousSessions = await queryPineconeForQuarterlyPlanning(userEmail, expType);
          console.log("Previous Quarterly Planning Sessions in Pinecone:", previousSessions);

          // Check if there are any matches
          if (previousSessions && previousSessions.length > 0) {
            dynamicContextText += `📌 **Previous Quarterly Planning Sessions:**\n`;
            previousSessions.forEach((session, index) => {
              dynamicContextText += `**Session ${index + 1}:**\n${session.metadata.text}\n\n`;
            });
            dynamicContextText += "**Let’s update your quarterly plan based on these previous sessions.**\n";
          } else {
            dynamicContextText += "📌 **No previous sessions found.**\n";
            dynamicContextText += "**Let’s start fresh and update your quarterly plan.**\n";
          }

          dynamicInstructions = `- **Quarterly Planning Update:** Guide the user to update their quarterly goals based on previous sessions or start fresh if no sessions are found.`;
          console.log("Dynamic Context:", dynamicContextText);
          console.log("Dynamic Instructions:", dynamicInstructions);

          // Retrieve prompt from RDS & replace placeholders dynamically
          aiPrompt = aiPrompt
            .replace("{{DYNAMIC_CONTEXT}}", dynamicContextText || "")
            .replace("{{DYNAMIC_INSTRUCTIONS}}", dynamicInstructions || "");

          console.log("AI Prompt:", aiPrompt);
        } else if (isChallengeFactorMindExperience) {
            // 🔹 Track vector IDs to exclude
            let usedVectorIds = new Set();

            // 🔹 Fetch key insights from Pinecone
            const keyInsights = await queryPineconeForInsights([], experience, Array.from(usedVectorIds));

            if (keyInsights.length > 0) {
                // 🔹 Shuffle insights to randomize selection
                const shuffledInsights = keyInsights.sort(() => Math.random() - 0.5);

                // 🔹 Select a random insight
                const selectedInsight = shuffledInsights[0];

                if (selectedInsight) {
                    usedVectorIds.add(selectedInsight.id); // Add to exclusion list

                    // 🔹 Format the question for the user
                    const userQuestion = `Reflecting on the following insight: "${selectedInsight.metadata.text}", what are your thoughts? How might this apply to your current situation?`;

                    // 🔹 Update the AI prompt with the dynamic context
                    dynamicContextText = `📌 **Challenge Insight:**\n${selectedInsight.metadata.text}`;
                    aiPrompt = aiPrompt.replace("{{DYNAMIC_CONTEXT}}", dynamicContextText);

                    // 🔹 Replace the question placeholder in the AI prompt
                    aiPrompt = aiPrompt.replace("{{QUESTION}}", userQuestion);

                    console.log("AI Prompt Replaced:", aiPrompt);

                    // 🔹 Display only the question to the user
                    //setMessages([
                    //    { role: "system", content: `**${experiences[experience].introText}**` },
                    //    { role: "assistant", content: userQuestion },
                    //]);
                }
            } else {
                dynamicContextText = "📌 **No insights found.** Let’s start fresh!";
                aiPrompt = aiPrompt.replace("{{DYNAMIC_CONTEXT}}", dynamicContextText);

                // 🔹 Display a message to the user if no insights are found
                setMessages([
                    { role: "system", content: `**${experiences[experience].introText}**` },
                    { role: "assistant", content: "No insights found. Let’s start fresh!" },
                ]);
            }
        }

      // Build the AI system prompt
      const fullPrompt = isBig3Experience || isQuarterlyPlanningExperience || isAskFactorMindExperience || isRoleUpdateExperience || isQuarterlyPlanningUpdateExperience || isChallengeFactorMindExperience
          ? aiPrompt
          : experiences[experience].prompt;
      //console.log("Final AI System Prompt:\n", fullPrompt);

      // Store the custom prompt in state for later use
      setCustomPrompt(fullPrompt);
      console.log("Full Prompt:", fullPrompt);
      // Start the session
      const newSessionId = await createSession(userEmail, experiences[experience].label);
      setSessionId(newSessionId);

      setMessages([
          { role: "system", content: `**${experiences[experience].introText}**` },
          { role: "assistant", content: isAskFactorMindExperience ? "What would you like to ask Factor Mind?" : "⏳ Thinking... Please wait." },
      ]);

      if (!isAskFactorMindExperience) {
        // Send the initial prompt to OpenAI via the proxy
        const data = await callOpenAIProxy([
            { role: "system", content: fullPrompt },
        ]);

        if (data.choices && data.choices[0].message) {
            const aiResponse = data.choices[0].message.content;
            console.log("AI Response:", aiResponse);

            // Log the AI's initial response
            const message_data = await logMessage(newSessionId, "ai", aiResponse);

              // Update messages with the AI's response
              setMessages([
                  { role: "system", content: `**${experiences[experience].introText}**` },
                  { role: "assistant", content: aiResponse, messageId: message_data.messageId }
              ]);

              // Call handleAIResponse to extract and store summaries
              //console.log("AI Response:", aiResponse);
              //console.log("New Session Id:", newSessionId);
              //console.log("User Email:", userEmail);
              //console.log("Current Week Start:", currentWeekStart);
              //await handleAIResponse(aiResponse, newSessionId, userEmail, currentWeekStart);

              // Check if the initial response contains a valid summary
              checkAndEnableCompleteButton(aiResponse, experience, setIsSummaryGenerated);
          }
      }
  } catch (error) {
      console.error("Error starting session:", error);
      setMessages([
          { role: "assistant", content: "⚠️ Error starting the session. Please try again." },
      ]);
      setIsSummaryGenerated(false); // Reset if there's an error
  } finally {
    setIsPreparing(false); // Hide the "Preparing Your Session" animation
  }
};

  // Debounced send message function
  const debouncedSendMessage = debounce(async () => {
      if (!input.trim()) return;

      setInput("");

      // Log the user's message
      const user_message_data = await logMessage(sessionId, "user", input);
      const newMessages = [...messages, { role: "user", content: input, messageId: user_message_data.messageId }];
      setMessages(newMessages);
      if (selectedExperience === "askfactormind") {
          try {
              // Query Pinecone for relevant context
              const searchResponse = await fetch(
                  "https://k3bgnw08u6.execute-api.us-east-1.amazonaws.com/prod/vectors",
                  {
                      method: "POST",
                      headers: {
                          "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                          action: "search",
                          query_text: input,
                          filter: {
                              session_id: sessionId,  // Optional: Filter by session ID
                              role_type: userData?.role_type,  // Optional: Filter by role type
                          },
                          include_metadata: true,  // Ensure metadata is included in the response
                      }),
                  }
              );

              const searchData = await searchResponse.json();
              //console.log("Search Data:", JSON.stringify(searchData, null, 2)); // Debugging

              // Filter out matches with invalid metadata
              const validMatches = searchData.data.matches.filter(
                  (match) => match && match.metadata && match.metadata.text
              );

              // Extract relevant context and metadata from valid matches
              const relevantContext = validMatches
                  .map((match) => {
                      const metadata = match.metadata;
                      return `**Source:** ${metadata.user_email}\n**Role:** ${metadata.role_type}\n**Experience Type:** ${metadata.experience_type}\n**Timestamp:** ${metadata.timestamp}\n\n${metadata.text}`;
                  })
                  .join("\n\n---\n\n");

              // Include relevant context in the OpenAI prompt
              const systemMessage = {
                  role: "system",
                  content: `You are a helpful assistant. Use the following context to answer the user's question. Each piece of context includes metadata about the source (e.g., user email, role, experience type, and timestamp).\n\n${relevantContext}`,
              };

              // Send the message to OpenAI via the proxy
              const data = await callOpenAIProxy([systemMessage, ...newMessages]);
              const assistantMessage = data.choices[0].message.content;

              const ai_message_data = await logMessage(sessionId, "ai", assistantMessage);
              setMessages([...newMessages, { role: "assistant", content: assistantMessage, messageId: ai_message_data.messageId }]);
          } catch (error) {
              console.error("❌ Error fetching AI response:", error);
              setMessages([...newMessages, { role: "assistant", content: "⚠️ Error retrieving AI response. Please try again." }]);
          }
      } else {
          // Existing logic for other experiences
          const systemMessage = {
              role: "system",
              content: customPrompt || experiences[selectedExperience].prompt,
          };

          const maxAllowedTokens = 4000;
          let tokenCount = estimateTokenCount(systemMessage.content);
          const trimmedMessages = [];

          for (let i = newMessages.length - 1; i >= 0; i--) {
              const message = newMessages[i];
              const messageTokens = estimateTokenCount(message.content);

              if (tokenCount + messageTokens > maxAllowedTokens) break;
              tokenCount += messageTokens;
              trimmedMessages.unshift(message);
          }

          const finalMessages = [systemMessage, ...trimmedMessages];

          //console.log("🚀 Sending to OpenAI:", JSON.stringify(finalMessages, null, 2));

          try {

              // Send the message to OpenAI via the proxy
              const data = await callOpenAIProxy(finalMessages);
              //console.log("🚀 OpenAI Response:", JSON.stringify(data, null, 2));

              if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
                  throw new Error("No valid response from OpenAI.");
              }

              const assistantMessage = data.choices[0].message.content;

              // Check if the assistant's message contains a valid summary
              checkAndEnableCompleteButton(assistantMessage, selectedExperience, setIsSummaryGenerated);

              // setMessages([...newMessages, { role: "assistant", content: assistantMessage }]);

              // Log the AI's response
              const message_data = await logMessage(sessionId, "ai", assistantMessage);
              //console.log("Message_data:", message_data);
              //console.log("Message Id:", message_data.messageId)
              setMessages([...newMessages, { role: "assistant", content: assistantMessage, messageId: message_data.messageId }]);
              // Handle AI response to evaluate for key insights
              //await handleAIResponse(assistantMessage, sessionId, user?.signInDetails?.loginId, getWeekStartDate(new Date()));
          } catch (error) {
              console.error("❌ Error fetching AI response:", error);
              setMessages([...newMessages, { role: "assistant", content: "⚠️ Error retrieving AI response. Please try again." }]);
              setIsSummaryGenerated(false); // Reset if there's an error
          }
      }
  }, 300); // 300ms debounce delay

  // Render loading state
  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          minWidth: "100vw",
          width: "100vw",
          backgroundColor: "#f5f5f5",
          display: "flex",
          flexDirection: "column",
          margin: 0,
          padding: 0,
        }}
      >
        <Box
          sx={{
            backgroundColor: "white",
            width: "100vw",
            height: "70px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingLeft: "24px",
            paddingRight: "24px",
            boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
            margin: 0,
          }}
        >
          <img
            src="/factor_comps_logo.png"
            alt="Factor Comps"
            style={{ width: "200px", height: "auto" }}
          />
          <IconButton onClick={onEditProfile} sx={{ color: "grey" }}>
            <UserIcon />
          </IconButton>
        </Box>
        <Container maxWidth="md" sx={{ mt: 4, flexGrow: 1 }}>
          <Typography variant="h5" align="center" gutterBottom>
            Loading experiences...
          </Typography>
        </Container>
      </Box>
    );
  }

  // Render error state
  if (error) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          minWidth: "100vw",
          width: "100vw",
          backgroundColor: "#f5f5f5",
          display: "flex",
          flexDirection: "column",
          margin: 0,
          padding: 0,
        }}
      >
        <Box
          sx={{
            backgroundColor: "white",
            width: "100vw",
            height: "70px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingLeft: "24px",
            paddingRight: "24px",
            boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
            margin: 0,
          }}
        >
          <img
            src="/factor_comps_logo.png"
            alt="Factor Comps"
            style={{ width: "200px", height: "auto" }}
          />
          <IconButton onClick={onEditProfile} sx={{ color: "grey" }}>
            <UserIcon />
          </IconButton>
        </Box>
        <Container maxWidth="md" sx={{ mt: 4, flexGrow: 1 }}>
          <Typography variant="h5" align="center" gutterBottom>
            {error}
          </Typography>
        </Container>
      </Box>
    );
  }

  // Render the main interface
  return (
    <Box
      sx={{
        minHeight: "100vh",
        minWidth: "100vw",
        width: "100vw",
        backgroundColor: "#f5f5f5",
        display: "flex",
        flexDirection: "column",
        margin: 0,
        padding: 0,
      }}
    >
      {/* Full-Width White Header */}
      <Box
        sx={{
          backgroundColor: "white",
          width: "100vw",
          height: "70px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: "24px",
          paddingRight: "24px",
          boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
          margin: 0,
        }}
      >
        <img
          src="/factor_comps_logo.png"
          alt="Factor Comps"
          style={{ width: "200px", height: "auto" }}
        />
        <IconButton onClick={handleProfileNavigation} sx={{ color: "grey" }}>
          <UserIcon />
        </IconButton>
      </Box>

      {/* Main Content */}
      {/* Main Content */}
      <Container maxWidth="md" sx={{ mt: 4, flexGrow: 1 }}>
        {!selectedExperience ? (
          // Experience Selection Screen
          <>
            <Typography variant="h5" align="center" gutterBottom>
              Welcome {userData?.first_name || "there"}, how can I learn from you today?
            </Typography>
            <Box
              display="flex"
              flexDirection="column"
              gap={2}
              mt={3}
              sx={{
                width: "100%", // Ensure the container takes full width
                maxWidth: "400px", // Optional: Match the max width of the buttons
                margin: "0 auto", // Center the container horizontally
              }}
            >
              {Object.entries(experiences).map(([key, option]) => (
                <Tooltip
                  key={key}
                  title={option.isLocked ? option.lockReason : ""}
                  placement="top"
                  arrow
                >
                  <span>
                    <Button
                      variant="contained"
                      sx={{
                        borderRadius: "20px",
                        textTransform: "none",
                        backgroundColor: option.isLocked ? "#e0e0e0" : "primary.main",
                        color: option.isLocked ? "#9e9e9e" : "white",
                        "&:hover": {
                          backgroundColor: option.isLocked ? "#e0e0e0" : "primary.dark",
                        },
                        pointerEvents: option.isLocked ? "none" : "auto", // Disable click if locked
                        width: "100%", // Make buttons stretch to full width
                        maxWidth: "400px", // Optional: Set a max width for better readability
                        margin: "0 auto", // Center the buttons horizontally
                      }}
                      onClick={() => handleExperienceSelect(key)}
                      disabled={option.isLocked} // Disable the button if locked
                    >
                      {option.label} {option.isLocked && "🔒"}
                    </Button>
                  </span>
                </Tooltip>
              ))}
            </Box>
          </>
        ) : (
          // Chat Interface
          <>
            <Typography
              variant="body1"
              align="left"
              fontWeight="normal"
              sx={{ mt: 2, mb: 1, pl: 2 }}
            >
              {experiences[selectedExperience].introText}
            </Typography>

            {/* Chat Window */}
            <Paper sx={{ p: 3, height: "60vh", overflowY: "auto", mb: 2, backgroundColor: "#f5f5f5" }}>
              {messages
                .filter((msg) => msg.role !== "system")
                .map((msg, index) => (
                  <Box
                    key={index}
                    sx={{
                      mt: 1,
                      color: msg.role === "user" ? "black" : "#444",
                      textAlign: msg.role === "user" ? "right" : "left",
                      backgroundColor: msg.role === "user" ? "#e3f2fd" : "#f5f5f5",
                      p: 2,
                      borderRadius: "8px",
                      maxWidth: "80%",
                      alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                    }}
                  >
                    <Typography variant="body1" fontWeight="bold">
                      {msg.role === "user" ? "You:" : "Factor Mind:"}
                    </Typography>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </Box>
                ))}
              <div ref={chatEndRef} />
            </Paper>

            {/* Input Field - Full Width Below Chat Window */}
            <Box display="flex" flexDirection="column" width="100%" mt={2}>
              <TextField
                fullWidth
                multiline
                rows={2}
                variant="outlined"
                placeholder="Type your response..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    debouncedSendMessage();
                  }
                }}
              />

              {/* Button Row - Send on Left, Cancel & Complete on Right */}
              <Box display="flex" justifyContent="space-between" mt={2}>
                <Button variant="contained" color="primary" onClick={debouncedSendMessage}>
                  Send
                </Button>

                <Box display="flex" gap={1}>
                  <Button variant="contained" sx={{ backgroundColor: "#888" }} onClick={handleCancel}>
                    Cancel
                  </Button>
                  {/* Add isIntelExperience and isCompleteButtonEnabled here */}
                  {(() => {
                    const isIntelExperience = selectedExperience === INTEL_EXPERIENCE_NAME.toLowerCase().replace(/\s+/g, "");
                    const isBig3Experience = selectedExperience === BIG3_EXPERIENCE_NAME.toLowerCase().replace(/\s+/g, "");
                    const isCompleteButtonEnabled = isBig3Experience ? isSummaryGenerated : isIntelExperience ? isSummaryConfirmed : true;

                    return (
                      <Button
                        variant="contained"
                        sx={{ backgroundColor: "#28a745" }}
                        onClick={handleComplete}
                        disabled={!isCompleteButtonEnabled}
                      >
                        Complete
                      </Button>
                    );
                  })()}
                </Box>
              </Box>
            </Box>
          </>
        )}
      </Container>
      {/* Transition Animation */}
      <TransitionAnimation isVisible={isTransitioning} />

      {/* Preparing Animation */}
      <PreparingAnimation isVisible={isPreparing} />
    </Box>
  );
};

export default ChatInterface;
