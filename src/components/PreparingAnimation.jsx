import React from "react";
import { Box, Typography, CircularProgress } from "@mui/material";

const PreparingAnimation = ({ isVisible }) => {
  if (!isVisible) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 1000,
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "white",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.2)",
        }}
      >
        <CircularProgress
          size={60}
          thickness={4}
          sx={{
            animation: "pulse 1.5s infinite",
            "@keyframes pulse": {
              "0%": { transform: "scale(1)", opacity: 1 },
              "50%": { transform: "scale(1.1)", opacity: 0.7 },
              "100%": { transform: "scale(1)", opacity: 1 },
            },
          }}
        />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Preparing Your Session
        </Typography>
      </Box>
    </Box>
  );
};

export default PreparingAnimation;
