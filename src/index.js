import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CssBaseline } from "@mui/material";
import { Amplify } from "aws-amplify";
import awsConfig from "./aws-exports";  // Import Amplify configuration

// ✅ Configure Amplify
Amplify.configure(awsConfig);
//console.log("Amplify Configured:", awsConfig);  // Debugging log

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <CssBaseline />
    <App />
  </React.StrictMode>
);
