import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormControlLabel,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import { Close, Check, Edit, OpenInNew } from '@mui/icons-material';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import { useSnackbar } from 'notistack';


// ========== CURRENCY INPUT COMPONENT ==========
const CurrencyInput = ({ value, onChange, label, priceType, ...props }) => {
  const [displayValue, setDisplayValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const allowDecimals = priceType === 'PSF';

  // Format value with appropriate decimal places (only used on blur)
  const formatValue = (num) => {
    if (num === null || num === undefined || num === '') return '';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: allowDecimals ? 2 : 0,
      maximumFractionDigits: allowDecimals ? 2 : 0
    }).format(num);
  };

  // Parse input to extract a number (preserving up to 2 decimals if allowed)
  const parseInput = (input) => {
    // Remove non-numeric characters (except the first decimal)
    let sanitized = input.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    if (allowDecimals && parts.length > 1) {
      sanitized = `${parts[0] || '0'}.${parts[1].substring(0, 2)}`;
    } else {
      sanitized = parts[0];
    }
    return parseFloat(sanitized) || 0;
  };

  // When the external value changes (and we're not editing), update the display value
  useEffect(() => {
    if (!isEditing) {
      setDisplayValue(formatValue(value));
    }
  }, [value, isEditing]);

  const handleChange = (e) => {
    const input = e.target.value;
    setIsEditing(true);
    if (allowDecimals) {
      // While editing PSF, show exactly what the user types
      setDisplayValue(input);
      onChange(parseInput(input));
    } else {
      const numValue = parseInput(input);
      setDisplayValue(formatValue(numValue));
      onChange(numValue);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    const numValue = parseInput(displayValue);
    const formatted = formatValue(numValue);
    setDisplayValue(formatted);
    onChange(numValue);
  };

  const handleFocus = (e) => {
    setIsEditing(true);
    // For PSF, clear out the formatted value so the user can type fresh
    if (allowDecimals) {
      setDisplayValue(value !== undefined && value !== null ? String(value) : '');
    }
  };

  return (
    <TextField
      {...props}
      label={label}
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      InputProps={{
        startAdornment: <InputAdornment position="start">$</InputAdornment>,
      }}
      fullWidth
      margin="normal"
    />
  );
};

