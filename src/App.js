import React, { useState, useEffect } from "react";
import { CircularProgress, Button, Box } from "@mui/material";
import { SnackbarProvider } from 'notistack'; // Add this import
import ChatInterface from "./components/ChatInterface";
import MapPage from "./components/MapPage"; // Import the new MapPage component
import SignIn from "./components/Signin";
import ProfileSetup from "./components/ProfileSetup";
import { Amplify } from "aws-amplify";
import awsConfig from "./aws-exports";
import {
  fetchAuthSession,
  getCurrentUser,
  fetchUserAttributes,
  signOut,
} from "@aws-amplify/auth";
import { Hub } from "@aws-amplify/core";
// Add these imports with your other component imports
import CompDashboard from "./components/CompDashboard"; // Adjust path as needed
import ReportBuilder from "./components/ReportBuilder"; // Adjust path as needed

Amplify.configure(awsConfig);

function App() {
  const [userData, setUserData] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [currentView, setCurrentView] = useState('map'); // 'map', 'dashboard', 'report'
  const [reportData, setReportData] = useState(null); // For passing report data

  const API_URL = "https://3h3er97cni.execute-api.us-east-1.amazonaws.com/prod/user";

  const fetchUserData = async (currentUser) => {
    if (!currentUser) {
      console.warn("⚠️ fetchUserData() called with null currentUser.");
      return;
    }

    setLoading(true);

    try {
      const attributes = await fetchUserAttributes();
      const userEmail = attributes?.email || attributes?.preferred_username;

      if (!userEmail || !userEmail.includes("@")) {
        throw new Error("🚨 Invalid email format retrieved from Cognito.");
      }

      const authSession = await fetchAuthSession();
      const token = authSession.tokens?.idToken?.toString();

      if (!token) {
        console.error("🚨 No authentication token found.");
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}?user_email=${encodeURIComponent(userEmail)}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Error fetching user data: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setUserData(data.user);
        setNeedsProfileCompletion(data.needs_profile_completion);
      } else {
        console.warn("⚠️ User data fetch unsuccessful.");
      }
    } catch (error) {
      console.error("🚨 Failed to fetch user data:", error);
    }

    setLoading(false);
  };

  const refreshUserData = async () => {
    await fetchUserData(user);
  };

  const handleProfileUpdated = async () => {
    await fetchUserData(user);
    setNeedsProfileCompletion(false);
  };

  const handleEditProfile = () => {
    setIsEditingProfile(true);
    setNeedsProfileCompletion(true);
  };

  const handleCancel = () => {
    setIsEditingProfile(false);
    setNeedsProfileCompletion(false);
  };

  const checkUser = async () => {
    setLoading(true);
    try {
      const currentUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      const userEmail = attributes?.email || attributes?.preferred_username;

      const response = await fetch(`${API_URL}?user_email=${encodeURIComponent(userEmail)}`);
      const data = await response.json();

      if (data.success) {
        setUserData(data.user);
        setNeedsProfileCompletion(data.needs_profile_completion);
      } else {
        throw new Error("Failed to fetch user data");
      }

      setUser(currentUser);
    } catch (error) {
      console.warn("⚠️ No existing session found.");
      setUser(null);
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
      setUserData(null);
      setNeedsProfileCompletion(false);
    } catch (error) {
      console.error("🚨 Error signing out:", error);
    }
  };

  useEffect(() => {
    checkUser();

    const listener = Hub.listen("auth", ({ payload }) => {
      if (payload.event === "signedIn") {
        setUser(payload.data);
        fetchUserData(payload.data);
      } else if (payload.event === "signOut") {
        setUser(null);
        setUserData(null);
        setNeedsProfileCompletion(false);
      }
    });

    return () => listener();
  }, []);

  if (loading) {
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
            paddingLeft: "24px",
            boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
            margin: 0,
          }}
        >
          <img
            src="/factor_comps_logo.png"
            alt="Factor Comps"
            style={{ width: "200px", height: "auto" }}
          />
        </Box>

        <Box
          sx={{
            flexGrow: 1,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <CircularProgress size={60} />
        </Box>
      </Box>
    );
  }

  return (
    <SnackbarProvider
      maxSnack={3}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      autoHideDuration={3000}
      style={{
        // Position snackbars absolutely within the viewport
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        maxWidth: 'calc(100vw - 40px)'
      }}
      // Remove all container styling overrides
    >
      <Box sx={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative'
      }}>
      {user ? (
        needsProfileCompletion ? (
          <ProfileSetup
            userEmail={userData?.user_email}
            fetchUserData={fetchUserData}
            onProfileUpdated={handleProfileUpdated}
            isEditing={isEditingProfile}
            onSignOut={handleSignOut}
            onCancel={handleCancel}
          />
        ) : (
          currentView === 'map' ? (
            <MapPage
              user={user}
              userData={userData}
              onEditProfile={handleEditProfile}
              refreshUserData={refreshUserData}
              onNavigateToDashboard={() => setCurrentView('dashboard')}
            />
          ) : currentView === 'dashboard' ? (
            <CompDashboard
              onBackToMap={() => setCurrentView('map')}
              onOpenReport={(report) => {
                setReportData(report);
                setCurrentView('report');
              }}
            />
          ) : (
            <ReportBuilder
              savedReport={reportData}
              onBack={() => setCurrentView('dashboard')}
              onNavigateToMap={() => setCurrentView('map')}
              // ... other props
            />
          )
        )
      ) : (
        <SignIn onSignInSuccess={checkUser} />
      )}
      </Box>
    </SnackbarProvider>
  );
}

export default App;
