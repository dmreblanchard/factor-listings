import React, { useState } from "react";
import {
  Box,
  Drawer,
  Typography,
  IconButton,
  ListItem,
  ListItemText,
  Checkbox,
  FormGroup,
  FormControlLabel,
  Collapse,
  TextField,
  Button,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import CheckIcon from "@mui/icons-material/Check";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";

const PropertyFilterSidebar = ({
  filterOpen,
  setFilterOpen,
  selectedUseTypes,
  setSelectedUseTypes,
  minAcreage,
  setMinAcreage,
  maxAcreage,
  setMaxAcreage,
  minCloseDate,
  setMinCloseDate,
  handleApplyFilters,
}) => {
  const [openSections, setOpenSections] = useState({
    propertyTypes: true,
    acreage: false,
    closeDate: false,
  });

  const propertyTypes = [
    "Single Family",
    "Multi-Family",
    "Industrial",
    "Commercial",
    "Investment",
    "Land Development",
    "Infrastructure",
    "Other",
  ];

  const toggleSection = (section) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <Drawer
      anchor="left"
      open={filterOpen}
      onClose={() => setFilterOpen(false)}
      PaperProps={{ sx: { width: 350, boxShadow: 3 } }}
    >
      {/* Header with Funnel Icon */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 2, borderBottom: "1px solid #ddd" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <FilterAltOutlinedIcon sx={{ color: "primary.main" }} />
          <Typography variant="h6" fontWeight="bold">
            Filter Sites
          </Typography>
        </Box>
        <IconButton onClick={() => setFilterOpen(false)}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Filter Sections */}
      <Box sx={{ flexGrow: 1, overflowY: "auto", p: 2 }}>
        {/* Property Types Section */}
        <Box>
          <ListItem button onClick={() => toggleSection("propertyTypes")}>
            <ListItemText primary="Property Types" sx={{ fontWeight: "medium" }} />
            {openSections.propertyTypes ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </ListItem>
          <Collapse in={openSections.propertyTypes} timeout="auto" unmountOnExit>
            <FormGroup sx={{ pl: 2 }}>
              {propertyTypes.map((type) => (
                <FormControlLabel
                  key={type}
                  control={
                    <Checkbox
                      checked={selectedUseTypes.includes(type)}
                      onChange={(e) => {
                        setSelectedUseTypes((prev) =>
                          e.target.checked ? [...prev, type] : prev.filter((u) => u !== type)
                        );
                      }}
                    />
                  }
                  label={type}
                />
              ))}
            </FormGroup>
          </Collapse>
        </Box>

        {/* Acreage Section */}
        <Box>
          <ListItem button onClick={() => toggleSection("acreage")}>
            <ListItemText primary="Acreage" sx={{ fontWeight: "medium" }} />
            {openSections.acreage ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </ListItem>
          <Collapse in={openSections.acreage} timeout="auto" unmountOnExit>
            <Box sx={{ pl: 2, pt: 1, display: "flex", gap: 1 }}>
              <TextField
                label="Min Acreage"
                type="number"
                fullWidth
                value={minAcreage}
                onChange={(e) => setMinAcreage(e.target.value)}
              />
              <TextField
                label="Max Acreage"
                type="number"
                fullWidth
                value={maxAcreage}
                onChange={(e) => setMaxAcreage(e.target.value)}
              />
            </Box>
          </Collapse>
        </Box>

        {/* Close Date Section */}
        <Box>
          <ListItem button onClick={() => toggleSection("closeDate")}>
            <ListItemText primary="Close Date" sx={{ fontWeight: "medium" }} />
            {openSections.closeDate ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </ListItem>
          <Collapse in={openSections.closeDate} timeout="auto" unmountOnExit>
            <Box sx={{ pl: 2, pt: 1 }}>
              <TextField
                label="On or after"
                type="date"
                fullWidth
                value={minCloseDate || ''}
                onChange={(e) => setMinCloseDate(e.target.value)}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Box>
          </Collapse>
        </Box>
      </Box>

      {/* Apply Filters Button */}
      <Box sx={{ p: 2, borderTop: "1px solid #ddd" }}>
        <Button
          fullWidth
          variant="contained"
          color="primary"
          startIcon={<CheckIcon />}
          onClick={() => {
            setFilterOpen(false);
            handleApplyFilters();
          }}
        >
          Apply Filters
        </Button>
      </Box>
    </Drawer>
  );
};

export default PropertyFilterSidebar;
