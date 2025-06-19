// components/ReportBuilder.js
import React, { useState, useEffect } from "react";
import { Box, Typography, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, useTheme, useMediaQuery } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import ColumnSettingsModal from "./ColumnSettingsModal";
import EditRowModal from './EditRowModal';
import EditIcon from '@mui/icons-material/Edit';
import TextField from "@mui/material/TextField";
import CloseIcon from "@mui/icons-material/Close";
import { DndContext, closestCenter } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import PropTypes from 'prop-types';
import { generatePDFReport } from './PDFgenerator';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';
import TableRowsOutlinedIcon from '@mui/icons-material/TableRowsOutlined';
import CompPreview from "./CompPreview";
import CircularProgress from '@mui/material/CircularProgress';
import CheckIcon from '@mui/icons-material/Check';
import { generateMapboxStaticUrl } from './generateMap'; // assuming you saved it as generateMap.js

// Helper functions for formatting
function formatCloseDate(value, formatOption) {
  if (!value) return "";

  const date = new Date(value);
  if (isNaN(date.getTime())) {
    console.warn("Invalid date:", value);
    return "";
  }

  switch (formatOption) {
    case "Month/Year":
      return date.toLocaleString("default", { month: "short", year: "numeric" });
    case "Quarter/Year":
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `Q${quarter} ${date.getFullYear()}`;
    case "Year":
      return `${date.getFullYear()}`;
    default:
      return date.toLocaleDateString();
  }
}

