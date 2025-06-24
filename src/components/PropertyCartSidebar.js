import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  IconButton,
  Button,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  Divider,
  Typography,
  Badge
} from "@mui/material";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import CircularProgress from '@mui/material/CircularProgress';
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import CloseIcon from "@mui/icons-material/Close";
import ClearAllIcon from "@mui/icons-material/ClearAll";

const PropertyCartSidebar = ({ cartOpen, setCartOpen, cartItems, togglePolygonSelection, setShowReport, setCartItems, setSelectedPolygons, onClearAll, setReportData }) => {

  const [isLoading, setIsLoading] = useState(false);
  const handleRemoveAll = () => {
    onClearAll();  // Use the passed function
  };

  const handleBuildReport = async () => {
    if (cartItems.length === 0) return;

    setIsLoading(true);
    try {
      // Assuming single listing selection
      const listingId = cartItems[0].properties.listingId;

      const response = await fetch(
        `https://tc3fvnrjqa.execute-api.us-east-1.amazonaws.com/prod/listings/${listingId}/report-data`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            // Add authorization header if needed
            // 'Authorization': `Bearer ${userToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setReportData(data); // Pass data to parent component
      setCartOpen(false);
      setShowReport(true);

    } catch (error) {
      console.error('Failed to fetch report data:', error);
      // Add error handling (e.g., show snackbar/toast)
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={cartOpen}
      onClose={() => setCartOpen(false)}
      PaperProps={{ sx: { width: 400, display: "flex", flexDirection: "column", boxShadow: 3 } }}
    >
      {/* Sidebar Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          p: 2,
          borderBottom: "1px solid #ddd",
          backgroundColor: "white",
        }}
      >
        {/* Title & Icon */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <LocationOnOutlinedIcon sx={{ color: "primary.main" }} />
          <Typography variant="h6" fontWeight="bold">
            Selected Listing
          </Typography>
        </Box>

        {/* Close Button */}
        <Tooltip title="Close Sidebar">
          <IconButton onClick={() => setCartOpen(false)}>
            <CloseIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Property List */}
      <Box sx={{ flexGrow: 1, overflowY: "auto", backgroundColor: "#FAFAFA" }}>
        <List>
          {cartItems.length === 0 ? (
            <Typography sx={{ textAlign: "center", py: 4, color: "gray" }}>
              No listings selected.
            </Typography>
          ) : (
            cartItems.map((item) => (
              <React.Fragment key={item.id}>
                <ListItem
                  secondaryAction={
                    <Tooltip title="Remove">
                      <IconButton
                        edge="end"
                        color="error"
                        onClick={() => togglePolygonSelection(item.id)}
                      >
                        <DeleteOutlineIcon />
                      </IconButton>
                    </Tooltip>
                  }
                  sx={{
                    p: 2,
                    "&:hover": { backgroundColor: "rgba(0, 0, 0, 0.05)" },
                  }}
                >
                  <ListItemText
                    primary={item.properties?.listingName || `Site ${item.id}`}
                    secondary={`${item.properties?.acreage || "?"} acres`}
                  />
                </ListItem>
                <Divider />
              </React.Fragment>
            ))
          )}
        </List>
      </Box>

      {/* Actions Section */}
      <Box sx={{ p: 3, borderTop: "1px solid #ddd", backgroundColor: "white" }}>
      {/* Remove All Button */}
        <Button
          fullWidth
          variant="outlined"
          color="error"
          startIcon={<ClearAllIcon />}
          onClick={handleRemoveAll}
          disabled={cartItems.length === 0}
          sx={{ mb: 2 }}
        >
          Remove All
        </Button>
        {/* Clear All Button */}
        <Button
          fullWidth
          variant="contained"
          color="primary"
          startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <InsertDriveFileOutlinedIcon />}
          onClick={handleBuildReport}
          disabled={cartItems.length === 0 || isLoading}
        >
          {isLoading ? 'Building Report...' : 'Build Listing Report'}
        </Button>
      </Box>
    </Drawer>
  );
};

export default PropertyCartSidebar;
