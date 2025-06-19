import React from 'react';
import {
  Box,
  Button,
  IconButton,
  Typography,
  CircularProgress,
  useTheme,
  useMediaQuery
} from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CloseIcon from '@mui/icons-material/Close';
import Calendar from '@mui/icons-material/CalendarToday';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import EditIcon from '@mui/icons-material/Edit';
import RoomOutlinedIcon from '@mui/icons-material/RoomOutlined';
import List from '@mui/icons-material/List';
import FilterCenterFocusOutlinedIcon from '@mui/icons-material/FilterCenterFocusOutlined';

const CompReportsSidebar = ({
  reports,
  isExpanded,
  toggleExpanded,
  isLoading,
  onOpenPDF,
  onLoadSession,
  onEditReport,      // New prop for editing reports
  onViewAllReports  // New prop for viewing all reports
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Box sx={{
      position: "fixed",
      bottom: isMobile && isExpanded ? 'env(safe-area-inset-bottom, 0px)' : 16,
      left: isMobile && isExpanded ? 'env(safe-area-inset-left, 0px)' : 16,
      right: isMobile && isExpanded ? 'env(safe-area-inset-right, 0px)' : 'auto',
      top: isMobile && isExpanded ? 'env(safe-area-inset-top, 0px)' : 'auto',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      pointerEvents: isExpanded ? 'auto' : 'none',
    }}>
      {isExpanded && (
        <Box sx={{
          backgroundColor: 'white',
          borderRadius: isMobile ? 0 : '8px',
          boxShadow: 3,
          width: isMobile ? '100%' : '400px',
          height: isMobile ? '100vh' : 'auto',
          maxHeight: isMobile ? '100vh' : '60vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            backgroundColor: 'primary.main',
            color: 'white',
            position: isMobile ? 'static' : 'relative',
            flexShrink: 0
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InsertDriveFileIcon fontSize="small" />
              <Typography variant="subtitle1">Published Comp Reports</Typography>
            </Box>
            <IconButton
              onClick={toggleExpanded}
              size="small"
              sx={{ color: 'white' }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {isLoading ? (
            <Box sx={{
              p: 3,
              display: 'flex',
              justifyContent: 'center',
              flex: 1,
              overflowY: 'auto'
            }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <>
              <Box sx={{
                overflowY: 'auto',
                flex: 1,
                maxHeight: isMobile ? 'calc(100vh - 112px)' : 'none'
              }}>
                {reports.map(report => (
                  <Box
                    key={report.id}
                    sx={{
                      p: 2,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:hover': { backgroundColor: 'action.hover' },
                      position: 'relative'
                    }}
                  >
                    <Box sx={{ pr: 6 }}>
                      <Typography variant="body1" color="primary" fontWeight="medium">
                        {report.title}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, mt: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Calendar fontSize="small" />
                          {formatDate(report.created_at)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <RoomOutlinedIcon fontSize="small" />
                          {report.row_order?.length || 0} properties
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        Created by {report.user_email}
                      </Typography>
                    </Box>

                    {/* Action buttons */}
                    <Box sx={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'flex',
                      gap: 1
                    }}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPDF(report);
                        }}
                        title="View PDF Report"
                      >
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onLoadSession(report);
                        }}
                        title="Fly to Location"
                      >
                        <FilterCenterFocusOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditReport(report);
                        }}
                        title="Edit Report"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                ))}
              </Box>

              <Box sx={{
                p: 1,
                backgroundColor: 'background.paper',
                borderTop: '1px solid',
                borderColor: 'divider',
                textAlign: 'center',
                flexShrink: 0
              }}>
                <Button
                  size="small"
                  startIcon={<List fontSize="small" />}
                  sx={{ textTransform: 'none' }}
                  onClick={onViewAllReports}
                >
                  View All Comp Reports
                </Button>
              </Box>
            </>
          )}
        </Box>
      )}
    </Box>
  );
};

export default CompReportsSidebar;