function formatDollar(value) {
  if (value === null || value === undefined || value === '') return "";
  const num = Number(value);
  return isNaN(num)
    ? ""
    : `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatInteger(value) {
  if (value === null || value === undefined) return "";
  const num = Number(value);
  return isNaN(num) ? "" : Math.round(num).toString();
}

function formatFloat(value) {
  if (value === null || value === undefined) return "";
  const num = Number(value);
  return isNaN(num) ? "" : num.toFixed(2);
}

const ReportBuilder = ({ cartItems, setCartItems, onBack, onRemoveItem, onPreviewPDF, drawnFeatures, userData, savedReport, onNavigateToMap, isEditingReport, onReturnToMap, initialGeoData, reportId, reportStatus, onContextUpdate, liveRows, setLiveRows, ...props }) => {

  console.log("🧠 Geojson received in ReportBuilder:", initialGeoData);
  console.log("🧠 Geojson received from Edit Request:", savedReport?.geo_data);
  console.log("Current report ID:", reportId);
  console.log("Current status:", reportStatus);
  console.log("Cart Items: ", cartItems);
  // Add to your state
  const [isRowModalOpen, setIsRowModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [currentRow, setCurrentRow] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [refreshKey, setRefreshKey] = useState(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [showPreview, setShowPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [generatedComment, setGeneratedComment] = useState("");
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [sortModel, setSortModel] = useState([]);
  const [reportGeoData, setReportGeoData] = useState(() => {
    if (savedReport?.geo_data) {
      try {
        return typeof savedReport.geo_data === 'string'
          ? JSON.parse(savedReport.geo_data)
          : savedReport.geo_data;
      } catch (e) {
        console.error("🛑 Failed to parse saved report geo_data:", e);
        return null;
      }
    }
    return initialGeoData || null;
  });
  // Transform cartItems to rows when they change
  useEffect(() => {
    const newRows = cartItems.map(item => ({
      ...item.properties,
      id: item.id,
      dealId: item.properties.dealId
    }));
    setRows(newRows);
  }, [cartItems]);

  useEffect(() => {
    if (initialGeoData) {
      setReportGeoData(initialGeoData);
    }
  }, [initialGeoData]);

  const handleEdit = (row) => {
    setCurrentRow({
      ...row,
      dealId: row.dealId // Ensure dealId is included
    });
    setEditModalOpen(true);
    console.log('Editing row with dealId:', row.dealId); // Add this line
  };

  // In ReportBuilder.js
  const handleInternalPreview = async () => {
    setIsGeneratingPDF(true);

    try {
      // Get ordered rows with masking applied
      const orderedRows = rowOrder
        .map(id => rows.find(row => row.id === id || row.dealId === id))
        .filter(Boolean)
        .map((row, index) => {
          // Check if we need to mask close date for this row
          const closeDateSetting = columnSettings.find(c => c.field === "closeDate");
          const shouldMask = closeDateSetting?.maskUnderContract;

          // Apply masking if enabled and deal is Under Contract
          const closeDate = (shouldMask && row.dealStage === "Under Contract")
            ? "-"
            : row.closeDate;

          return {
            ...row, // Spread all existing properties
            closeDate, // Override closeDate if masking applies
            rowNumber: index + 1 // Explicitly add row numbers
          };
        });

      const visibleColumns = columnsToShow.filter(col => col.field !== 'actions');

      // Filter AND reorder GeoJSON to match the row order
      const orderedGeoData = {};
      if (reportGeoData) {
        // Create ordered array of features based on rowOrder
        rowOrder.forEach((id, index) => {
          const row = rows.find(r => r.id === id || r.dealId === id);
          if (!row) return;

          const featureId = row.id || row.dealId;
          const originalFeature = reportGeoData[featureId];
          if (!originalFeature) return;

          // Create new feature with updated properties
          orderedGeoData[featureId] = {
            ...originalFeature,
            properties: {
              ...originalFeature.properties,
              rowNumber: index + 1 // Match the tabular report numbering
            }
          };
        });

        // Debugging: Verify the order
        console.log("Order verification:", {
          tableRows: orderedRows.map(r => ({ id: r.id, number: r.rowNumber })),
          geoFeatures: Object.values(orderedGeoData).map(f => ({
            id: f.properties.id || f.properties.dealId,
            number: f.properties.rowNumber
          }))
        });
      }

      // Generate both PDFs
      const { tabularPDF, mapPDF } = await generatePDFReport(
        orderedRows,
        visibleColumns,
        reportTitle,
        { orientation: 'landscape' },
        orderedGeoData // Now properly ordered
      );

      // Create blob from the tabular PDF (arraybuffer)
      const pdfBlob = new Blob([tabularPDF], { type: 'application/pdf' });
      const pdfUrl = URL.createObjectURL(pdfBlob);

      const updatePreview = (comment = "") => {
        if (onPreviewPDF) {
          onPreviewPDF(pdfUrl, {
            reportTitle,
            user_email: userData?.user_email,
            rowOrder,
            columnSettings,
            drawnFeatures,
            selectedRows: orderedRows, // Use the ordered rows
            comment: comment,
            isCommentLoading: !comment,
            report_data: orderedRows,
            status: reportStatus,
            id: savedReport?.id || null,
            report_id: reportId || null,
            geoData: orderedGeoData,
            mapPDF: mapPDF,
            currentRows: rows,
            currentCartItems: cartItems,
            currentRowOrder: rowOrder
          });
        }
      };

      updatePreview(generatedComment);

      // Generate AI comment in background
      generateCompComment(reportTitle, orderedRows)
        .then(comment => {
          setGeneratedComment(comment);
          updatePreview(comment);
        })
        .catch(error => {
          console.error("Background comment generation failed:", error);
        });

    } catch (error) {
      console.error("Failed to generate PDF:", error);
      // Optional: Add user feedback here
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const generateCompComment = async (reportTitle, selectedRows) => {
    try {
      const response = await fetch("https://3h3er97cni.execute-api.us-east-1.amazonaws.com/prod/comps/create/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportTitle,
          comps: selectedRows,
        }),
      });

      const data = await response.json();
      return data.comment || "";
    } catch (error) {
      console.error("🛑 Error generating comp comment:", error);
      return "";
    }
  };

  const handleSaveChanges = async (updatedData) => {
    try {
      // 1. Optimistic update
      setRows(prevRows => {
        const updatedRows = prevRows.map(row =>
          row.dealId === updatedData.dealId ? { ...row, ...updatedData } : row
        );
        console.log("Updated row in ReportBuilder:", updatedRows.find(r => r.dealId === updatedData.dealId));
        return updatedRows;
      });

      // 2. Update cartItems (pass-through to keep both in sync)
      setCartItems(prevItems =>
        prevItems.map(item =>
          item.properties.dealId === updatedData.dealId
            ? {
                ...item,
                properties: {
                  ...item.properties,
                  ...updatedData
                }
              }
            : item
        )
      );

      // 3. Optional: Pull fresh data
      const refreshResponse = await fetch(
        `https://3h3er97cni.execute-api.us-east-1.amazonaws.com/prod/comps/${updatedData.dealId}`
      );
      const freshData = await refreshResponse.json();

      // 4. Use refreshed data in both places
      setRows(prevRows =>
        prevRows.map(row =>
          row.dealId === updatedData.dealId ? { ...row, ...freshData } : row
        )
      );
      setCartItems(prevItems =>
        prevItems.map(item =>
          item.properties.dealId === updatedData.dealId
            ? {
                ...item,
                properties: {
                  ...item.properties,
                  ...freshData
                }
              }
            : item
        )
      );

      return true;
    } catch (error) {
      console.error('Failed to save changes:', error);
      return false;
    }
  };

  const RowOrderModal = React.memo(({ open, onClose, rows, rowOrder, setRowOrder }) => {
    const handleModalDragEnd = (event) => {
      const { active, over } = event;
      if (active?.id !== over?.id) {
        setRowOrder((items) => {
          const oldIndex = items.indexOf(active.id);
          const newIndex = items.indexOf(over.id);
          return arrayMove(items, oldIndex, newIndex);
        });
      }
    };

    // Update your sortable row component for a softer look:
    const SortableRow = ({ id, row }) => {
      const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
      const style = {
        transform: CSS.Transform.toString(transform),
        transition: transition || 'none',
        display: 'flex',
        alignItems: 'center',
        padding: '12px',
        borderBottom: '1px solid #ddd', // subtle bottom border only
        backgroundColor: '#fff',
        borderTopLeftRadius: '8px',      // slight rounding on top
        borderTopRightRadius: '8px',
        //touchAction: 'none',             // ensure touch events work correctly
      };

      return (
        <div ref={setNodeRef} style={style} {...attributes}>
          <Box {...listeners} sx={{ cursor: 'grab', mr: 2, touchAction: 'none' }}>
            <DragIndicatorIcon />
          </Box>
          {/* Conditionally render the DMRE logo */}
          {row.isDMRE && (
            <img
              src="https://factor-mind-assets.s3.us-east-1.amazonaws.com/Logomark_blue.png"
              alt="DMRE Deal"
              style={{ width: 16, height: 16, marginRight: 8 }}
            />
          )}
          <Typography variant="body1">
            {row.dealName} • {row.useType} • {row.acreage} acres
          </Typography>
        </div>
      );
    };

    const MemoizedSortableRow = React.memo(SortableRow);

    return (
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" transitionDuration={0}>
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <TableRowsOutlinedIcon color="primary" />
              <Typography variant="h6" fontWeight="bold">Reorder Rows</Typography>
            </Box>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={handleModalDragEnd}
          >
            <SortableContext items={rowOrder} strategy={verticalListSortingStrategy}>
              {rowOrder.map((id) => {
                const row = rows.find((r) => r.id === id);
                return row ? <MemoizedSortableRow key={id} id={id} row={row} /> : null;
              })}
            </SortableContext>
          </DndContext>
        </DialogContent>
        {/* Removed DialogActions so no "Done" button appears */}
      </Dialog>
    );
  });


  const SortableRow = ({ id, row }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
    } = useSortable({ id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition: transition || 'none', // Remove default transition
      display: 'flex',
      alignItems: 'center',
      padding: '12px',
      marginBottom: '8px',
      border: '1px solid #eee',
      borderRadius: '4px',
      backgroundColor: 'white',
      touchAction: 'none',
    };

    return (
      <div ref={setNodeRef} style={style} {...attributes}>
        <DragIndicatorIcon
          sx={{
            mr: 2,
            cursor: 'move',
            color: 'action.active',
          }}
          {...listeners}
        />
        <Typography variant="body1">
          {row.dealName} • {row.useType} • {row.acreage} acres
        </Typography>
      </div>
    );
  };

  const MemoizedSortableRow = React.memo(SortableRow);

  console.log('Saved report data type:', {
    title: typeof savedReport?.title,
    column_settings: typeof savedReport?.column_settings,
    row_order: typeof savedReport?.row_order,
    report_data: typeof savedReport?.report_data
  });

  // First, define all state that doesn't depend on other variables
  const [reportTitle, setReportTitle] = useState(() => {
    if (savedReport?.title) return savedReport.title;
    try {
      const savedTitle = localStorage.getItem("compReportTitle");
      return savedTitle || "Comps Report Builder";
    } catch (e) {
      console.error("Failed to load report title:", e);
      return "Comps Report Builder";
    }
  });

  const fullColumns = [
    {
      field: "isDMRE",
      headerName: "DMRE",
      width: isMobile ? 100 : 120, // Smaller on mobile
      sortable: true,
      filterable: false,
      disableColumnMenu: true,
      sticky: true, // This makes the column stick to the left
      renderCell: (params) => {
        return params.row.isDMRE ? (
          <img
            src="https://factor-mind-assets.s3.us-east-1.amazonaws.com/Logomark_blue.png"
            alt="DMRE Deal"
            style={{ width: 24, height: 24 }}
          />
        ) : null;
      },
    },
    {
      field: "compPrice",
      headerName: "Comp Price",
      width: isMobile ? 130 : 160, // Wider on mobile to show full header
      valueFormatter: (params) => {
        if (!params || params.value === undefined) return "";
        return formatDollar(params.value);
      },
    },
    { field: "dealName", headerName: "Deal Name", width: isMobile ? 180 : 200, minWidth: 150 },
    { field: "acreage", headerName: "Acreage", width: isMobile ? 120 : 140, minWidth: 120 },
    { field: "useType", headerName: "Use Type", width: isMobile ? 140 : 160, minWidth: 140 },
    { field: "focusedUse", headerName: "Focused Use", width: isMobile ? 150 : 170, minWidth: 150 },
    { field: "compType", headerName: "Comp Type", width: isMobile ? 120 : 140, minWidth: 120 },
    { field: "dealStage", headerName: "Deal Stage", fwidth: isMobile ? 150 : 170, minWidth: 150 },
    {
      field: "closeDate",
      headerName: "Close Date",
      width: isMobile ? 130 : 150,
      minWidth: 130,
      renderCell: (params) => {
        const columnConfig = columnSettings.find(c => c.field === "closeDate");
        const formatOption = columnConfig?.formatOption || "Date";
        const shouldMask = columnConfig?.maskUnderContract;
        const value = params.value;
        const dealStage = params.row.dealStage;

        console.log("Rendering close date cell:", {
          value,
          dealStage,
          shouldMask,
          row: params.row
        });

        // Apply masking only if toggle is enabled AND deal is Under Contract
        if (shouldMask && dealStage === "Under Contract") {
          return "-";
        }

        return formatCloseDate(value, formatOption);
      },
      valueFormatter: (params) => {
        // Keep this simple for sorting/filtering - no masking applied here
        const formatOption = columnSettings.find(c => c.field === "closeDate")?.formatOption || "Date";
        return formatCloseDate(params.value, formatOption);
      }
    },
    { field: "buyer", headerName: "Buyer", width: isMobile ? 180 : 200, minWidth: 150 },
    { field: "city", headerName: "City", width: isMobile ? 130 : 150, minWidth: 130 },
    { field: "purchasePrice", headerName: "Purchase Price", width: isMobile ? 150 : 170, minWidth: 150 },
    { field: "priceDisplay", headerName: "Price Display", width: isMobile ? 140 : 160, minWidth: 140 },
    { field: "calculatedPrice", headerName: "Calc. Price", width: isMobile ? 150 : 170, minWidth: 150 },
    { field: "lotCount", headerName: "Lot Count", width: isMobile ? 120 : 140, minWidth: 120 },
    { field: "frontFoot", headerName: "Front Foot", width: isMobile ? 120 : 140, minWidth: 120 },
    { field: "pricingVerified", headerName: "Verified", width: isMobile ? 120 : 140, minWidth: 120, type: "boolean" },
    { field: "latitude", headerName: "Lat", width: isMobile ? 180 : 200, minWidth: 180 },
    { field: "longitude", headerName: "Lng", width: isMobile ? 180 : 200, minWidth: 180 },
    {
      field: "actions",
      headerName: "",
      width: 120,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      isSpecial: true,
      renderCell: (params) => (
        <>
          <IconButton
            sx={{ color: 'grey.500', '&:hover': { color: 'primary.main' } }}
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(params.row);
            }}
            size="small"
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            sx={{ color: 'grey.500', '&:hover': { color: 'error.main' } }}
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveRow(params.id);
            }}
            size="small"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </>
      ),
    },
  ];

  // Initialize rowOrder from localStorage or from cartItems
  const [rowOrder, setRowOrder] = useState(() => {
    // Use saved row order if available
    if (savedReport?.row_order) {
      // Check if it's already an array
      if (Array.isArray(savedReport.row_order)) {
        return savedReport.row_order;
      }
      // Otherwise try to parse it
      try {
        return JSON.parse(savedReport.row_order);
      } catch (e) {
        console.error("Failed to parse saved row order:", e);
      }
    }
    try {
      const savedOrder = localStorage.getItem("compReportRowOrder");
      return savedOrder ? JSON.parse(savedOrder) : cartItems.map(item => item.id || item.properties?.id);
    } catch (e) {
      return cartItems.map(item => item.id || item.properties?.id);
    }
  });

  useEffect(() => {
    if (savedReport?.geo_data) {
      try {
        const parsedGeoData = typeof savedReport.geo_data === 'string'
          ? JSON.parse(savedReport.geo_data)
          : savedReport.geo_data;

        if (parsedGeoData && typeof parsedGeoData === 'object') {
          setReportGeoData(parsedGeoData);
          console.log("Loading Saved Geo Data: ", parsedGeoData);
        }
      } catch (e) {
        console.error("🛑 Failed to parse saved report geo_data:", e);
      }
    }
  }, [savedReport?.geo_data]);

  // Update rowOrder when cartItems change (additions/removals)
  useEffect(() => {
    const currentIds = new Set(rowOrder);
    const newIds = new Set(cartItems.map(item => item.id || item.properties?.id));

    // If items were added, append them to the end
    const addedItems = cartItems.filter(item =>
      !currentIds.has(item.id || item.properties?.id)
    );

    // If items were removed, filter them out
    const filteredOrder = rowOrder.filter(id => newIds.has(id));

    // If there are changes, update the order
    if (addedItems.length > 0 || filteredOrder.length !== rowOrder.length) {
      setRowOrder([
        ...filteredOrder,
        ...addedItems.map(item => item.id || item.properties?.id)
      ]);
    }
  }, [cartItems]); // Only run when cartItems changes

  // Save rowOrder to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("compReportRowOrder", JSON.stringify(rowOrder));
    } catch (e) {
      console.error("Failed to save row order:", e);
    }
  }, [rowOrder]);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [columnSettings, setColumnSettings] = useState(() => {
    // 1. First try to load from saved report
    if (savedReport?.column_settings) {
      try {
        const loadedSettings = Array.isArray(savedReport.column_settings)
          ? savedReport.column_settings
          : JSON.parse(savedReport.column_settings);

        // Migrate existing settings to include maskUnderContract
        return loadedSettings.map(col => ({
          ...col,
          maskUnderContract: col.field === "closeDate"
            ? (col.maskUnderContract || false)
            : undefined
        }));
      } catch (e) {
        console.error("Failed to parse saved column settings:", e);
      }
    }

    // 2. Try to load from localStorage
    try {
      const savedSettings = localStorage.getItem("compReportColumnSettings");
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        // Migrate localStorage settings
        return parsed.map(col => ({
          ...col,
          maskUnderContract: col.field === "closeDate"
            ? (col.maskUnderContract || false)
            : undefined
        }));
      }
    } catch (e) {
      console.error("Failed to parse localStorage column settings:", e);
    }

    // 3. Fallback to default settings with maskUnderContract
    return fullColumns.map(col => ({
      field: col.field,
      label: col.headerName,
      hidden: false,
      formatOption: col.field === "closeDate" ? "Date" :
                   col.field === "compPrice" ? "Total" :
                   undefined,
      formatOptions: col.field === "closeDate" ? ["Date", "Month/Year", "Quarter/Year", "Year"] :
                     col.field === "compPrice" ? ["Total", "PSF", "Per Acre", "Per Unit", "Per Paper Lot", "Per Finished Lot"] :
                     undefined,
      maskUnderContract: col.field === "closeDate" ? false : undefined
    }));
  });

  const getFormatOption = (field) => {
    const setting = columnSettings.find(c => c.field === field);
    return setting?.formatOption || (field === "closeDate" ? "Date" : undefined);
  };

