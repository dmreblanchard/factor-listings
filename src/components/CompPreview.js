import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Snackbar,
  Alert,
  IconButton,
  TextField,
  Card,
  Tooltip,
  Collapse,
  CircularProgress,
  Typography
} from '@mui/material';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import GetAppOutlinedIcon from '@mui/icons-material/GetAppOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import MarkChatReadOutlinedIcon from '@mui/icons-material/MarkChatReadOutlined';
import CloseIcon from "@mui/icons-material/Close";
import MessageOutlinedIcon from '@mui/icons-material/MessageOutlined';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import AlertCircle from '@mui/icons-material/Warning';
import FileCopyOutlinedIcon from '@mui/icons-material/FileCopyOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import { compressPDFBlob } from '../utils/pdf-utils';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';


// Required for PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const CompPreview = ({ pdfUrl, onBack, reportData, geoData, onContextUpdate }) => {
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  const [imageSrc, setImageSrc] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  // Preserve existing comment state structure
  const [comment, setComment] = useState(reportData.comment || "");
  const [commentLoading, setCommentLoading] = useState(!reportData.comment);
  const [isCommentOpen, setIsCommentOpen] = useState(false);
  const [commentEdited, setCommentEdited] = useState(reportData.comment_edited || false);
  const [showPublishConfirmation, setShowPublishConfirmation] = useState(false);
  const [showPublishOptions, setShowPublishOptions] = useState(false);
  // Preserve original report status for logic checks
  //const originalReportStatus = reportData?.status || reportData?.reportStatus || null;
  const [reportStatus, setReportStatus] = useState(reportData?.status || null);
  // Preserve report ID for overwriting logic
  const [reportId, setReportId] = useState(reportData?.id || reportData?.report_id || null);
  console.log("Report Id: ", reportId);
  console.log("Status: ", reportStatus);
  const [publishActionType, setPublishActionType] = useState(null);
  const [mapPDF, setMapPDF] = useState(null);
  // Destructure all existing props exactly as before
  const {
    reportTitle = "Comps Report",
    user_email = "",
    rowOrder = [],
    columnSettings = [],
    drawnFeatures = { polygons: [], markers: [] },
    selectedRows = [],
    report_data = [],
    report_id = "",
  } = reportData;
  console.log('CompPreview geoData:', {
    hasGeoData: !!geoData,
    keys: geoData ? Object.keys(geoData) : null,
    sampleFeature: geoData ? geoData[Object.keys(geoData)[0]] : null
  });