// ========== MAIN MODAL COMPONENT ==========
const EditRowModal = ({ open, onClose, row, onSave }) => {
  // State management
  const [formData, setFormData] = useState({});
  const [priceType, setPriceType] = useState('Total');
  const [calculatedPrice, setCalculatedPrice] = useState(0);
  const [availableFocusedUseTypes, setAvailableFocusedUseTypes] = useState([]);
  const [availableConstructionTypes, setAvailableConstructionTypes] = useState([]);
  const { enqueueSnackbar } = useSnackbar();
  const [isSaving, setIsSaving] = useState(false);
  const [initialData, setInitialData] = useState({});

  // Reset all state when closing
  const handleClose = () => {
    setFormData({});
    setPriceType('Total');
    setCalculatedPrice(0);
    setAvailableFocusedUseTypes([]);
    setAvailableConstructionTypes([]);
    onClose();
  };

  // Add this function to handle save and close
  const handleSaveAndClose = async () => {
    await handleSave();
    onClose();
  };

  // Initialize form data when opening
  useEffect(() => {
    console.log('EditRowModal received row:', row); // Add this
    if (open) {
      const initialData = {
        ...row,
        primaryUseType: row.useType || row.primaryUseType || '',
        focusedUseType: row.focusedUse || row.focusedUseType || '',
        constructionType: row.constructionType || '',
        pricedAcreage: row.pricedAcreage || row.acreage || '',
        unitOrLotCount: row.lotCount || row.unitOrLotCount || '',
        priceDisplay: row.priceDisplay || 'Total',
        dealId: row.dealId,
        name: row.dealName || row.name || '',
      };
      console.log("Deal Name:", row.dealName);
      setFormData(initialData);
      setPriceType(initialData.priceDisplay);
      updateDependentFields(initialData.primaryUseType);

      // Calculate initial price for non-DMRE rows
      if (!row.isDMRE) {
        const initialCalculatedPrice = calculatePrice(initialData);
        setCalculatedPrice(initialCalculatedPrice);
      }
    }
  }, [open, row]); // Run when open or row changes

  // Update dependent fields
  const updateDependentFields = (primaryUseType) => {
    const focusedTypes = primaryUseType ? FOCUSED_USE_TYPES[primaryUseType] || [] : [];
    const constructionTypes = primaryUseType ? CONSTRUCTION_TYPES[primaryUseType] || [] : [];

    setAvailableFocusedUseTypes(focusedTypes);
    setAvailableConstructionTypes(constructionTypes);
    // Reset dependent fields if they're no longer valid
    setFormData(prev => {
      const newData = { ...prev };
      if (focusedTypes.length > 0 && !focusedTypes.includes(newData.focusedUseType)) {
        newData.focusedUseType = '';
      }
      if (constructionTypes.length > 0 && !constructionTypes.includes(newData.constructionType)) {
        newData.constructionType = '';
      }
      return newData;
    });
  };

  // Handle save
  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Prepare payload - only changed fields
      const payload = Object.keys(formData).reduce((acc, key) => {
        if (JSON.stringify(formData[key]) !== JSON.stringify(initialData[key])) {
          acc[key] = formData[key];
        }
        return acc;
      }, {});

      const response = await fetch(
        `https://3h3er97cni.execute-api.us-east-1.amazonaws.com/prod/comps/${row.dealId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Update failed');
      }

      // Call the original onSave with the updated data
      onSave({ ...row, ...payload });

      enqueueSnackbar('Deal updated successfully!', {
        variant: 'success',
        autoHideDuration: 3000
      });

      onClose();
    } catch (error) {
      console.error('Update error:', error);
      enqueueSnackbar(`Update failed: ${error.message}`, {
        variant: 'error',
        autoHideDuration: 5000
      });
    } finally {
      setIsSaving(false);
    }
  };

  const FIELD_PERMISSIONS = {
    // Fields editable for ALL deals (DMRE and non-DMRE)
    ALL_DEALS: [
      'dealName',               // Deal Name
      'primaryUseType',     // Primary Use Type (single picklist)
      'focusedUseType',     // Focused Use Type (multi-picklist)
      'constructionType'    // Construction Type (multi-picklist)
    ],

    // Additional fields editable only for non-DMRE deals
    NON_DMRE: [
      'dealStage',          // Sales Stage
      'compType',           // Comp Type
      'closeDate',          // Sales Date
      'pricingVerified',    // Comp Pricing Verified
      'priceDisplay',       // Price Type
      'pricedAcreage',      // Priced Acreage
      'unitOrLotCount',     // Unit or Lot Count
      'purchasePrice'       // Purchase Price
    ]
  };

  const PRIMARY_USE_TYPES = [
    'Single Family',
    'Multi-Family',
    'Industrial',
    'Commercial',
    'Investment',
    'Land Development',
    'Infrastructure',
    'Other',
    'Mixed Use'
  ];

  const FOCUSED_USE_TYPES = {
    // Single Family options
    'Single Family': [
      'Builder',
      'Single-Family for Rent',
      'Mobile Home',
      'Townhome',
      'Condo',
      'Master Planned Communities',
      'Lot Developer',
    ],
    // Multi-Family options
    'Multi-Family': [
      'Build-to-Rent',
      'Market',
      'Senior Living',
      'Active Adult',
      'Student Housing',
      'Tax Credit',
      'Workforce Housing',
    ],
    // Industrial options
    'Industrial': [
      'ISF',
      'Industrial Development',
      'Industrial Acquisitions',
      'Data Centers',
    ],
    // Commercial options
    'Commercial': [
      'Self-Storage',
      'Mixed-Use',
      'Retail',
      'Hospitality',
      'Office',
      'Healthcare',
      'Medical Office',
    ],
    // Other categories with all options
    'Investment': [
      'Investment',
      'Single-Family',
      'Multi-Family',
      'Industrial',
      'Commercial',
      'Land Development',
      'Infrastructure',
      'Other',
    ],
    'Land Development': [
      'Land Development',
    ],
    // Default options for other primary use types
    'Infrastructure': [
      'Infrastructure',
    ],
    'Other': [
      'Non-profit',
      'Church',
      'School',
      'Other',
    ],
    'Mixed Use': [
      'Builder',
      'Single-Family for Rent',
      'Mobile Home',
      'Townhome',
      'Condo',
      'Master Planned Communities',
      'Lot Developer',
      'Build-to-Rent',
      'Market',
      'Senior Living',
      'Active Adult',
      'Student Housing',
      'Tax Credit',
      'Workforce Housing',
      'ISF',
      'Industrial Development',
      'Industrial Acquisitions',
      'Data Centers',
      'Self-Storage',
      'Mixed-Use',
      'Retail',
      'Hospitality',
      'Office',
      'Healthcare',
      'Medical Office',
      'Investment',
      'Single-Family',
      'Multi-Family',
      'Industrial',
      'Commercial',
      'Land Development',
      'Infrastructure',
      'Other',
      'Land Development',
      'Infrastructure',
      'Non-profit',
      'Church',
      'School',
      'Other',
    ],
  };

  const CONSTRUCTION_TYPES = {
    // Single Family options
    'Single Family': [
      'Raw Land',
      'Paper Lot',
      'Finished Lot',
      'MUD Play'
    ],
    // Multi-Family options
    'Multi-Family': [
      'Garden',
      'Surface Park',
      'Wrap',
      'Podium',
      'Mid Rise',
      'High Rise',
      'Individually platted',
      'Single plat',
    ],
    // Industrial options
    'Industrial': [
      'Warehouse',
      'Outdoor Storage',
      'Rear-load',
      'Front-load',
      'Cross-Dock',
      'Re-Development',
      'Re-Purpose',
      'Smaller, shallow bay (<200k sqft)',
      'Larger, big box product (>200k sqft)',
      'Flex Warehouse',
      'Higher finish',
      'User'
    ],
    // Default options for other primary use types
    'default': [
    ]
  };

  const isNonDMRE = !row.isDMRE;

  // Initialize form data
  useEffect(() => {
    const initialData = {
      ...row,
      primaryUseType: row.useType || row.primaryUseType || '',
      focusedUseType: row.focusedUse || row.focusedUseType || '',
      constructionType: row.constructionType || '',
      pricedAcreage: row.pricedAcreage || row.acreage || '',
      unitOrLotCount: row.lotCount || row.unitOrLotCount || '',
      priceDisplay: row.priceDisplay || 'Total', // Make sure priceDisplay is set
      dealId: row.dealId || '',
      name: row.dealName || row.name || '',
    };

    setFormData(initialData);
    updateDependentFields(initialData.primaryUseType);

    // Calculate initial price
    if (!row.isDMRE) {
      const initialCalculatedPrice = calculatePrice(initialData);
      setCalculatedPrice(initialCalculatedPrice);
    }
  }, [row]);

  // In your EditRowModal component, update the handleChange function like this:
  const handleChange = (field, value) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: value,
        priceDisplay: priceType // Ensure current price type is always used
      };

      if (isNonDMRE) {
        const newCalculatedPrice = calculatePrice(newData);
        setCalculatedPrice(newCalculatedPrice);
        return { ...newData, calculatedPrice: newCalculatedPrice };
      }

      return newData;
    });
  };

  // Calculate price based on type
  const calculatePrice = (data) => {
    const { priceDisplay, purchasePrice, pricedAcreage, unitOrLotCount } = data;

    // Return 0 if we don't have required values
    if (!priceDisplay || purchasePrice === undefined || purchasePrice === null) {
      return 0;
    }

    // Convert to numbers just in case
    const price = Number(purchasePrice) || 0;
    const acreage = Number(pricedAcreage) || 0;
    const count = Number(unitOrLotCount) || 0;

    switch(priceDisplay) {
      case 'Total':
        return price;
      case 'PSF':
        return (acreage * 43560) * price;
      case 'per Acre':
        return price * acreage;
      default:
        return price * count;
    }
  };

  // Initialize form data when opening
  useEffect(() => {
    if (open) {
      const initialData = {
        ...row,
        primaryUseType: row.useType || row.primaryUseType || '',
        focusedUseType: row.focusedUse || row.focusedUseType || '',
        constructionType: row.constructionType || '',
        pricedAcreage: row.pricedAcreage || row.acreage || '',
        unitOrLotCount: row.lotCount || row.unitOrLotCount || '',
        priceDisplay: row.priceDisplay || 'Total',
        dealId: row.dealId || '',
        name: row.dealName || row.name || '',        
      };

      setFormData(initialData);
      setPriceType(initialData.priceDisplay);
      updateDependentFields(initialData.primaryUseType);

      if (!row.isDMRE) {
        const initialCalculatedPrice = calculatePrice(initialData);
        setCalculatedPrice(initialCalculatedPrice);
      }
    }
  }, [open, row]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: 24,
          position: 'relative',
          overflow: 'visible'
        }
      }}
    >

      <DialogTitle sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={2}>
            <EditNoteOutlinedIcon sx={{ color: "primary.main" }} />
            <Typography variant="h6" fontWeight="bold" component="div">
              Edit Deal: {row.dealName}
            </Typography>
          </Box>
          <Box>
            <Button
              onClick={onClose}
              color="inherit"
              sx={{ minWidth: 0 }}
            >
              <CloseIcon fontSize="medium" />
            </Button>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3 }}>
        {/* Common Fields */}
        <TextField
          label="Deal Name"
          value={formData.name || ''}
          onChange={(e) => handleChange('name', e.target.value)}
          fullWidth
          margin="normal"
          sx={{ mb: 2 }}
        />

        <FormControl fullWidth margin="normal" sx={{ mb: 2 }}>
          <InputLabel>Primary Use Type</InputLabel>
          <Select
            value={formData.primaryUseType || ''}
            onChange={(e) => {
              handleChange('primaryUseType', e.target.value);
              updateDependentFields(e.target.value);
            }}
            label="Primary Use Type"
          >
            {PRIMARY_USE_TYPES.map(type => (
              <MenuItem key={type} value={type}>{type}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Conditional Fields */}
        {availableFocusedUseTypes.length > 0 && (
          <FormControl fullWidth margin="normal" sx={{ mb: 2 }}>
            <InputLabel>Focused Use Type</InputLabel>
            <Select
              value={formData.focusedUseType || ''}
              onChange={(e) => handleChange('focusedUseType', e.target.value)}
              label="Focused Use Type"
            >
              {availableFocusedUseTypes.map(type => (
                <MenuItem key={type} value={type}>{type}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {availableConstructionTypes.length > 0 && (
          <FormControl fullWidth margin="normal" sx={{ mb: 2 }}>
            <InputLabel>Construction Type</InputLabel>
            <Select
              value={formData.constructionType || ''}
              onChange={(e) => handleChange('constructionType', e.target.value)}
              label="Construction Type"
            >
              {availableConstructionTypes.map(type => (
                <MenuItem key={type} value={type}>{type}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* Non-DMRE Fields */}
        {!row.isDMRE && (
          <>
            <FormControl fullWidth margin="normal" sx={{ mb: 2 }}>
              <InputLabel>Sales Stage</InputLabel>
              <Select
                value={formData.dealStage || ''}
                onChange={(e) => handleChange('dealStage', e.target.value)}
                label="Sales Stage"
              >
                <MenuItem value="Under Contract">Under Contract</MenuItem>
                <MenuItem value="Closed">Closed</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth margin="normal" sx={{ mb: 2 }}>
              <InputLabel>Comp Type</InputLabel>
              <Select
                value={formData.compType || ''}
                onChange={(e) => handleChange('compType', e.target.value)}
                label="Comp Type"
              >
                <MenuItem value="Land">Land</MenuItem>
                <MenuItem value="MF">Multifamily</MenuItem>
                <MenuItem value="Redevelopment">Redevelopment</MenuItem>
                <MenuItem value="Investment">Investment</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Sales Date"
              type="date"
              value={formData.closeDate || ''}
              onChange={(e) => handleChange('closeDate', e.target.value)}
              fullWidth
              margin="normal"
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2 }}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.pricingVerified || false}
                  onChange={(e) => handleChange('pricingVerified', e.target.checked)}
                />
              }
              label="Pricing Verified"
              sx={{ mb: 2 }}
            />

            {/* Pricing Section */}
            <FormControl fullWidth margin="normal" sx={{ mb: 2 }}>
              <InputLabel>Price Type</InputLabel>
              <Select
                value={priceType}
                onChange={(e) => {
                  setPriceType(e.target.value);
                  handleChange('priceDisplay', e.target.value);
                }}
                label="Price Type"
              >
                <MenuItem value="Total">Total</MenuItem>
                <MenuItem value="PSF">Price per Square Foot</MenuItem>
                <MenuItem value="per Acre">Price per Acre</MenuItem>
                <MenuItem value="per Unit">Price per Unit</MenuItem>
                <MenuItem value="per Paper Lot">Price per Paper Lot</MenuItem>
                <MenuItem value="per Finished Lot">Price per Finished Lot</MenuItem>
              </Select>
            </FormControl>

            {priceType === 'PSF' || priceType === 'per Acre' ? (
              <TextField
                label={priceType === 'PSF' ? "Priced Acreage" : "Acreage"}
                type="number"
                value={formData.pricedAcreage || ''}
                onChange={(e) => handleChange('pricedAcreage', parseFloat(e.target.value))}
                fullWidth
                margin="normal"
                inputProps={{ step: "0.01" }}
                sx={{ mb: 2 }}
              />
            ) : null}

            {priceType === 'per Unit' || priceType === 'per Paper Lot' || priceType === 'per Finished Lot' ? (
              <TextField
                label="Unit/Lot Count"
                type="number"
                value={formData.unitOrLotCount || ''}
                onChange={(e) => handleChange('unitOrLotCount', parseInt(e.target.value))}
                fullWidth
                margin="normal"
                sx={{ mb: 2 }}
              />
            ) : null}

            <CurrencyInput
              label={getPriceFieldLabel(priceType)}
              value={formData.purchasePrice}
              onChange={(value) => handleChange('purchasePrice', value)}
              priceType={priceType}
              sx={{ mb: 2 }}
            />

            <TextField
              label="Calculated Total Price"
              value={new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
              }).format(calculatedPrice)}
              InputProps={{ readOnly: true }}
              fullWidth
              margin="normal"
            />
          </>
        )}
      </DialogContent>

      <DialogActions sx={{
        p: 3,
        borderTop: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        justifyContent: 'space-between', // Aligns items to opposite ends
        alignItems: 'center'
      }}>
        {/* Cloud icon in lower-left */}
        <Tooltip title="Open in Salesforce" placement="top">
          <IconButton
            href={`https://dmre.lightning.force.com/lightning/r/ascendix__Deal__c/${row.dealId}/view`}
            target="_blank"
            rel="noopener"
            sx={{
              backgroundColor: 'white',
              boxShadow: 3,
              '&:hover': {
                backgroundColor: '#f5f5f5'
              }
            }}
          >
            <CloudOutlinedIcon color="primary" />
          </IconButton>
        </Tooltip>

        {/* Save button in lower-right */}
        <Button
          onClick={handleSaveAndClose}
          variant="contained"
          startIcon={<CheckIcon fontSize="small" />}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Helper function to get the appropriate price field label
function getPriceFieldLabel(priceType) {
  switch(priceType) {
    case 'Total': return 'Total Price';
    case 'PSF': return 'Price per Square Foot';
    case 'per Acre': return 'Price per Acre';
    case 'per Unit': return 'Price per Unit';
    case 'per Paper Lot': return 'Price per Paper Lot';
    case 'per Finished Lot': return 'Price per Finished Lot';
    default: return 'Purchase Price';
  }
}

// Helper function to pick specific properties from an object
function pick(obj, keys) {
  return keys.reduce((acc, key) => {
    if (obj.hasOwnProperty(key)) {
      acc[key] = obj[key];
    }
    return acc;
  }, {});
}

export default EditRowModal;