const formattedRows = React.useMemo(() => {
  if (savedReport?.report_data) {
    // Check if it's already an array
    if (Array.isArray(savedReport.report_data)) {
      return savedReport.report_data;
    }
    // Otherwise try to parse it
    try {
      return JSON.parse(savedReport.report_data);
    } catch (e) {
      console.error("Failed to parse saved report data:", e);
      // Fall through to cartItems processing
    }
  }

  return cartItems.map((item, index) => {
    // Get the current format option for compPrice
    const compPriceFormat = columnSettings.find(c => c.field === "compPrice")?.formatOption || "Total";

    // Ensure that for DMRE deals, outsideCloseDate is used if closeDate is missing
    const closeDate = item.properties?.closeDate
      ? item.properties.closeDate
      : (item.properties?.isDMRE ? item.properties?.outsideCloseDate : null);

    // Extract values safely
    const purchasePrice = Number(item.properties?.purchasePrice) || 0;
    const calculatedPrice = Number(item.properties?.calculatedPrice) || 0;
    const acreage = item.properties?.acreage !== undefined ? Number(item.properties.acreage) : 0;
    const lotCount = item.properties?.lotCount !== undefined ? Number(item.properties.lotCount) : 0;
    const dealId = item.properties?.dealId;

    // Determine which price to use
    const price = calculatedPrice || purchasePrice;

    // Compute Comp Price based on formatOption
    let compPrice = 0;
    switch (compPriceFormat) {
      case "PSF":
        compPrice = acreage > 0 ? price / (acreage * 43560) : 0;
        break;
      case "Per Acre":
        compPrice = acreage > 0 ? price / acreage : 0;
        break;
      case "Per Unit":
      case "Per Paper Lot":
      case "Per Finished Lot":
        compPrice = lotCount > 0 ? price / lotCount : 0;
        break;
      case "Total":
      default:
        compPrice = price;
    }

    return {
      isDMRE: item.properties?.isDMRE ?? false,
      id: item.id || index,
      dealId: dealId,
      dealName: item.properties?.dealName ?? "",
      acreage: acreage,
      useType: (item.properties?.primaryUseType ?? "").replace(/-/g, ' '),
      focusedUse: (item.properties?.focusedUseType ?? "").replace(/-/g, ' '),
      compType: item.properties?.compType ?? "",
      dealStage: item.properties?.dealStage ?? "",
      closeDate: closeDate,
      buyer: item.properties?.buyer ?? "",
      city: item.properties?.city ?? "",
      purchasePrice: purchasePrice,
      priceDisplay: item.properties?.priceDisplay ?? "",
      calculatedPrice: calculatedPrice,
      lotCount: lotCount,
      frontFoot: item.properties?.frontFoot ?? "",
      pricingVerified: item.properties?.pricingVerified ?? false,
      latitude: item.properties?.latitude ?? "",
      longitude: item.properties?.longitude ?? "",
      compPrice: compPrice,
    };
  });
}, [cartItems, columnSettings, savedReport?.report_data]);

  // Now you can safely define state that uses formattedRows
  //const [rows, setRows] = useState(() => {
  //  if (savedReport?.report_data) {
  //    return Array.isArray(savedReport.report_data)
  //      ? savedReport.report_data
  //      : JSON.parse(savedReport.report_data);
  //  }
  //  return formattedRows;
  //});

  const rows = props.rows;
  const setRows = props.setRows;

  useEffect(() => {
    if (!savedReport && formattedRows?.length > 0) {
      setRows(formattedRows);
    }
  }, [formattedRows, savedReport]);

  // Keep this effect to handle updates to formattedRows
  useEffect(() => {
    // Only update if we don't have a saved report or if formattedRows changes
    if (!savedReport?.report_data) {
      setRows(formattedRows);
    }
  }, [formattedRows, savedReport?.report_data]);

  // Initialize rowOrder when rows change
  useEffect(() => {
    if (rows.length > 0 && rowOrder.length === 0) {
      setRowOrder(rows.map(row => row.id));
    }
  }, [rows]);

  const handleRemoveRow = React.useCallback((id) => {
    console.log("🧹 Attempting to remove row with ID:", id);
    console.log("Current cartItems before removal:", cartItems);
    console.log("Current rows before removal:", rows);

    // Update cartItems state
    setCartItems(prevItems =>
      prevItems.filter(item => {
        const itemId = item.id || item.properties?.id;
        return itemId !== id;
      })
    );

    // Call parent handler if provided
    if (onRemoveItem) {
      onRemoveItem(id);
    }

    // Update all relevant states
    setRowOrder(prev => prev.filter(rowId => rowId !== id));
    setRows(prevRows => prevRows.filter(row => row.id !== id && row.dealId !== id));

    console.log("Removal completed for ID:", id);
  }, [onRemoveItem, setCartItems]);

  // 1. First, modify your reset function to be more comprehensive
  const resetColumnSettings = () => {
    const defaultSettings = fullColumns.map(col => ({
      field: col.field,
      label: col.headerName,
      hidden: false,
      formatOption: col.field === "closeDate" ? "Date" :
                   col.field === "compPrice" ? "Total" :
                   undefined,
      formatOptions: col.field === "closeDate" ? ["Date", "Month/Year", "Quarter/Year", "Year"] :
                     col.field === "compPrice" ? ["Total", "PSF", "Per Acre", "Per Unit", "Per Paper Lot", "Per Finished Lot"] :
                     undefined,
    }));

    setColumnSettings(defaultSettings);
    localStorage.removeItem("compReportColumnSettings");
  };

  // 2. Add a migration effect to handle new columns
  useEffect(() => {
    const migrateColumnSettings = () => {
      try {
        const savedSettings = localStorage.getItem("compReportColumnSettings");

        if (!savedSettings) {
          const defaultSettings = fullColumns
            .filter(col => !col.isSpecial)
            .map(col => {
              if (col.field === "closeDate") {
                return {
                  field: col.field,
                  label: col.headerName,
                  hidden: false,
                  formatOption: "Date",
                  formatOptions: ["Date", "Month/Year", "Quarter/Year", "Year"],
                };
              } else if (col.field === "compPrice") {
                return {
                  field: col.field,
                  label: col.headerName,
                  hidden: false,
                  formatOption: "Total",
                  formatOptions: ["Total", "PSF", "Per Acre", "Per Unit", "Per Paper Lot", "Per Finished Lot"],
                };
              } else {
                // For other fields, don't provide formatOptions.
                return {
                  field: col.field,
                  label: col.headerName,
                  hidden: false,
                  formatOption: undefined,
                  formatOptions: undefined,
                };
              }
            });
          setColumnSettings(defaultSettings);
          return;
        }

        const parsed = JSON.parse(savedSettings);
        if (!Array.isArray(parsed)) {
          resetColumnSettings();
          return;
        }

        // Create map of existing fields
        const existingFields = new Set(parsed.map(c => c.field));

        // Add missing regular columns (excluding special columns)
        const missingColumns = fullColumns.filter(col =>
          !col.isSpecial && !existingFields.has(col.field)
        );

        if (missingColumns.length > 0) {
          const updatedSettings = [
            ...parsed,
            ...missingColumns.map(col => {
              if (col.field === "closeDate") {
                return {
                  field: col.field,
                  label: col.headerName,
                  hidden: false,
                  formatOption: "Date",
                  formatOptions: ["Date", "Month/Year", "Quarter/Year", "Year"],
                };
              } else if (col.field === "compPrice") {
                return {
                  field: col.field,
                  label: col.headerName,
                  hidden: false,
                  formatOption: "Total",
                  formatOptions: ["Total", "PSF", "Per Acre", "Per Unit", "Per Paper Lot", "Per Finished Lot"],
                };
              } else {
                return {
                  field: col.field,
                  label: col.headerName,
                  hidden: false,
                  formatOption: undefined,
                  formatOptions: undefined,
                };
              }
            }),
          ];
          setColumnSettings(updatedSettings);
          localStorage.setItem("compReportColumnSettings", JSON.stringify(updatedSettings));
        }
      } catch (e) {
        console.error("Migration failed:", e);
        resetColumnSettings();
      }
    };

    migrateColumnSettings();
  }, []);

  // Helper function for format options
  const getDefaultFormatOption = (field) => {
    if (field === "closeDate") return "Date";
    if (["purchasePrice", "calculatedPrice", "compPrice"].includes(field)) return "Total";
    return undefined;
  };

  // Save the title whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("compReportTitle", reportTitle);
    } catch (e) {
      console.error("Failed to save report title:", e);
    }
  }, [reportTitle]);

  // Save the title whenever it changes
  useEffect(() => {
    localStorage.setItem("compReportTitle", reportTitle);
  }, [reportTitle]);

  // Save column settings whenever they change
  useEffect(() => {
    try {
      localStorage.setItem("compReportColumnSettings", JSON.stringify(columnSettings));
    } catch (e) {
      console.error("Failed to save column settings:", e);
    }
  }, [columnSettings]);

  // Create DataGrid columns based on current configuration
  const columnsToShow = [
    // Process all configurable columns first
    ...(Array.isArray(columnSettings) ? columnSettings : [])
      .filter((cfg) => !cfg.hidden) // Only visible columns
      .map((cfg) => {
        const colDef = fullColumns.find((col) => col.field === cfg.field && !col.isSpecial);
        if (!colDef) return null; // Skip if column definition not found

        let valueFormatter;

        if (cfg.field === "closeDate") {
          valueFormatter = (params) => {
            const value = (params && params.value !== undefined) ? params.value : params;
            if (value === undefined || value === null || value === "") return "";
            console.log("CloseDate valueFormatter params: ", params);
            return formatCloseDate(value, cfg.formatOption || "Date");
          };
        } else if (cfg.field === "compPrice") {
          valueFormatter = (params) => {
            const value = (params && params.value !== undefined) ? params.value : params;
            if (value === undefined || value === null || value === "") return "";

            const format = cfg.formatOption || "Total";
            const num = Number(value);
            if (isNaN(num)) return "";

            return format === "PSF"
              ? `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : `$${Math.round(num).toLocaleString("en-US")}`;
          };
        }
        else if (cfg.field === "calculatedPrice") {
          valueFormatter = (params) => {
            const value = (params && params.value !== undefined) ? params.value : params;
            if (value === undefined || value === null || value === "") return "";

            const num = Number(value);
            if (isNaN(num)) return "";

            return `$${Math.round(num).toLocaleString("en-US")}`;
          };
        }
        else if (cfg.field === "purchasePrice") {
          valueFormatter = (params) => {
            const value = (params && params.value !== undefined) ? params.value : params;
            if (value === undefined || value === null || value === "") return "";

            const num = Number(value);
            if (isNaN(num)) return "";

            return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          };
        } else if (cfg.field === "lotCount") {
          valueFormatter = (params) => {
            const value = (params && params.value !== undefined) ? params.value : params;
            if (value === undefined || value === null || value === "") return "";
            return formatInteger(value);
          };
        } else if (cfg.field === "acreage") {
          valueFormatter = (params) => {
            const value = (params && params.value !== undefined) ? params.value : params;
            if (value === undefined || value === null || value === "") return "";
            return formatFloat(value);
          };
        }

        return {
          ...colDef,
          headerName: cfg.field === "compPrice"
            ? `${cfg.label} (${cfg.formatOption || "Total"})`
            : cfg.label,
          ...(valueFormatter ? { valueFormatter } : {}),
        };
      })
      .filter(Boolean),

    // Always include the actions column at the end
    fullColumns.find((col) => col.isSpecial)
  ].filter(Boolean);

  // Debugging
  console.log("Columns in DataGrid:", columnsToShow.map(col => col.field));

  // Handle saving column settings from modal
  const handleSaveColumnSettings = (updatedConfig) => {
    console.log("🧠 Column settings saved from modal:", updatedConfig);
    setColumnSettings(updatedConfig);
  };

  useEffect(() => {
    return () => {
      // Reset the initial load flag when component unmounts
      setInitialLoadComplete(false);
    };
  }, []);

  // Replace your existing savedReport useEffect with this combined version:
  useEffect(() => {
    if (savedReport && !initialLoadComplete) {
      try {
        console.log("Initializing from saved report...");

        // 1. Handle title
        if (savedReport.title) {
          setReportTitle(savedReport.title);
        }

        // 2. Handle column settings
        if (savedReport.column_settings) {
          setColumnSettings(
            Array.isArray(savedReport.column_settings)
              ? savedReport.column_settings
              : JSON.parse(savedReport.column_settings)
          );
        }

        // 3. Handle row order
        if (savedReport.row_order) {
          const loadedRowOrder = Array.isArray(savedReport.row_order)
            ? savedReport.row_order
            : JSON.parse(savedReport.row_order);
          setRowOrder(loadedRowOrder);
        }

        // 4. Handle report data and cart items
        if (savedReport.report_data) {
          const reportData = Array.isArray(savedReport.report_data)
            ? savedReport.report_data
            : JSON.parse(savedReport.report_data);

          setRows(reportData);
          const updatedCartItems = reportData.map(item => ({
            id: item.id || item.dealId, // Only use existing IDs
            properties: item
          }));
          setCartItems(updatedCartItems);
        }

        // Mark initial load as complete
        setInitialLoadComplete(true);
      } catch (e) {
        console.error("Error loading saved report:", e);
      }
    }
  }, [savedReport, setCartItems, initialLoadComplete]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        position: 'relative',
      }}
    >
      {/* Header Section - Title & Icons on the Same Row (Responsive) */}
      {/* Header Section - Optimized for Mobile & Desktop */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "flex-start", sm: "center" },
          gap: { xs: 1, sm: 2 },
          pt: 3,
          pb: 2,
          px: 2,
          borderBottom: '1px solid #eee',
          width: '100%'
        }}
      >
        {/* Title Section */}
        <Box sx={{
          display: "flex",
          alignItems: "center",
          width: '100%',
          minWidth: 0,
          order: 1
        }}>
          {isEditingTitle ? (
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              position: 'relative'
            }}>
              <TextField
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setIsEditingTitle(false);
                  if (e.key === 'Escape') setIsEditingTitle(false);
                }}
                variant="standard"
                fullWidth
                autoFocus
                sx={{
                  fontWeight: "bold",
                  fontSize: { xs: "1.3rem", sm: "1.5rem" },
                  '& .MuiInputBase-root': {
                    fontSize: 'inherit',
                    fontWeight: 'inherit',
                    width: '100%',
                    pr: { xs: 4, sm: 6 }
                  },
                  '& .MuiInputBase-input': {
                    py: 0.5,
                    width: '100% !important',
                    whiteSpace: 'normal',
                    wordBreak: 'break-word'
                  }
                }}
                InputProps={{
                  disableUnderline: true,
                }}
              />
              <IconButton
                onClick={() => setIsEditingTitle(false)}
                sx={{
                  position: 'absolute',
                  right: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  ml: 1
                }}
              >
                <CheckIcon fontSize="small" />
              </IconButton>
            </Box>
          ) : (
            <Box sx={{
              display: 'flex',
              alignItems: 'flex-start',
              width: '100%'
            }}>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: "bold",
                  fontSize: { xs: "1.3rem", sm: "1.5rem" },
                  whiteSpace: 'normal',
                  wordBreak: 'break-word',
                  pr: 1
                }}
              >
                {reportTitle}
              </Typography>
              <IconButton
                onClick={() => setIsEditingTitle(true)}
                sx={{
                  ml: 0.5,
                  p: 0.5,
                  flexShrink: 0
                }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Box>
          )}
        </Box>

        {/* Sticky Icons */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            border: "1px solid #ddd",
            borderRadius: "8px",
            overflow: "hidden",
            backgroundColor: "white",
            order: 2,
            alignSelf: { xs: 'flex-end', sm: 'center' },
            mt: { xs: 1, sm: 0 },
            width: 'auto'
          }}
        >
          <IconButton
            onClick={() => setIsRowModalOpen(true)}
            sx={{
              p: 1.5,
              borderRight: "1px solid #ddd",
              "&:hover": { backgroundColor: "#f5f5f5" },
            }}
          >
            <TableRowsOutlinedIcon sx={{ color: "gray" }} />
          </IconButton>
          <IconButton
            onClick={() => setIsModalOpen(true)}
            sx={{
              p: 1.5,
              "&:hover": { backgroundColor: "#f5f5f5" },
            }}
          >
            <ViewColumnOutlinedIcon sx={{ color: "gray" }} />
          </IconButton>
        </Box>
      </Box>

      {/* Scrollable Table Container */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          px: 2,
        }}
      >
        <Box
          sx={{
            minWidth: isMobile ? '100%' : 1000,
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: theme.palette.grey[100],
            },
            '& .MuiDataGrid-cell': {
              padding: isMobile ? '8px' : '16px',
            }
          }}
        >
          <DataGrid
            getRowId={(row) => row.id || row.dealId}
            rows={rowOrder.map(id => rows.find(r => r.id === id || r.dealId === id)).filter(Boolean)}
            columns={columnsToShow}
            pageSize={10}
            rowsPerPageOptions={[5, 10, 25]}
            autoHeight={false}
            sortingMode="server" // This is important to prevent automatic client-side sorting
            sortModel={sortModel}
            onSortModelChange={(model) => {
              setSortModel(model);
              if (model.length > 0) {
                // When sorting is applied, temporarily override rowOrder
                const sortedRows = [...rows].sort((a, b) => {
                  const field = model[0].field;
                  const direction = model[0].sort === 'desc' ? -1 : 1;

                  // Handle special formatting cases
                  if (field === 'closeDate') {
                    const dateA = new Date(a[field]).getTime();
                    const dateB = new Date(b[field]).getTime();
                    return direction * (dateA - dateB);
                  }

                  // Handle numeric fields
                  if (['compPrice', 'purchasePrice', 'calculatedPrice', 'acreage', 'lotCount'].includes(field)) {
                    return direction * (Number(a[field]) - Number(b[field]));
                  }

                  // Default string comparison
                  return direction * String(a[field]).localeCompare(String(b[field]));
                });

                setRowOrder(sortedRows.map(row => row.id || row.dealId));
              } else {
                // When sorting is cleared, revert to original rowOrder
                if (savedReport?.row_order) {
                  setRowOrder(Array.isArray(savedReport.row_order)
                    ? savedReport.row_order
                    : JSON.parse(savedReport.row_order));
                } else {
                  setRowOrder(rows.map(row => row.id || row.dealId));
                }
              }
            }}
            disableColumnMenu={true}
            sx={{
              height: '100%',
              minHeight: 300,
              '& .MuiDataGrid-virtualScroller': {
                minHeight: '200px',
              },
              '& .MuiDataGrid-columnHeaderTitle': {
                whiteSpace: 'normal',
                lineHeight: '1.2',
                fontSize: isMobile ? '0.75rem' : '0.875rem',
              },
              '& .MuiDataGrid-cell': {
                fontSize: isMobile ? '0.75rem' : '0.875rem',
              },
              '& .MuiDataGrid-cell--actions': {
                padding: 0,
                justifyContent: 'center',
              }
            }}
          />
        </Box>
      </Box>

      {/* Sticky Footer Buttons */}
      <Box
        sx={{
          position: 'sticky',
          bottom: 0,
          zIndex: 10,
          backgroundColor: 'white',
          borderTop: '1px solid #eee',
          p: 2,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
      <Button
        variant="outlined"
        onClick={() => {
          const fallbackBounds = {
            minLat: null,
            maxLat: null,
            minLng: null,
            maxLng: null
          };

          // Compute bounds from current rows (if needed)
          const computeBoundsFromRows = () => {
            let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;

            rows.forEach(row => {
              const lat = parseFloat(row.latitude);
              const lng = parseFloat(row.longitude);
              if (!isNaN(lat) && !isNaN(lng)) {
                minLat = Math.min(minLat, lat);
                maxLat = Math.max(maxLat, lat);
                minLng = Math.min(minLng, lng);
                maxLng = Math.max(maxLng, lng);
              }
            });

            if (minLat === Infinity || minLng === Infinity) return fallbackBounds;

            return {
              minLat,
              maxLat,
              minLng,
              maxLng
            };
          };

          const bounds = savedReport
            ? {
                minLat: savedReport.bounds_min_lat,
                maxLat: savedReport.bounds_max_lat,
                minLng: savedReport.bounds_min_lng,
                maxLng: savedReport.bounds_max_lng
              }
            : computeBoundsFromRows();

          const center = savedReport
            ? {
                lat: savedReport.report_center_lat,
                lng: savedReport.report_center_lng
              }
            : {
                lat: (bounds.minLat + bounds.maxLat) / 2,
                lng: (bounds.minLng + bounds.maxLng) / 2
              };

          const selectedIds = rows.map(r => r.id || r.dealId);

          // Get geo data from either saved report or current state
          const geoData = savedReport
            ? {
                marker_radii: savedReport.marker_radii || [],
                drawn_polygons: savedReport.drawn_polygons || []
              }
            : {
                marker_radii: [], // Empty array if not using markers in new reports
                drawn_polygons: drawnFeatures?.polygons || []
              };

          onReturnToMap({
            bounds,
            center,
            selectedIds,
            ...geoData,
            reportGeoData: reportGeoData || geoData
          });
        }}
        startIcon={<MapOutlinedIcon />}
      >
        Return to Map
      </Button>

        <Button
          variant="contained"
          color="primary"
          onClick={handleInternalPreview}
          disabled={isGeneratingPDF}
          startIcon={
            <Box sx={{
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mr: 1
            }}>
              <DescriptionOutlinedIcon sx={{
                color: 'white',
                fontSize: '1rem'
              }} />
            </Box>
          }
          sx={{
            px: 2,
            textTransform: 'none',
            fontWeight: 'bold',
            '& .MuiButton-startIcon': {
              marginRight: '8px' // Adjust icon spacing if needed
            }
          }}
        >
          {isGeneratingPDF ? (
            <>
              Generating...
              <CircularProgress size={24} sx={{ ml: 1 }} />
            </>
          ) : 'PREVIEW COMP'}
        </Button>
      </Box>

      {/* Modals */}
      <ColumnSettingsModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        columns={columnSettings}
        onSave={handleSaveColumnSettings}
      />

      <RowOrderModal
        open={isRowModalOpen}
        onClose={() => setIsRowModalOpen(false)}
        rows={rows}
        rowOrder={rowOrder}
        setRowOrder={setRowOrder}
      />

      {currentRow && (
        <EditRowModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          row={currentRow}
          onSave={handleSaveChanges}
        />
      )}
    </Box>
  );
};

ReportBuilder.propTypes = {
  cartItems: PropTypes.array.isRequired,
  setCartItems: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
  onRemoveItem: PropTypes.func,
  onNavigateToMap: PropTypes.func,
  savedReport: PropTypes.shape({
    title: PropTypes.string,
    column_settings: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.array
    ]),
    row_order: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.array
    ]),
    report_data: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.array
    ])
  }),
  reportGeoData: PropTypes.objectOf(
    PropTypes.shape({
      geometry: PropTypes.object.isRequired,
      properties: PropTypes.shape({
        dealName: PropTypes.string,
        acreage: PropTypes.number
      }).isRequired
    })
  )
};

export default ReportBuilder;
