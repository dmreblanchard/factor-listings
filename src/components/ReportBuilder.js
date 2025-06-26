// components/ReportBuilder.js
import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  useMediaQuery,
  Tabs,
  Tab,
  Divider
} from "@mui/material";
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
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Tooltip from '@mui/material/Tooltip';


function formatDollar(value) {
  if (value === null || value === undefined || value === '') return "";
  const num = Number(value);
  return isNaN(num)
    ? ""
    : `$${num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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

function formatDate(value, formatOption = "Date") {
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

// Tab panel component
function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const ReportBuilder = ({ reportData, cartItems, setCartItems, onBack, onRemoveItem, onPreviewPDF, userData, savedReport, onNavigateToMap, isEditingReport, onReturnToMap, initialGeoData, reportId, reportStatus, onContextUpdate, liveRows, setLiveRows, ...props }) => {

  console.log("Report Data: ", reportData)
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
  const [activeTab, setActiveTab] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [editingCommentRowId, setEditingCommentRowId] = useState(null);
  const [editingCommentValue, setEditingCommentValue] = useState('');
  const saveEditedComment = async (id, newValue) => {
    console.log(`Saving comment for row ${id}:`, newValue);

    // TODO: Replace with your actual save logic (e.g. call to API / Lambda / Supabase)
    // Example:
    // await api.saveComment({ id, comment: newValue });

    // Optionally, update local state or re-fetch offers
  };
  // State for offers
  const [offers, setOffers] = useState([]);
  const [offersColumns, setOffersColumns] = useState([
    { field: 'Name', headerName: 'Offer Name', width: 200 },
    { field: 'Offer_Status__c', headerName: 'Status', width: 150 },
    { field: 'Calculated_Purchase_Price__c', headerName: 'Purchase Price', width: 150 },
    { field: 'Effective_Date__c', headerName: 'Effective Date', width: 150 },
    { field: 'Offering_Company__r.Name', headerName: 'Company', width: 200 },
  ]);

  const baseColumnProps = {
    minWidth: 120,       // Default minimum width
    sortable: true,      // Default to sortable
    filterable: true,     // Default to filterable
    disableColumnMenu: false, // Default menu behavior
    hidden: false         // Default visibility
  };

  const offerColumns = [
      {
        ...baseColumnProps,
        field: "Offering_Contact_Name",
        headerName: "Contact",
        width: 200,
      },
      {
        ...baseColumnProps,
        field: "Offering_Company_Name",
        headerName: "Company",
        width: 200,
      },
      {
        ...baseColumnProps,
        field: "Calculated_Purchase_Price__c",
        headerName: "Purchase Price",
        width: 160,
        minWidth: 140,
        renderCell: (params) => {
          const val = params.row?.Calculated_Purchase_Price__c;
          return formatDollar(val);
        }
      },
      {
        ...baseColumnProps,
        field: "Total_Earnest_Money__c",
        headerName: "Total Earnest Money",
        width: 160,
        minWidth: 140,
        renderCell: (params) => {
          const val = params.row?.Total_Earnest_Money__c;
          return formatDollar(val);
        }
      },
      {
        ...baseColumnProps,
        field: "Feasibility_Period__c",
        headerName: "Feasibility Period (Days)",
        width: 160,
        minWidth: 140,
        renderCell: (params) => {
          const val = params.row?.Feasibility_Period__c;
          return formatInteger(val);
        }
      },
      {
        ...baseColumnProps,
        field: "Number_of_feasibility_extensions__c",
        headerName: "Feasibility Extensions",
        width: 160,
        minWidth: 140,
        renderCell: (params) => {
          const val = params.row?.Number_of_feasibility_extensions__c;
          return formatInteger(val);
        }
      },
      {
        ...baseColumnProps,
        field: "Days_in_each_feasibility_extension__c",
        headerName: "Days in Feasibility Extensions",
        width: 160,
        minWidth: 140,
        renderCell: (params) => {
          const val = params.row?.Days_in_each_feasibility_extension__c;
          return formatInteger(val);
        }
      },
      {
        ...baseColumnProps,
        field: "Zoning_Approval_Period__c",
        headerName: "Zoning Approval (Days)",
        width: 160,
        minWidth: 140,
        renderCell: (params) => {
          const val = params.row?.Zoning_Approval_Period__c;
          return formatInteger(val);
        }
      },
      {
        ...baseColumnProps,
        field: "Number_of_zoning_extensions__c",
        headerName: "Zoning Extensions",
        width: 160,
        minWidth: 140,
        renderCell: (params) => {
          const val = params.row?.Number_of_zoning_extensions__c;
          return formatInteger(val);
        }
      },
      {
        ...baseColumnProps,
        field: "Days_in_each_zoning_extension__c",
        headerName: "Days in Zoning Extensions",
        width: 160,
        minWidth: 140,
        renderCell: (params) => {
          const val = params.row?.Days_in_each_zoning_extension__c;
          return formatInteger(val);
        }
      },
      {
        ...baseColumnProps,
        field: "Closing_Period__c",
        headerName: "Closing Period (Days)",
        width: 160,
        minWidth: 140,
        renderCell: (params) => {
          const val = params.row?.Closing_Period__c;
          return formatInteger(val);
        }
      },
      {
        ...baseColumnProps,
        field: "Number_of_closing_extensions__c",
        headerName: "Closing Extensions",
        width: 160,
        minWidth: 140,
        renderCell: (params) => {
          const val = params.row?.Number_of_closing_extensions__c;
          return formatInteger(val);
        }
      },
      {
        ...baseColumnProps,
        field: "Days_in_each_closing_extension__c",
        headerName: "Days in Closing Extensions",
        width: 160,
        minWidth: 140,
        renderCell: (params) => {
          const val = params.row?.Days_in_each_closing_extension__c;
          return formatInteger(val);
        }
      },
      {
        ...baseColumnProps,
        field: "Offer_Report_Comments__c",
        headerName: "Offer Comments",
        width: 300,
        renderCell: (params) => {
          const { id, value } = params;

          return (
            <Box
              onClick={(e) => {
                e.stopPropagation();
                setEditingCommentRowId(id);
                setEditingCommentValue(value || '');
                setCommentModalOpen(true);
              }}
              sx={{
                cursor: 'pointer',
                width: '100%',
                height: '100%',
                padding: '0 8px',
                display: 'flex',
                alignItems: 'center',
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              {value?.trim()
                ? value
                : <span style={{ color: '#888' }}>Click to add comment</span>}
            </Box>
          );
        }
      },
      {
        field: "actions",
        headerName: "",
        width: 120,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        isSpecial: true,
        hideInSettings: true,
        renderCell: (params) => (
          <IconButton
            onClick={() => window.open(
              `https://dmre.lightning.force.com/lightning/r/Offer__c/${params?.id || ""}/view`,
              '_blank'
            )}
          >
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        )
      }
  ];

  const feedbackColumns = [
    {
      ...baseColumnProps,
      field: "Name",
      headerName: "Feedback Name",
      width: 200,
      minWidth: 180
    },
    {
      ...baseColumnProps,
      field: "Status__c",
      headerName: "Status",
      width: 150,
      minWidth: 120
    },
    {
      ...baseColumnProps,
      field: "Feedback__c",
      headerName: "Feedback",
      width: 300,
      minWidth: 250,
      renderCell: (params) => (
        <Tooltip title={params?.value || ""}>
          <span>
            {params?.value?.length > 50
              ? `${params.value.substring(0, 50)}...`
              : params?.value || ""}
          </span>
        </Tooltip>
      )
    },
    {
      ...baseColumnProps,
      field: "Buyer_Company_Name",
      headerName: "Company",
      width: 200,
      minWidth: 180,
    },
    {
      ...baseColumnProps,
      field: "Buyer_Contact_Name",
      headerName: "Contact",
      width: 200,
      minWidth: 180,
    },
    {
      ...baseColumnProps,
      field: "CreatedDate",
      headerName: "Created Date",
      width: 150,
      minWidth: 130,
      renderCell: (params) => {
        const val = params.row?.CreatedDate;
        return formatDate(val);
      }
    },
    {
      field: "actions",
      headerName: "",
      width: 120,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      isSpecial: true,
      hideInSettings: true,
      renderCell: (params) => (
        <IconButton
          onClick={() => window.open(
            `https://dmre.lightning.force.com/lightning/r/Buyer_Feedback__c/${params?.id || ""}/view`,
            '_blank'
          )}
        >
          <OpenInNewIcon fontSize="small" />
        </IconButton>
      )
    }
  ];

  const [columnSettings, setColumnSettings] = useState(() => {
    // Create default settings that show all columns
    const initialSettings = {};

    // Process offer columns
    offerColumns.forEach(col => {
      if (!col.hideInSettings) {
        initialSettings[col.field] = {
          hidden: false,
          ...col
        };
      }
    });

    // Process feedback columns if needed
    feedbackColumns.forEach(col => {
      if (!col.hideInSettings && !initialSettings[col.field]) {
        initialSettings[col.field] = {
          hidden: false,
          ...col
        };
      }
    });

    // Then try to load saved settings
    try {
      if (savedReport?.column_settings) {
        const saved = typeof savedReport.column_settings === 'string'
          ? JSON.parse(savedReport.column_settings)
          : savedReport.column_settings;
        return saved || initialSettings;
      }
      return initialSettings;
    } catch (e) {
      return initialSettings;
    }
  });

  // State for feedback
  const [feedback, setFeedback] = useState([]);


  // Column settings modals
  const [isOffersModalOpen, setIsOffersModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  useEffect(() => {
    console.log("Current column settings:", columnSettings);
    console.log("Offer columns:", offerColumns);
    console.log("Generated offers columns:", getColumnsToShow(offerColumns, columnSettings));
    console.log("Feedback columns:", feedbackColumns);
    console.log("Generated feedback columns:", getColumnsToShow(feedbackColumns, columnSettings));
  }, [columnSettings]);

  useEffect(() => {
    setIsLoading(true);
    if (reportData) {
      setOffers(reportData.offers || []);
      setFeedback(reportData.feedback || []);
    }
    setIsLoading(false);
  }, [reportData]);

  // Initialize data when reportData changes
  useEffect(() => {
    if (reportData) {
      console.log("Setting offers data:", reportData.offers);
      setOffers(reportData.offers || []);
      console.log("Setting feedback data:", reportData.feedback);
      setFeedback(reportData.feedback || []);

      // Also ensure columns are set
      if (reportData.offers?.length > 0 && offersColumns.length === 0) {
        setOffersColumns([
          { field: 'Name', headerName: 'Offer Name', width: 200 },
          { field: 'Offer_Status__c', headerName: 'Status', width: 150 },
          { field: 'Calculated_Purchase_Price__c', headerName: 'Purchase Price', width: 150 },
          { field: 'Effective_Date__c', headerName: 'Effective Date', width: 150 },
          { field: 'Offering_Contact__r.Full_Name__c', headerName: 'Contact', width: 200 },
        ]);
      }
    }
  }, [reportData]);

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
      // Determine which data to use based on active tab
      const dataSource = activeTab === 0 ? offers : feedback;
      const columnsSource = activeTab === 0 ? offersColumnsToShow : feedbackColumnsToShow;

      // Prepare rows with proper numbering
      const orderedRows = dataSource.map((row, index) => {
        // For offers, check if we need to mask dates
        if (activeTab === 0) {
          const closeDateSetting = columnSettings["Effective_Date__c"];
          const shouldMask = closeDateSetting?.maskUnderContract;

          return {
            ...row,
            Effective_Date__c: (shouldMask && row.Offer_Status__c === "Under Contract")
              ? "-"
              : row.Effective_Date__c,
            rowNumber: index + 1
          };
        }

        // For feedback, just add row numbers
        return {
          ...row,
          rowNumber: index + 1
        };
      });

      // Filter out action columns
      const visibleColumns = columnsSource.filter(col => col.field !== 'actions');

      // Prepare geo data if available (only relevant for offers)
      let orderedGeoData = {};
      if (reportGeoData && activeTab === 0) {
        orderedRows.forEach((row, index) => {
          const featureId = row.id || row.dealId;
          const originalFeature = reportGeoData[featureId];
          if (originalFeature) {
            orderedGeoData[featureId] = {
              ...originalFeature,
              properties: {
                ...originalFeature.properties,
                rowNumber: index + 1
              }
            };
          }
        });
      }

      // Generate PDFs
      const { tabularPDF, mapPDF } = await generatePDFReport(
        orderedRows,
        visibleColumns,
        `${reportTitle} - ${activeTab === 0 ? 'Offers' : 'Feedback'}`,
        { orientation: 'landscape' },
        Object.keys(orderedGeoData).length > 0 ? orderedGeoData : null
      );

      // Create PDF blob
      const pdfBlob = new Blob([tabularPDF], { type: 'application/pdf' });
      const pdfUrl = URL.createObjectURL(pdfBlob);

      const updatePreview = (comment = "") => {
        if (onPreviewPDF) {
          onPreviewPDF(pdfUrl, {
            reportTitle: `${reportTitle} - ${activeTab === 0 ? 'Offers' : 'Feedback'}`,
            user_email: userData?.user_email,
            selectedRows: orderedRows,
            comment: comment,
            isCommentLoading: !comment,
            report_data: orderedRows,
            status: reportStatus,
            id: savedReport?.id || null,
            report_id: reportId || null,
            geoData: orderedGeoData,
            mapPDF: mapPDF
          });
        }
      };

      updatePreview(generatedComment);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      // Consider adding user feedback here (e.g., a snackbar/toast)
    } finally {
      setIsGeneratingPDF(false);
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
      return savedTitle || "Listing Report Builder";
    } catch (e) {
      console.error("Failed to load report title:", e);
      return "Listing Report Builder";
    }
  });

  // Define column configurations for both data types


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



  const getFormatOption = (field) => {
    const setting = columnSettings[field]; // Direct object access
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
    const compPriceFormat = columnSettings["compPrice"]?.formatOption || "Total";

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

  const resetColumnSettings = () => {
    const defaultSettings = [
      ...offerColumns.map(col => ({
        field: col.field,
        label: col.headerName,
        hidden: false,
        ...(col.valueFormatter ? { formatOption: getDefaultFormatOption(col.field) } : {})
      })),
      ...feedbackColumns.map(col => ({
        field: col.field,
        label: col.headerName,
        hidden: false,
        ...(col.valueFormatter ? { formatOption: getDefaultFormatOption(col.field) } : {})
      }))
    ];

    setColumnSettings(defaultSettings);
    localStorage.removeItem("compReportColumnSettings");
  };

  // 2. Add a migration effect to handle new columns
  useEffect(() => {
    const migrateColumnSettings = () => {
      try {
        const savedSettings = localStorage.getItem("compReportColumnSettings");

        if (!savedSettings) {
          const defaultSettings = [
            ...offerColumns.map(col => ({
              field: col.field,
              label: col.headerName,
              hidden: false,
              ...(col.valueFormatter ? { formatOption: getDefaultFormatOption(col.field) } : {})
            })),
            ...feedbackColumns.map(col => ({
              field: col.field,
              label: col.headerName,
              hidden: false,
              ...(col.valueFormatter ? { formatOption: getDefaultFormatOption(col.field) } : {})
            }))
          ];
          setColumnSettings(defaultSettings);
          return;
        }

        const parsed = JSON.parse(savedSettings);
        if (!Array.isArray(parsed)) {
          resetColumnSettings();
          return;
        }

        // Check if we need to migrate old settings
        const needsMigration = parsed.some(setting =>
          setting.formatOptions || setting.maskUnderContract
        );

        if (needsMigration) {
          const migratedSettings = parsed.map(setting => ({
            field: setting.field,
            label: setting.label,
            hidden: setting.hidden,
            formatOption: setting.formatOption
          }));
          setColumnSettings(migratedSettings);
          localStorage.setItem("compReportColumnSettings", JSON.stringify(migratedSettings));
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
  const getColumnsToShow = (columns = [], settings = {}) => {
      if (!Array.isArray(columns)) return [];

      return columns
        .filter(col => col && (col.isSpecial || !settings[col.field]?.hidden))
        .map(col => {
          if (!col || !col.field) return null;

          // Changed from settings.find() to direct object access
          const config = settings[col.field];
          if (config?.hidden) return null;

          // Return column with formatting if specified
          return {
            ...col,
            ...(config?.formatOption
              ? {
                  valueFormatter: (params) => {
                    const val = params?.value ?? params?.row?.[col.field];
                    console.log("🎯 Custom formatter override for:", col.field, "Value:", val);
                    if (col.field.includes('Date')) return formatDate(val, config.formatOption);
                    if (col.field.includes('Price') || col.field.includes('Amount')) return formatDollar(val);
                    return val ?? '';
                  }
                }
              : {
                  ...(col.valueFormatter && { valueFormatter: col.valueFormatter }) // preserve original
                })
          };
        })
        .filter(Boolean);
  };

  const offersColumnsToShow = getColumnsToShow(offerColumns, columnSettings);
  const feedbackColumnsToShow = getColumnsToShow(feedbackColumns, columnSettings);

  offersColumnsToShow.map(c => ({
    field: c.field,
    isFormatter: typeof c.valueFormatter === 'function'
  }))

  console.log(
    "offersColumnsToShow check:",
    offersColumnsToShow.map((col) => ({
      field: col.field,
      hasFormatter: typeof col.valueFormatter === "function",
    }))
  );

  const flattenedOffers = offers.map((offer) => ({
    ...offer,
    Lead_Broker_Name: offer?.Lead_Broker__r?.Full_Name__c || '',
    Offering_Contact_Name: offer?.Offering_Contact__r?.Full_Name__c || '',
    Offering_Company_Name: offer?.Offering_Company__r?.Name || '',
  }));
  console.log("Flattened offer sample row:", flattenedOffers[0]);

  const stableOfferRows = useMemo(() => flattenedOffers, [flattenedOffers]);

  const flattenedFeedback = feedback.map((feedback) => ({
    ...feedback,
    Buyer_Company_Name: feedback?.Buyer_Company__r?.Name || 'N/A',
    Buyer_Contact_Name: feedback?.Buyer_Contact__r?.Full_Name__c || 'N/A',
  }));
  console.log("Flattened feedback sample row:", flattenedFeedback[0]);

  const stableFeedbackRows = useMemo(() => flattenedFeedback, [flattenedFeedback]);

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

      {/* Replace the entire Scrollable Table Container section */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 2 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label={`Offers (${offers.length})`} />
          <Tab label={`Feedback (${feedback.length})`} />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          <Box sx={{ height: 400, width: '100%' }}>
            {console.log('Rendering offers with:', {
              rows: offers,
              columns: offersColumnsToShow,
              rowCount: offers.length,
              columnCount: offersColumnsToShow.length
            })}
            {console.log('offersColumnsToShow:', offersColumnsToShow)}
            {console.log('offers data sample:', offers.slice(0, 1))} {/* Also log a sample row */}
            <DataGrid
              rows={stableOfferRows}
              columns={offersColumnsToShow}
              getRowId={(row) => row.Id || row.id}  // Use Salesforce's Id field
              pageSize={10}
              rowsPerPageOptions={[5, 10, 25]}
              loading={stableOfferRows.length === 0}
            />
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <Box sx={{ height: 400, width: '100%' }}>
            {console.log('Rendering feedback with:', {
              rows: feedback,
              columns: feedbackColumnsToShow,
              rowCount: feedback.length,
              columnCount: feedbackColumnsToShow.length
            })}
            <DataGrid
              rows={stableFeedbackRows}
              columns={feedbackColumnsToShow}
              getRowId={(row) => row.Id}  // Use Salesforce's Id field
              pageSize={10}
              rowsPerPageOptions={[5, 10, 25]}
              loading={stableFeedbackRows.length === 0}
            />
          </Box>
        </TabPanel>
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

          onReturnToMap({
            bounds,
            center,
            selectedIds,
            reportGeoData: reportGeoData
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
          ) : 'PREVIEW REPORT'}
        </Button>
      </Box>

      {/* Modals */}
      <Dialog
        open={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        {console.log('Editing Salesforce Record Id:', editingCommentRowId)}
        <DialogTitle>Edit Offer Comment</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            minRows={3}
            value={editingCommentValue}
            onChange={(e) => {
              const newValue = e.target.value;
              if (newValue.length <= 255) {
                setEditingCommentValue(newValue);
              }
            }}
            inputProps={{ maxLength: 255 }}
            helperText={
              editingCommentValue.length >= 255
                ? 'Maximum 255 characters reached'
                : `${editingCommentValue.length}/255 characters`
            }
            FormHelperTextProps={{
              sx: {
                color: editingCommentValue.length >= 255 ? 'error.main' : 'text.secondary',
              },
            }}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommentModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={async () => {
              try {
                const response = await fetch(
                  `https://tc3fvnrjqa.execute-api.us-east-1.amazonaws.com/prod/offers/${editingCommentRowId}`,
                  {
                    method: 'PATCH',
                    headers: {
                      'Content-Type': 'application/json',
                      // You can add Authorization headers here if needed
                    },
                    body: JSON.stringify({
                      recordId: editingCommentRowId,
                      comment: editingCommentValue
                    })
                  }
                );

                if (!response.ok) {
                  let result;
                  try {
                    result = await response.json();
                  } catch {
                    result = { error: 'Unknown error' };
                  }
                  console.error('Failed to update comment:', result);
                  alert(`Error: ${result.error}`);
                  return;
                }

                const result = await response.json();
                console.log('Comment updated:', result);

                // TODO: You could also refresh the grid here if needed

                setCommentModalOpen(false);
              } catch (err) {
                console.error('Fetch error:', err);
                alert('Failed to connect to update service.');
              }
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <ColumnSettingsModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        columns={(activeTab === 0 ? offerColumns : feedbackColumns).map(col => ({
          ...col,
          label: col.headerName || col.field, // Use headerName if available, fallback to field
        }))}
        allColumns={activeTab === 0 ? offerColumns : feedbackColumns}
        currentSettings={columnSettings}
        onSave={(updatedSettings) => {
          setColumnSettings(updatedSettings);
          setIsModalOpen(false);
        }}
      />
      {console.log('Columns being passed to modal:',
        activeTab === 0 ? offerColumns : feedbackColumns)}

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
