import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Collapse,
  CircularProgress,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TableSortLabel,
  Alert,
  Avatar,
  Card,
  CardHeader,
  CardContent,
  Divider,
  Tooltip,
  useTheme,
  alpha
} from '@mui/material';
import {
  InsertDriveFile as ReportIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Edit as EditIcon,
  OpenInNew as OpenInNewIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Sort as SortIcon
} from '@mui/icons-material';
import CommentIcon from '@mui/icons-material/Comment';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import BackupTableOutlinedIcon from '@mui/icons-material/BackupTableOutlined';
import AccountBoxOutlinedIcon from '@mui/icons-material/AccountBoxOutlined';
import InsertCommentOutlinedIcon from '@mui/icons-material/InsertCommentOutlined';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import { format } from 'date-fns';
import PropTypes from 'prop-types';

const CompDashboard = ({ userData, onClose, onEditReport, navigationState }) => {
  const theme = useTheme();
  const [reports, setReports] = useState({
    userReports: [],
    officeReports: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userReportsExpanded, setUserReportsExpanded] = useState(true);
  const [officeReportsExpanded, setOfficeReportsExpanded] = useState(true);
  const [sortConfig, setSortConfig] = useState({
    field: 'created_at',
    direction: 'desc'
  });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState(null);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  const [commentDialog, setCommentDialog] = useState({
    open: false,
    comment: '',
    title: ''
  });

  const handleCommentClick = (report) => {
    setCommentDialog({
      open: true,
      comment: report.comment || 'No comment available',
      title: report.title || 'Report Comment'
    });
  };

  const handleCloseComment = () => {
    setCommentDialog({ ...commentDialog, open: false });
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://tc3fvnrjqa.execute-api.us-east-1.amazonaws.com/prod/listings/dashboard?user_email=${encodeURIComponent(userData.user_email)}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" }
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch reports");
      }
      console.log("Listings Report Data: ", data);
      // Transform to match your component's expected structure
      setReports({
        userReports: data.reports.filter(r => r.user_id === userData.user_email),
        officeReports: data.reports.filter(r => r.user_id !== userData.user_email)
      });

    } catch (error) {
      console.error("Dashboard fetch error:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userData?.user_email) {
      fetchReports();
    }
  }, [userData]);

  const handleSort = (field) => {
    let direction = 'asc';
    if (sortConfig.field === field && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ field, direction });
  };

  const handleDeleteConfirm = async () => {
    if (!reportToDelete?.report_id && !reportToDelete?.id) return;

    try {
      const response = await fetch('https://tc3fvnrjqa.execute-api.us-east-1.amazonaws.com/prod/listings/reports/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: reportToDelete.report_id || reportToDelete.id }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete report');
      }

      setToast({
        open: true,
        message: 'Report deleted successfully',
        severity: 'success'
      });

      setDeleteModalOpen(false);
      setReportToDelete(null);

      fetchReports(); // Refresh the list
    } catch (err) {
      console.error('Delete error:', err);
      setToast({
        open: true,
        message: `Delete failed: ${err.message}`,
        severity: 'error'
      });
    }
  };

  const sortedReports = (reportList) => {
    return [...reportList].sort((a, b) => {
      // Handle nested dates for sorting
      const aValue = a[sortConfig.field]?.toISOString?.() || a[sortConfig.field];
      const bValue = b[sortConfig.field]?.toISOString?.() || b[sortConfig.field];

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  const getStatusChip = (status) => {
    const statusConfig = {
      published: { color: 'success', label: 'Published' },
      draft: { color: 'default', label: 'Draft' },
      approval_requested: { color: 'warning', label: 'Pending Approval' }
    };

    const config = statusConfig[status.toLowerCase()] || { color: 'default', label: status };

    return (
      <Chip
        label={config.label}
        color={config.color}
        size="small"
        sx={{
          fontWeight: 500,
          textTransform: 'capitalize',
          boxShadow: theme.shadows[1]
        }}
      />
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  // Section header component for better consistency
  const SectionHeader = ({ title, count, expanded, onToggle, icon: Icon }) => (
    <Box
      sx={{
        p: 2.5,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.1) : alpha(theme.palette.primary.light, 0.1),
        borderRadius: `${theme.shape.borderRadius}px ${theme.shape.borderRadius}px 0 0`,
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          backgroundColor: theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.15) : alpha(theme.palette.primary.light, 0.15),
        }
      }}
      onClick={onToggle}
    >
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Icon color="primary" sx={{ mr: 1.5 }} />
        <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>
          {title}
          <Chip
            label={count}
            size="small"
            color="primary"
            sx={{ ml: 1.5, fontWeight: 600 }}
          />
        </Typography>
      </Box>
      {expanded ?
        <ExpandLessIcon color="primary" /> :
        <ExpandMoreIcon color="primary" />
      }
    </Box>
  );

  return (
    <>
      {/* Backdrop that prevents interaction with underlying content */}
      <Box sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1199,
        // Mobile fix:
        pointerEvents: navigationState.showDashboard ? 'auto' : 'none'
      }} />

      {/* Main Dashboard Container */}
      <Box sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1200,
        // Mobile-specific touch handling
        overflow: 'hidden',
        // Visual styling
        backgroundColor: theme.palette.background.default,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header with gradient and better spacing */}
        <Box sx={{
          p: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
          background: `linear-gradient(to right, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
          color: 'white',
          borderRadius: { xs: 0, sm: '8px 8px 0 0' }
        }}>
          <Typography variant="h5" sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            fontWeight: 600,
            letterSpacing: 0.5
          }}>
            <BackupTableOutlinedIcon /> Listings Reports Dashboard
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh">
              <IconButton
                onClick={fetchReports}
                sx={{
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  },
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Close">
              <IconButton
                onClick={onClose}
                sx={{
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  },
                }}
              >
                <CloseIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Scrollable Content Area with improved spacing */}
        <Box sx={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch', // iOS momentum
          overscrollBehavior: 'contain',
          // Critical mobile fix:
          touchAction: 'pan-y', // Explicitly allow vertical panning
          // Visual styling
          p: 3,
          pt: 3
        }}>
          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 3,
                boxShadow: theme.shadows[2],
                '& .MuiAlert-icon': {
                  fontSize: '1.5rem'
                }
              }}
              action={
                <Button color="error" size="small" onClick={fetchReports}>
                  Retry
                </Button>
              }
            >
              {error}
            </Alert>
          )}

          {loading ? (
            <Box sx={{
              display: 'flex',
              justifyContent: 'center',
              p: 8,
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2
            }}>
              <CircularProgress size={60} thickness={4} />
              <Typography color="textSecondary" variant="body1">
                Loading reports...
              </Typography>
            </Box>
          ) : (
            <>
              {/* User Reports Section - Improved Card */}
              <Card
                elevation={3}
                sx={{
                  mb: 4,
                  borderRadius: theme.shape.borderRadius,
                  overflow: 'hidden',
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: theme.shadows[6],
                  }
                }}
              >
                <SectionHeader
                  title="My Reports"
                  count={reports.userReports.length}
                  expanded={userReportsExpanded}
                  onToggle={() => setUserReportsExpanded(!userReportsExpanded)}
                  icon={AccountBoxOutlinedIcon}
                />

                <Collapse in={userReportsExpanded}>
                  <TableContainer
                    sx={{
                      maxHeight: '500px',
                      overflowX: 'auto',
                      // Mobile fixes
                      '@media (hover: none)': {
                        WebkitOverflowScrolling: 'touch',
                        touchAction: 'pan-x pan-y', // Allow both directions
                        overscrollBehavior: 'none'
                      }
                    }}
                  >
                    <Table stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell
                            sx={{
                              fontWeight: 'bold',
                              backgroundColor: alpha(theme.palette.background.paper, 0.9)
                            }}
                          >
                            <TableSortLabel
                              active={sortConfig.field === 'title'}
                              direction={sortConfig.direction}
                              onClick={() => handleSort('title')}
                            >
                              Title
                            </TableSortLabel>
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 'bold',
                              backgroundColor: alpha(theme.palette.background.paper, 0.9)
                            }}
                          >
                            <TableSortLabel
                              active={sortConfig.field === 'created_at'}
                              direction={sortConfig.direction}
                              onClick={() => handleSort('created_at')}
                            >
                              Date
                            </TableSortLabel>
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 'bold',
                              backgroundColor: alpha(theme.palette.background.paper, 0.9)
                            }}
                          >
                            Properties
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 'bold',
                              backgroundColor: alpha(theme.palette.background.paper, 0.9)
                            }}
                          >
                            <TableSortLabel
                              active={sortConfig.field === 'status'}
                              direction={sortConfig.direction}
                              onClick={() => handleSort('status')}
                            >
                              Status
                            </TableSortLabel>
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 'bold',
                              backgroundColor: alpha(theme.palette.background.paper, 0.9)
                            }}
                          >
                            Comment
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 'bold',
                              backgroundColor: alpha(theme.palette.background.paper, 0.9)
                            }}
                          >
                            Actions
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sortedReports(reports.userReports).map((report, index) => (
                          <TableRow
                            key={report.id}
                            sx={{
                              '&:nth-of-type(odd)': {
                                backgroundColor: alpha(theme.palette.primary.light, 0.03),
                              },
                              '&:hover': {
                                backgroundColor: alpha(theme.palette.primary.light, 0.07),
                              },
                              transition: 'background-color 0.2s',
                            }}
                          >
                            <TableCell sx={{ fontWeight: 500 }}>{report.title}</TableCell>
                            <TableCell>{formatDate(report.created_at)}</TableCell>
                            <TableCell>
                              <Chip
                                label={report.selected_polygons?.length || 0}
                                size="small"
                                sx={{
                                  fontWeight: 'bold',
                                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                                  color: theme.palette.primary.main
                                }}
                              />
                            </TableCell>
                            <TableCell>{getStatusChip(report.status)}</TableCell>
                            <TableCell>
                              {report.comment ? (
                                <Tooltip title="View Comment">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleCommentClick(report)}
                                    sx={{
                                      color: theme.palette.text.secondary, // Grey color
                                      '&:hover': {
                                        backgroundColor: alpha(theme.palette.action.hover, 0.1),
                                      },
                                    }}
                                  >
                                    <InsertCommentOutlinedIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              ) : (
                                <Typography variant="caption" color="textSecondary">
                                  None
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                {report.pdf_url && (
                                  <Tooltip title="View PDF">
                                    <IconButton
                                      size="small"
                                      onClick={() => window.open(report.pdf_url, '_blank')}
                                      sx={{
                                        color: theme.palette.text.secondary,
                                        '&:hover': {
                                          backgroundColor: alpha(theme.palette.action.hover, 0.1),
                                        },
                                      }}
                                    >
                                      <OpenInNewIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}

                                <Tooltip title="Edit Report">
                                  <IconButton
                                    size="small"
                                    onClick={() => onEditReport(report)}
                                    sx={{
                                      color: theme.palette.text.secondary,
                                      '&:hover': {
                                        backgroundColor: alpha(theme.palette.action.hover, 0.1),
                                      },
                                    }}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>

                                {/* ✅ ADD THIS DELETE ICON */}
                                <Tooltip title="Delete Report">
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      setReportToDelete(report);
                                      setDeleteModalOpen(true);
                                    }}
                                    sx={{
                                      color: theme.palette.error.main,
                                      '&:hover': {
                                        backgroundColor: alpha(theme.palette.error.main, 0.1),
                                      },
                                    }}
                                  >
                                    <CloseIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                        {reports.userReports.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                              <Typography color="textSecondary">
                                No reports found
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Collapse>
              </Card>

              {/* Office Reports Section */}
              <Card
                elevation={3}
                sx={{
                  borderRadius: theme.shape.borderRadius,
                  overflow: 'hidden',
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: theme.shadows[6],
                  }
                }}
              >
                <SectionHeader
                  title="Office Reports"
                  count={reports.officeReports.length}
                  expanded={officeReportsExpanded}
                  onToggle={() => setOfficeReportsExpanded(!officeReportsExpanded)}
                  icon={ApartmentOutlinedIcon}
                />

                <Collapse in={officeReportsExpanded}>
                <TableContainer
                  sx={{
                    maxHeight: '500px',
                    overflowX: 'auto',
                    // Mobile fixes
                    '@media (hover: none)': {
                      WebkitOverflowScrolling: 'touch',
                      touchAction: 'pan-x pan-y', // Allow both directions
                      overscrollBehavior: 'none'
                    }
                  }}
                >
                    <Table stickyHeader size="medium">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold', backgroundColor: alpha(theme.palette.background.paper, 0.9) }}>
                            <TableSortLabel
                              active={sortConfig.field === 'title'}
                              direction={sortConfig.direction}
                              onClick={() => handleSort('title')}
                            >
                              Title
                            </TableSortLabel>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 'bold', backgroundColor: alpha(theme.palette.background.paper, 0.9) }}>
                            <TableSortLabel
                              active={sortConfig.field === 'created_at'}
                              direction={sortConfig.direction}
                              onClick={() => handleSort('created_at')}
                            >
                              Date
                            </TableSortLabel>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 'bold', backgroundColor: alpha(theme.palette.background.paper, 0.9) }}>Properties</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', backgroundColor: alpha(theme.palette.background.paper, 0.9) }}>Author</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', backgroundColor: alpha(theme.palette.background.paper, 0.9) }}>Comment</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', backgroundColor: alpha(theme.palette.background.paper, 0.9) }}>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sortedReports(reports.officeReports).map((report) => (
                          <TableRow
                            key={report.id}
                            sx={{
                              '&:nth-of-type(odd)': {
                                backgroundColor: alpha(theme.palette.primary.light, 0.03),
                              },
                              '&:hover': {
                                backgroundColor: alpha(theme.palette.primary.light, 0.07),
                              },
                              transition: 'background-color 0.2s',
                            }}
                          >
                            <TableCell sx={{ fontWeight: 500 }}>{report.title}</TableCell>
                            <TableCell>{formatDate(report.created_at)}</TableCell>
                            <TableCell>
                              <Chip
                                label={report.selected_polygons?.length || 0}
                                size="small"
                                sx={{
                                  fontWeight: 'bold',
                                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                                  color: theme.palette.primary.main
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Avatar
                                  sx={{
                                    width: 24,
                                    height: 24,
                                    backgroundColor: theme.palette.primary.main,
                                    fontSize: '0.75rem'
                                  }}
                                >
                                  {report.user_id?.charAt(0).toUpperCase() || 'U'}
                                </Avatar>
                                <Typography variant="body2">
                                  {report.user_id?.split('@')[0] || report.user_id}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              {report.comment ? (
                                <Tooltip title="View Comment">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleCommentClick(report)}
                                    sx={{
                                      color: theme.palette.text.secondary, // Grey color
                                      '&:hover': {
                                        backgroundColor: alpha(theme.palette.action.hover, 0.1),
                                      },
                                    }}
                                  >
                                    <InsertCommentOutlinedIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              ) : (
                                <Typography variant="caption" color="textSecondary">
                                  None
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                {report.pdf_url && (
                                  <Tooltip title="View PDF">
                                    <IconButton
                                      size="small"
                                      onClick={() => window.open(report.pdf_url, '_blank')}
                                      sx={{
                                        color: theme.palette.text.secondary,
                                        '&:hover': {
                                          backgroundColor: alpha(theme.palette.action.hover, 0.1),
                                        },
                                      }}
                                    >
                                      <OpenInNewIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                {/* Add Edit Report button here */}
                                <Tooltip title="Edit Report">
                                  <IconButton
                                    size="small"
                                    onClick={() => onEditReport(report)}
                                    sx={{
                                      color: theme.palette.text.secondary,
                                      '&:hover': {
                                        backgroundColor: alpha(theme.palette.action.hover, 0.1),
                                      },
                                    }}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                        {reports.officeReports.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                              <Typography color="textSecondary">
                                No office reports found
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Collapse>
              </Card>
            </>
          )}

          {/* Comment Dialog - Improved styling */}
          <Dialog
            open={commentDialog.open}
            onClose={handleCloseComment}
            PaperProps={{
              sx: {
                borderRadius: theme.shape.borderRadius,
                maxWidth: '500px',
                width: '100%'
              }
            }}
          >
            <DialogTitle sx={{
              borderBottom: `1px solid ${theme.palette.divider}`,
              background: `linear-gradient(to right, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}>
              <InsertCommentOutlinedIcon /> {commentDialog.title} - Comment
            </DialogTitle>
            <DialogContent sx={{ p: 3, mt: 2 }}>
              <Typography>
                {commentDialog.comment}
              </Typography>
            </DialogContent>
            <DialogActions sx={{ p: 2, pt: 0 }}>
              <Button
                onClick={handleCloseComment}
                variant="contained"
                color="primary"
                size="medium"
              >
                Close
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </Box>
      {deleteModalOpen && reportToDelete && (
        <Box sx={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 1400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Card sx={{ width: 400, borderRadius: 2 }}>
            <Box sx={{ backgroundColor: 'primary.main', p: 2, color: 'white' }}>
              <Typography variant="h6">Delete Report</Typography>
            </Box>
            <Box sx={{ p: 3 }}>
              <Typography variant="body1" sx={{ mb: 1 }}>
                Are you sure you want to delete this report?
              </Typography>
              <Typography variant="subtitle1" fontWeight="bold">
                {reportToDelete.title}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2, gap: 1 }}>
              <Button variant="outlined" onClick={() => setDeleteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={handleDeleteConfirm}
              >
                Delete
              </Button>
            </Box>
          </Card>
        </Box>
      )}
    </>
  );
};

CompDashboard.propTypes = {
  userData: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onEditReport: PropTypes.func.isRequired,
  navigationState: PropTypes.shape({
    showDashboard: PropTypes.bool
  })
};

export default CompDashboard;