/*
  // Simulate comment loading (preserving existing behavior)
  useEffect(() => {
    if (!reportData.comment) {
      const timer = setTimeout(() => {
        setComment(
          "This report contains 2 multi-family properties in Melissa, TX. The more recent property (Melissa Town Center) sold in Nov 2024 for $12.83 PSF with 32.20 acres and a total price of $18,000,000. The older comparable property from Sep 2021 sold for $6.27 PSF with 19.69 acres and a total price of $5,379,647. The newer property shows a significant price increase, reflecting current market conditions in this area."
        );
        setCommentLoading(false);
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [reportData.comment]);
*/
  // In CompPreview.js - REPLACE the current useEffect with:


  useEffect(() => {
    if (reportData?.mapPDF) {
      setMapPDF(reportData.mapPDF);
    }
  }, [reportData]);

  // Add download map handler
  const handleDownloadMap = () => {
    if (!mapPDF) return;

    const mapUrl = URL.createObjectURL(mapPDF);

    const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);

    if (isMobile) {
      // Open in new tab to preserve state
      window.open(mapUrl, '_blank');
    } else {
      // Force download with filename
      const a = document.createElement('a');
      a.href = mapUrl;
      a.download = `${reportData.reportTitle.replace(/\s+/g, '_')}_Map.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    // Clean up
    setTimeout(() => URL.revokeObjectURL(mapUrl), 1000);
  };

  useEffect(() => {
    if (reportData.comment) {
      setComment(reportData.comment);
      setCommentLoading(false);
    }
  }, [reportData.comment]);

  const handleCommentToggle = () => {
    setIsCommentOpen(!isCommentOpen);
  };

  const handleCommentSave = () => {
    setCommentEdited(true);
    setIsCommentOpen(false);
  };

  // Preserve EXACTLY the existing payload structure
  const createPayload = (status) => {
    const buffer = 0.01; // roughly a half-mile

    let centerLat = 0;
    let centerLng = 0;
    let minLat = null;
    let maxLat = null;
    let minLng = null;
    let maxLng = null;

    if (selectedRows.length > 0) {
      selectedRows.forEach(row => {
        const lat = parseFloat(row.latitude);
        const lng = parseFloat(row.longitude);

        if (!isNaN(lat)) {
          minLat = minLat === null ? lat : Math.min(minLat, lat);
          maxLat = maxLat === null ? lat : Math.max(maxLat, lat);
        }
        if (!isNaN(lng)) {
          minLng = minLng === null ? lng : Math.min(minLng, lng);
          maxLng = maxLng === null ? lng : Math.max(maxLng, lng);
        }
      });

      // Apply buffer
      if (minLat !== null && maxLat !== null && minLng !== null && maxLng !== null) {
        centerLat = (minLat + maxLat) / 2;
        centerLng = (minLng + maxLng) / 2;

        minLat -= buffer;
        maxLat += buffer;
        minLng -= buffer;
        maxLng += buffer;
      }
    }

    return {
      report_id: reportId || null,
      title: reportTitle,
      user_email,
      row_order: rowOrder,
      column_settings: columnSettings,
      drawn_polygons: drawnFeatures.polygons || [],
      marker_radii: drawnFeatures.markers || [],
      selected_polygons: selectedRows.map(r => ({
        id: r.id,
        lat: parseFloat(r.latitude) || 0,
        lng: parseFloat(r.longitude) || 0
      })),
      report_center_lat: centerLat,
      report_center_lng: centerLng,
      // New bounds properties
      bounds_min_lat: minLat,
      bounds_max_lat: maxLat,
      bounds_min_lng: minLng,
      bounds_max_lng: maxLng,
      status,
      comment_edited: commentEdited,
      generated_at: new Date().toISOString(),
      pdf_base64: "", // Will be added in handlePublishComp
      comment: comment, // Preserving exact property name
      report_data: report_data,
      is_update: status === 'published' && reportStatus === 'published',
      geo_data: "",
    };
  };

  const handlePublishClick = () => {
    let actionTypeGuess;

    if (!reportId) {
      actionTypeGuess = 'insert_new';
    } else if (reportStatus === 'draft') {
      actionTypeGuess = 'overwrite';
    } else if (reportStatus === 'published') {
      actionTypeGuess = 'overwrite'; // default guess; refined later by user
    } else {
      actionTypeGuess = 'insert_new';
    }

    setPublishActionType(actionTypeGuess);
    setShowPublishConfirmation(true);
  };

  const getSaveActionType = () => {
    if (!reportId) return 'insert_new';
    if (reportStatus === 'published') return 'insert_new'; // Creates new draft
    return 'overwrite'; // For existing drafts
  };

  const getPublishActionType = (userWantsNewVersion = false) => {
    if (!reportId) return 'insert_new';
    if (reportStatus === 'draft') return 'overwrite'; // Convert draft to published
    return userWantsNewVersion ? 'insert_new' : 'overwrite'; // Published report options
  };

  const handlePublishConfirm = async (userWantsNewVersion = false) => {
    try {
      setPublishing(true);
      setShowPublishConfirmation(false);

      // 1. Get PDF and measure size
      const pdfResponse = await fetch(pdfUrl);
      let pdfBlob = await pdfResponse.blob();
      const originalSizeMB = pdfBlob.size / (1024 * 1024);
      console.log(`Original size: ${originalSizeMB.toFixed(2)}MB`);

      // 2. Compress if over 5MB
      if (originalSizeMB > 5) {
        setToast({
          open: true,
          message: `Compressing PDF (${originalSizeMB.toFixed(2)}MB)...`,
          severity: 'info'
        });

        pdfBlob = await compressPDFBlob(pdfBlob);
        const newSizeMB = pdfBlob.size / (1024 * 1024);
        console.log(`Compressed size: ${newSizeMB.toFixed(2)}MB`);
      }

      // 3. Convert to base64
      const base64String = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(pdfBlob);
      });

      // 4. Create payload
      const status = 'published';
      const payload = createPayload(status);
      payload.pdf_base64 = base64String;
      if (geoData) {
        payload.geo_data = geoData;
      }
      // 🔁 ADDED BACK: ACTION TYPE LOGIC
      const actionType = getPublishActionType(userWantsNewVersion);
      payload.action_type = actionType;

      if (actionType === 'overwrite') {
        payload.report_id = reportId;
      }

      // 5. Check final size
      const payloadSizeMB = JSON.stringify(payload).length / (1024 * 1024);
      console.log(`Payload size: ${payloadSizeMB.toFixed(2)}MB`);

      if (payloadSizeMB > 6) {
        throw new Error(`Final payload too large (${payloadSizeMB.toFixed(2)}MB). Try reducing image quality in settings.`);
      }
      console.log("Publish Payload: ", payload);
      // 6. Proceed with upload
      const response = await fetch(
        "https://3h3er97cni.execute-api.us-east-1.amazonaws.com/prod/comps/create",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) throw new Error("Upload failed");

      const responseData = await response.json();

      // 🔁 ADDED BACK: Update local state if we get a new report_id
      if (responseData.report_id && actionType === 'insert_new') {
        setReportId(responseData.report_id);
        setReportStatus('published');
      }

      handleSuccessfulPublish(pdfBlob, responseData.report_id);

    } catch (error) {
      console.error("Publish error:", error);
      setToast({
        open: true,
        message: error.message,
        severity: 'error'
      });
    } finally {
      setPublishing(false);
    }
  };

  const handlePublishCancel = () => {
    setShowPublishConfirmation(false);
  };

  // Preserve existing successful publish handling
  const handleSuccessfulPublish = (blob, newReportId) => {
    const sanitizedName = reportTitle
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .substring(0, 100);

    const blobUrl = URL.createObjectURL(blob);

    if (isMobile) {
      // 🔄 Open in new tab to avoid "back" issues
      window.open(blobUrl, '_blank');

      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 10000);
    } else {
      // 💾 Download
      const desktopDownloadLink = document.createElement('a');
      desktopDownloadLink.href = blobUrl;
      desktopDownloadLink.download = `${sanitizedName}.pdf`;
      document.body.appendChild(desktopDownloadLink);
      desktopDownloadLink.click();
      document.body.removeChild(desktopDownloadLink);

      // 🖼 Optional: Desktop preview (inline iframe)
      try {
        const previewWindow = window.open('', '_blank');
        if (previewWindow && !previewWindow.closed) {
          previewWindow.document.write(`
            <iframe
              src="${blobUrl}"
              style="width:100%;height:100%;border:none"
              title="PDF Preview"
            ></iframe>
          `);
        }
      } catch (e) {
        console.log('Preview window could not be opened', e);
      }

      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    }

    // ✅ Toast
    setToast({
      open: true,
      message: reportStatus === 'published'
        ? 'Report updated successfully! Returning to map...'
        : 'Report published successfully! Returning to map...',
      severity: 'success'
    });

    // ✅ Redirect back (after 4 seconds)
    setTimeout(() => {
      window.location.href = "/";
    }, 4000);
  };

  const handleSaveDraft = async () => {
    try {
      const actionType = getSaveActionType();
      const status = 'draft';
      const payload = createPayload(status);
      payload.action_type = actionType;

      if (actionType === 'overwrite') {
        payload.report_id = reportId;
      }

      if (geoData) {
        payload.geo_data = geoData;
      }
      
      console.log("Draft payload:", JSON.stringify(payload, null, 2));

      const response = await fetch(
        "https://3h3er97cni.execute-api.us-east-1.amazonaws.com/prod/comps/create",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) throw new Error("Failed to save draft");

      const responseData = await response.json();

      // 🆕 Capture and store the new report_id
      if (responseData.report_id && actionType === 'insert_new') {
        setReportId(responseData.report_id); // ✅ This makes future saves/publishes work
        setReportStatus('draft');
      }

      setToast({
        open: true,
        message: reportStatus === 'draft'
          ? 'Draft updated successfully!'
          : 'Draft saved successfully!',
        severity: 'success'
      });
    } catch (error) {
      setToast({
        open: true,
        message: `Failed to save draft: ${error.message}`,
        severity: 'error'
      });
    }
  };

  // Preserve existing PDF to image conversion
  useEffect(() => {
    const renderPDFtoImage = async () => {
      if (!isMobile || !pdfUrl) return;

      try {
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2 });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;
        const imageDataUrl = canvas.toDataURL("image/png");
        setImageSrc(imageDataUrl);
      } catch (error) {
        console.error("❌ Failed to render PDF to image:", error);
      }
    };

    renderPDFtoImage();
  }, [pdfUrl, isMobile]);

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Main content - preserved exactly as before */}
      <Box sx={{
        flex: 1,
        minHeight: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        p: 2,
        backgroundColor: '#f5f5f5',
        position: 'relative'
      }}>
        {/* Existing PDF preview rendering */}
        {pdfUrl && (
          <>
            {isMobile ? (
              imageSrc ? (
                <Box sx={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'white',
                  borderRadius: 1,
                  overflow: 'hidden',
                  boxShadow: 1
                }}>
                  <img src={imageSrc} alt="PDF Preview" style={{ width: '100%', height: 'auto' }} />
                </Box>
              ) : (
                <Box sx={{ p: 2 }}>Generating preview…</Box>
              )
            ) : (
              <Box sx={{
                flex: 1,
                backgroundColor: 'white',
                borderRadius: 1,
                overflow: 'hidden',
                boxShadow: 1,
                '& iframe': {
                  width: '100%',
                  height: '100%',
                  minHeight: 'calc(100vh - 150px)',
                  border: 'none'
                }
              }}>
                <iframe
                  src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                  title="PDF Preview"
                />
              </Box>
            )}
          </>
        )}

        {/* Replace the Comment Sticky Button with this rounded square version */}
        <Box sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 1000,
          display: 'flex',
          gap: 1.5 // Controls spacing between icons
        }}>
          {mapPDF && (
            <Tooltip title="Download Map PDF">
              <IconButton
                onClick={handleDownloadMap}
                sx={{
                  backgroundColor: 'transparent',
                  '&:hover': { backgroundColor: 'action.hover' },
                  p: 0
                }}
              >
                <Box sx={{
                  backgroundColor: '#2196F3',
                  borderRadius: 2,
                  width: 40,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 1,
                  transition: 'all 0.2s ease',
                  '&:hover': { transform: 'scale(1.05)' }
                }}>
                  <MapOutlinedIcon sx={{ color: 'white', fontSize: '1.25rem' }} />
                </Box>
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title={commentLoading ? "Generating market insights..." : "View/edit summary"}>
            <IconButton
              onClick={commentLoading ? undefined : handleCommentToggle}
              sx={{
                backgroundColor: commentLoading ? 'background.default' : 'transparent',
                '&:hover': {
                  backgroundColor: commentLoading ? 'background.default' : 'action.hover'
                },
                p: commentLoading ? 1 : 0 // ✅ Add back padding during loading
              }}
            >
              {commentLoading ? (
                <CircularProgress size={24} />
              ) : (
                <Box sx={{
                  backgroundColor: '#4CAF50',
                  borderRadius: 2,
                  width: 40,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 1,
                  transition: 'all 0.2s ease',
                  '&:hover': { transform: 'scale(1.05)' }
                }}>
                  <MarkChatReadOutlinedIcon sx={{ color: 'white', fontSize: '1.25rem' }} />
                </Box>
              )}
            </IconButton>
          </Tooltip>
        </Box>
        {/* Enhanced Comment Editor Card */}
        <Collapse in={isCommentOpen} sx={{
          position: 'absolute',
          top: 60,
          right: 16,
          zIndex: 1000,
          width: isMobile ? '90%' : '400px',
        }}>
          <Card sx={{
            boxShadow: 3,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden'
          }}>
            {/* Blue Header */}
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 2,
              backgroundColor: 'primary.main',
              color: 'white',
              flexShrink: 0
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MessageOutlinedIcon fontSize="small" sx={{ color: 'white' }} />
                <Typography variant="subtitle1">Comp Summary</Typography>
              </Box>
              <IconButton
                onClick={() => setIsCommentOpen(false)}
                size="small"
                sx={{ color: 'white' }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>

            {/* Content Area */}
            <Box sx={{
              p: 2,
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <TextField
                multiline
                fullWidth
                minRows={4}
                maxRows={8}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                variant="outlined"
                sx={{
                  mb: 2,
                  flex: 1,
                  '& .MuiOutlinedInput-root': {
                    height: '100%',
                    alignItems: 'flex-start'
                  }
                }}
              />

              <Box sx={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 1,
                borderTop: '1px solid',
                borderColor: 'divider',
                pt: 2
              }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setIsCommentOpen(false)}
                  sx={{ textTransform: 'none' }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  onClick={handleCommentSave}
                  startIcon={<CheckOutlinedIcon fontSize="small" />}
                  sx={{ textTransform: 'none' }}
                >
                  Save Changes
                </Button>
              </Box>
            </Box>
          </Card>
        </Collapse>
      </Box>

      {/* Footer with all buttons - Add this */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        p: 2,
        borderTop: '1px solid #e0e0e0',
        backgroundColor: 'white'
      }}>
        {/* Back Button */}
        <Box sx={{
          backgroundColor: '#f5f5f5',
          borderRadius: 2,
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #e0e0e0'
        }}>
        <IconButton onClick={() => {
          onBack({
            reportGeoData: geoData, // Pass the current geo data back
            // Include other data needed to restore state:
            currentRows: reportData?.currentRows,
            currentCartItems: reportData?.currentCartItems,
            currentRowOrder: reportData?.currentRowOrder
          });
        }}>
          <ArrowBackOutlinedIcon sx={{ color: 'action.active' }} />
        </IconButton>
        </Box>

        <Box sx={{ display: 'flex', gap: 2 }}>

          {/* Publish Button */}
          <Button
            variant="contained"
            color="primary"
            startIcon={
              <Box sx={{
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mr: 1
              }}>
                <GetAppOutlinedIcon sx={{ color: 'white', fontSize: '1rem' }} />
              </Box>
            }
            onClick={handlePublishClick}
            disabled={publishing || commentLoading}
            sx={{
              px: 2,
              textTransform: 'none',
              fontWeight: 'bold'
            }}
          >
            {publishing ? (
              <>
                Publishing...
                <CircularProgress size={24} sx={{ ml: 1 }} />
              </>
            ) : 'PUBLISH COMP'}
          </Button>
        </Box>
      </Box>
      {/* Enhanced Publish Confirmation Modal */}
      {showPublishConfirmation && (
        <Box sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 1400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Card sx={{
            width: '100%',
            maxWidth: 500,
            borderRadius: 2,
            overflow: 'hidden'
          }}>
            {/* Header */}
            <Box sx={{
              backgroundColor: 'primary.main',
              color: 'white',
              p: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}>
              <AlertCircle sx={{ color: 'white' }} />
              <Typography variant="h6">
                Publish Report Options
              </Typography>
            </Box>

            {/* Content */}
            <Box sx={{ p: 3 }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {publishActionType === 'insert_new'
                ? 'You’re about to publish a new report. Please confirm before proceeding.'
                : 'You’re editing a previously published report. What would you like to do?'}
            </Typography>

              <Box sx={{
                backgroundColor: 'grey.100',
                p: 2,
                borderRadius: 1,
                mb: 2
              }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Report Title:
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'medium', mb: 2 }}>
                  {reportTitle || "Untitled Report"}
                </Typography>

                <Typography variant="subtitle2" color="text.secondary">
                  Properties Included:
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                  {selectedRows.length} {selectedRows.length === 1 ? 'Property' : 'Properties'}
                </Typography>
              </Box>

              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                You can choose to overwrite the existing report or create a brand new version.
              </Typography>
            </Box>

            {/* Action Buttons */}
            <Box sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 1,
              p: 2,
              borderTop: '1px solid',
              borderColor: 'divider'
            }}>
              {!showPublishOptions ? (
                <>
                  <Button
                    variant="outlined"
                    onClick={handlePublishCancel}
                    sx={{ textTransform: 'none' }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleSaveDraft}
                    startIcon={<SaveOutlinedIcon />}
                    sx={{ textTransform: 'none' }}
                  >
                    Save
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => {
                      if (reportStatus === 'published' && reportId) {
                        setShowPublishOptions(true); // step into secondary choice
                      } else {
                        handlePublishConfirm(false); // skip second step
                      }
                    }}
                    sx={{ textTransform: 'none' }}
                  >
                    Publish
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outlined"
                    onClick={handlePublishCancel}
                    sx={{ textTransform: 'none' }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => handlePublishConfirm(true)}
                    sx={{ textTransform: 'none' }}
                  >
                    Create New Report
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => handlePublishConfirm(false)}
                    sx={{ textTransform: 'none' }}
                  >
                    Overwrite Existing
                  </Button>
                </>
              )}
            </Box>
          </Card>
        </Box>
      )}
      {/* Preserved toast notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={() => setToast({...toast, open: false})}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setToast({...toast, open: false})}
          severity={toast.severity}
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CompPreview;
