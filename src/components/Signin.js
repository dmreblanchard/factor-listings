import React, { useState } from "react";
import { TextField, Button, Typography, Box, Link } from "@mui/material";
import {
  signUp,
  signIn,
  getCurrentUser,
  confirmSignUp,
  resetPassword,
  confirmResetPassword,
  resendSignUpCode,
} from "@aws-amplify/auth";

const SignIn = ({ onSignInSuccess }) => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    isSignUp: false,
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [isVerificationStep, setIsVerificationStep] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false); // Track forgot password state
  const [newPassword, setNewPassword] = useState(""); // New password for reset
  const [resetEmail, setResetEmail] = useState(""); // Email for password reset

  // Function to validate email domain
  const validateEmailDomain = (email) => {
    const allowedDomains = ["dmre.com", "ascentinv.com"];
    const domain = email.split("@")[1]; // Extract domain from email
    return allowedDomains.includes(domain);
  };

  const handleResendCode = async () => {
    const { email } = formData;

    if (!email) {
      setErrorMessage("Please enter your email address first.");
      return;
    }

    setIsSubmitting(true);
    try {
      await resendSignUpCode({ username: email });
      setErrorMessage("Verification code resent. Please check your inbox.");
    } catch (error) {
      setErrorMessage(error.message || "Failed to resend code. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAuth = async () => {
    const { email, password, isSignUp } = formData;
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      if (isSignUp) {
        // Validate email domain before proceeding
        if (!validateEmailDomain(email)) {
          setErrorMessage("Only @dmre.com and @ascentinv.com email addresses are allowed.");
          return;
        }

        const signUpResponse = await signUp({
          username: email,
          password,
          options: { userAttributes: { email } },
        });
        setIsVerificationStep(true);
      } else {
        const signInResponse = await signIn({ username: email, password });

        const user = await getCurrentUser();
        onSignInSuccess();
      }
    } catch (error) {
      // 🚨 NEW: If user is unconfirmed, show verification screen
      if (error.name === "UserNotConfirmedException") {
        setIsVerificationStep(true);
        setErrorMessage("Your account isn't verified yet. Please enter the code sent to your email.");
      } else {
        setErrorMessage(error.message || "Login failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerification = async () => {
    const { email, password } = formData;
    setIsSubmitting(true);
    try {
      await confirmSignUp({ username: email, confirmationCode: verificationCode });
      const signInResponse = await signIn({ username: email, password });
      const user = await getCurrentUser();

      setErrorMessage("");
      onSignInSuccess();
    } catch (error) {
      setErrorMessage(error.message || "Verification failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      setErrorMessage("Please enter your email address to reset your password.");
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword({ username: formData.email });
      setIsForgotPassword(true); // Move to reset code and new password step
      setResetEmail(formData.email); // Store the email for the reset process
      setErrorMessage(""); // Clear any previous error messages
    } catch (error) {
      setErrorMessage(error.message || "Failed to send reset code. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    setIsSubmitting(true);
    try {
      await confirmResetPassword({
        username: resetEmail,
        confirmationCode: verificationCode,
        newPassword: newPassword,
      });
      setErrorMessage("Password reset successful! You can now sign in.");
      setIsForgotPassword(false); // Return to login form
    } catch (error) {
      setErrorMessage(error.message || "Password reset failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

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

      {/* Centered Login/Signup Form */}
      <Box
        sx={{
          flexGrow: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          padding: "24px",
          margin: 0,
        }}
      >
        <Box
          sx={{
            backgroundColor: "white",
            padding: "32px",
            borderRadius: "8px",
            boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
            maxWidth: "500px",
            width: "100%",
            textAlign: "center",
          }}
        >
          <Typography variant="h5" gutterBottom>
            {formData.isSignUp ? "Create your account" : "Log in to your account"}
          </Typography>
          <Typography variant="body1" color="textSecondary">
            {formData.isSignUp ? "Welcome! Please enter your details." : "Welcome back! Please enter your details."}
          </Typography>

          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!isVerificationStep && !isForgotPassword) {
                handleAuth();
              }
            }}
            sx={{ mt: 3 }}
          >
            {isVerificationStep ? (
              <>
                <TextField
                  fullWidth
                  label="Verification Code"
                  variant="outlined"
                  name="verificationCode"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  required
                  sx={{ mb: 2 }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  fullWidth
                  onClick={handleVerification}
                  disabled={isSubmitting}
                >
                  Verify
                </Button>
                <Link
                  component="button"
                  variant="body2"
                  sx={{ display: "block", mt: 2 }}
                  onClick={handleResendCode}
                >
                  Didn't get a code? Resend verification code
                </Link>
              </>
            ) : isForgotPassword ? (
              <>
                <TextField
                  fullWidth
                  label="Reset Code"
                  variant="outlined"
                  name="verificationCode"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  required
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  label="New Password"
                  variant="outlined"
                  type="password"
                  name="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  sx={{ mb: 2 }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  fullWidth
                  onClick={handleResetPassword}
                  disabled={isSubmitting}
                >
                  Reset Password
                </Button>
              </>
            ) : (
              <>
                <TextField
                  fullWidth
                  label="Email"
                  variant="outlined"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  label="Password"
                  variant="outlined"
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  sx={{ mb: 2 }}
                />
                <Link
                  component="button"
                  variant="body2"
                  sx={{ display: "block", mb: 1 }}
                  onClick={handleForgotPassword}
                >
                  Forgot password?
                </Link>

                <Link
                  component="button"
                  variant="body2"
                  sx={{ display: "block", mb: 2 }}
                  onClick={() => {
                    const { email, password } = formData;
                    if (!email || !password) {
                      setErrorMessage("Please enter both your email and password first.");
                      return;
                    }
                    setIsVerificationStep(true);
                    setErrorMessage("Please enter the verification code we sent to your email.");
                  }}
                >
                  Need to verify your account?
                </Link>

                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  fullWidth
                  disabled={isSubmitting}
                >
                  {formData.isSignUp ? "Sign Up" : "Sign In"}
                </Button>
              </>
            )}
            {errorMessage && (
              <Typography color="error" sx={{ mt: 2 }}>
                {errorMessage}
              </Typography>
            )}
            <Link
              component="button"
              variant="body2"
              sx={{ display: "block", mt: 2 }}
              onClick={() => setFormData({ ...formData, isSignUp: !formData.isSignUp })}
            >
              {formData.isSignUp ? "Already have an account? Log in here." : "Need an account? Sign up here."}
            </Link>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default SignIn;
