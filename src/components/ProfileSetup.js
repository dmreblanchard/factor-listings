import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Divider,
  FormControlLabel,
  Grid,
  InputAdornment,
  MenuItem,
  TextField,
  Typography
} from "@mui/material";
import {
  Business,
  Group,
  Person,
  Save,
  Cancel,
  Logout
} from "@mui/icons-material";

const ProfileSetup = ({ userEmail, fetchUserData, onProfileUpdated, isEditing, onSignOut, onCancel }) => {
  const API_URL = "https://tc3fvnrjqa.execute-api.us-east-1.amazonaws.com/prod/user";

  // Debug Log
  useEffect(() => {
    console.log("🟢 Received userEmail in ProfileSetup:", userEmail);
  }, [userEmail]);

  // State Variables
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [roleType, setRoleType] = useState("");
  const [office, setOffice] = useState("");
  const [team, setTeam] = useState("");
  const [listingsAcknowledgment, setlistingsAcknowledgment] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch user data when the component mounts or userEmail changes
  useEffect(() => {
    if (userEmail) {
      fetchUserProfile();
    }
  }, [userEmail]);

  // Fetch user profile data from the API
  const fetchUserProfile = async () => {
    try {
      const response = await fetch(`${API_URL}?user_email=${encodeURIComponent(userEmail)}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Error fetching user profile: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("🟢 Fetched User Profile Data:", data);

      // Populate form fields with existing data
      if (data.user) {
        setFirstName(data.user.first_name || "");
        setLastName(data.user.last_name || "");
        setRoleType(data.user.role_type || "");
        setOffice(data.user.office || "");
        setTeam(data.user.team || "");
        setlistingsAcknowledgment(data.user.listings_acknowledgment || false);
      }
    } catch (error) {
      console.error("🚨 Error fetching user profile:", error);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return; // Prevent multiple submissions

    // Ensure the checkbox is checked during registration
    if (!isEditing && !listingsAcknowledgment) {
      alert("You must acknowledge that listings data is company property to proceed.");
      return;
    }

    setLoading(true);

    const profileData = {
      user_email: userEmail,
      first_name: firstName,
      last_name: lastName,
      role_type: roleType,
      office: office,
      team: team,
      listings_acknowledgment: listingsAcknowledgment,
    };

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profileData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error updating profile: ${errorText}`);
      }

      const data = await response.json();
      await fetchUserData();
      onProfileUpdated();
    } catch (error) {
      console.error("🚨 Error updating profile:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f5f5f5",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          backgroundColor: "white",
          height: 70,
          display: "flex",
          alignItems: "center",
          px: 3,
          boxShadow: 1,
        }}
      >
        <img
          src="/factor_listings_logo.png"
          alt="Factor Listings"
          style={{ width: "200px", height: "auto" }}
        />
      </Box>

      {/* Main Content */}
      <Box
        sx={{
          flexGrow: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          p: 3,
        }}
      >
        <Card
          sx={{
            width: "100%",
            maxWidth: 500,
            boxShadow: 3,
          }}
        >
          <CardHeader
            title={
              <Typography variant="h6" component="div" sx={{ display: 'flex', alignItems: 'center' }}>
                <Person sx={{ mr: 1, color: 'action.active' }} />
                {isEditing ? "Edit Your Profile" : "Complete Your Profile"}
              </Typography>
            }
            sx={{
              backgroundColor: 'background.paper',
              borderBottom: 1,
              borderColor: 'divider',
            }}
          />

          <CardContent>
            <form onSubmit={handleSubmit}>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Person fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Person fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
              </Grid>

              <TextField
                select
                fullWidth
                label="Role"
                value={roleType}
                onChange={(e) => setRoleType(e.target.value)}
                required
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Person fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              >
                <MenuItem value="">Select Role</MenuItem>
                <MenuItem value="Analyst">Analyst</MenuItem>
                <MenuItem value="Associate">Associate</MenuItem>
                <MenuItem value="Director">Director</MenuItem>
                <MenuItem value="Partner">Partner</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </TextField>

              <TextField
                select
                fullWidth
                label="Office"
                value={office}
                onChange={(e) => setOffice(e.target.value)}
                required
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Business fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              >
                <MenuItem value="">Select Office</MenuItem>
                <MenuItem value="DFW">DFW</MenuItem>
                <MenuItem value="Houston">Houston</MenuItem>
                <MenuItem value="Central Texas">Central Texas</MenuItem>
                <MenuItem value="Phoenix">Phoenix</MenuItem>
              </TextField>

              <TextField
                select
                fullWidth
                label="Team"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                required
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Group fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              >
                <MenuItem value="">Select Team</MenuItem>
                <MenuItem value="Multi-Family">Multi-Family</MenuItem>
                <MenuItem value="Single-Family">Single-Family</MenuItem>
                <MenuItem value="Industrial">Industrial</MenuItem>
                <MenuItem value="None">None</MenuItem>
              </TextField>

              {!isEditing && (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: "italic" }}>
                    By proceeding, you acknowledge that all listing data is proprietary to the company and may be used for internal analysis. Unauthorized use or distribution is not permitted.
                  </Typography>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={listingsAcknowledgment}
                        onChange={(e) => setlistingsAcknowledgment(e.target.checked)}
                        color="primary"
                        required
                      />
                    }
                    label="I acknowledge."
                    sx={{ mb: 2 }}
                  />
                </>
              )}

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                startIcon={<Save />}
                disabled={loading}
                sx={{ mt: 1 }}
              >
                {loading ? "Saving..." : "Save Profile"}
              </Button>
            </form>

            {isEditing && (
              <>
                <Divider sx={{ my: 2 }} />
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<Cancel />}
                      onClick={onCancel}
                    >
                      Cancel
                    </Button>
                  </Grid>
                  <Grid item xs={6}>
                    <Button
                      variant="outlined"
                      color="error"
                      fullWidth
                      startIcon={<Logout />}
                      onClick={onSignOut}
                    >
                      Sign Out
                    </Button>
                  </Grid>
                </Grid>
              </>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default ProfileSetup;
