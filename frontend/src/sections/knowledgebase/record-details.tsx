// RecordDetails.js - Modified to display metadata as chips
import type { User } from 'src/context/UserContext';
import type { Icon as IconifyIcon } from '@iconify/react';

import { Icon } from '@iconify/react';
import dbIcon from '@iconify-icons/mdi/database';
import robotIcon from '@iconify-icons/mdi/robot';
import closeIcon from '@iconify-icons/mdi/close';
import React, { useState, useEffect } from 'react';
import pencilIcon from '@iconify-icons/mdi/pencil';
import updateIcon from '@iconify-icons/mdi/update';
import accountIcon from '@iconify-icons/mdi/account';
import clockIcon from '@iconify-icons/mdi/clock-outline';
import { useParams, useNavigate } from 'react-router-dom';
import arrowLeftIcon from '@iconify-icons/mdi/arrow-left';
import filePdfBoxIcon from '@iconify-icons/mdi/file-pdf-box';
import fileWordBoxIcon from '@iconify-icons/mdi/file-word-box';
import trashCanIcon from '@iconify-icons/mdi/trash-can-outline';
import fileExcelBoxIcon from '@iconify-icons/mdi/file-excel-box';
import fileImageBoxIcon from '@iconify-icons/mdi/file-image-box';
import fileAlertIcon from '@iconify-icons/mdi/file-alert-outline';
import fileTextBoxIcon from '@iconify-icons/mdi/file-text-outline';
import fileCodeBoxIcon from '@iconify-icons/mdi/file-code-outline';
import fileArchiveBoxIcon from '@iconify-icons/mdi/archive-outline';
import fileDocumentBoxIcon from '@iconify-icons/mdi/file-document-box';
import filePowerpointBoxIcon from '@iconify-icons/mdi/file-powerpoint-box';

import {
  Box,
  Chip,
  Grid,
  Card,
  Stack,
  alpha,
  Drawer,
  Button,
  Divider,
  useTheme,
  Container,
  Typography,
  IconButton,
  CardHeader,
  CardContent,
  useMediaQuery,
  CircularProgress,
} from '@mui/material';

import { useUsers } from 'src/context/UserContext';

import { fetchRecordDetails } from './utils';
import RecordSalesAgent from './ask-me-anything';
import RecordDocumentViewer from './show-documents';
import EditRecordDialog from './edit-record-dialog';
import DeleteRecordDialog from './delete-record-dialog';

import type { Permissions, RecordDetailsResponse } from './types/record-details';

export default function RecordDetails() {
  const { recordId } = useParams<{ recordId: string }>();
  const navigate = useNavigate();
  const [recordData, setRecordData] = useState<RecordDetailsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const users = useUsers() as User[];
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!recordId) return;
        const data = await fetchRecordDetails(recordId);
        setRecordData(data);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [recordId]);

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  const refreshRecordData = async () => {
    setLoading(true);
    try {
      if (!recordId) return;
      const data = await fetchRecordDetails(recordId);
      setRecordData(data);
    } catch (error) {
      console.error('Error refreshing record data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecord = () => {
    // Redirect to records list page after successful deletion
    navigate('/records');
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          height: '100vh',
          gap: 2,
        }}
      >
        <CircularProgress size={32} thickness={2.5} />
        <Typography variant="body2" color="text.secondary">
          Loading record details...
        </Typography>
      </Box>
    );
  }

  if (!recordData || !recordData.record) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Card
          sx={{
            p: 4,
            textAlign: 'center',
            borderRadius: 1,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
          }}
        >
          <Icon
            icon={fileAlertIcon}
            style={{ fontSize: '48px', color: '#e53935', marginBottom: '16px' }}
          />
          <Typography variant="h5" color="error" gutterBottom fontWeight={500}>
            Record not found
          </Typography>
          <Typography color="text.secondary" paragraph>
            The requested record could not be found or you don&apos;t have permission to view it.
          </Typography>
          <Button
            variant="contained"
            startIcon={<Icon icon={arrowLeftIcon} />}
            onClick={() => navigate(-1)}
            sx={{ mt: 2 }}
          >
            Go Back
          </Button>
        </Card>
      </Container>
    );
  }

  const { record, knowledgeBase, permissions, metadata } = recordData;
  const createdAt = new Date(record.createdAtTimestamp).toLocaleString();
  const updatedAt = new Date(record.updatedAtTimestamp).toLocaleString();

  // Get file extension, size, etc.
  const { fileRecord } = record;
  const fileSize = fileRecord ? formatFileSize(fileRecord.sizeInBytes) : 'N/A';
  const fileType = fileRecord ? fileRecord.extension.toUpperCase() : 'N/A';

  // Get file icon
  const fileIcon = getFileIcon(fileRecord?.extension || '');
  const fileIconColor = getFileIconColor(fileRecord?.extension || '');

  // Render chips function for metadata items
  const renderChips = (items : any) => {
    if (!items || items.length === 0) return null;

    return (
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {items.map((item : any) => (
          <Chip
            key={item.id || item._id}
            label={item.name}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.75rem',
              fontWeight: 500,
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              color: theme.palette.primary.main,
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.08), // Prevent color change on hover
              },
            }}
          />
        ))}
      </Box>
    );
  };

  return (
    <>
      <Box sx={{ bgcolor: '#f8f9fb', width: '100%' }}>
        <Container sx={{ py: 3 }}>
          {/* Header */}
          <Card
            elevation={0}
            sx={{
              mb: 3,
              borderRadius: 1,
              boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              overflow: 'visible',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 3,
                flexWrap: { xs: 'wrap', sm: 'nowrap' },
                gap: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton
                  onClick={() => navigate('/knowledge-base/details')}
                  size="small"
                  sx={{
                    borderRadius: 1,
                    bgcolor: alpha('#000', 0.04),
                  }}
                >
                  <Icon icon={arrowLeftIcon} fontSize={20} />
                </IconButton>

                <Icon
                  icon={fileIcon}
                  style={{
                    fontSize: '24px',
                    color: fileIconColor,
                    marginRight: '8px',
                  }}
                />

                <Box sx={{ maxWidth: '600px' }}>
                  <Typography variant="h6" fontWeight={500} noWrap sx={{ mb: 0.5 }}>
                    {record.recordName}
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Chip
                      size="small"
                      label={record.recordType}
                      color="primary"
                      sx={{ height: 22, fontSize: '0.75rem' }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {fileSize}
                    </Typography>
                  </Stack>
                </Box>
              </Box>

              <Stack
                direction="row"
                spacing={2}
                width={{ xs: '100%', sm: 'auto' }}
                justifyContent={{ xs: 'flex-end', sm: 'flex-end' }}
              >
                <Button
                  startIcon={<Icon icon={pencilIcon} />}
                  variant="outlined"
                  size="small"
                  onClick={() => setIsEditDialogOpen(true)}
                  sx={{
                    borderRadius: 1,
                    textTransform: 'none',
                    fontSize: '0.875rem',
                    height: 36,
                    fontWeight: 500,
                  }}
                >
                  Edit
                </Button>
                <Button
                  startIcon={<Icon icon={trashCanIcon} />}
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  sx={{
                    borderRadius: 1,
                    textTransform: 'none',
                    fontSize: '0.875rem',
                    height: 36,
                    fontWeight: 500,
                  }}
                >
                  Delete
                </Button>
              </Stack>
            </Box>

            <Divider />

            <Box sx={{ px: 3, py: 2, bgcolor: alpha('#f8f9fb', 0.7) }}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={Boolean(true)}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    <Icon icon={clockIcon} style={{ fontSize: '16px' }} />
                    Created: {createdAt}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={Boolean(true)}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    <Icon icon={updateIcon} style={{ fontSize: '16px' }} />
                    Updated: {updatedAt}
                  </Typography>
                </Grid>

                {knowledgeBase && (
                  <Grid item xs={12} sm={Boolean(true)}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                      <Icon icon={dbIcon} style={{ fontSize: '16px' }} />
                      KB: {knowledgeBase?.name ? knowledgeBase.name : 'Default'}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          </Card>

          <Grid container spacing={3}>
            <Grid item xs={12} lg={8}>
              <Card
                elevation={0}
                sx={{
                  mb: 3,
                  borderRadius: 1,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                  overflow: 'hidden',
                }}
              >
                <CardHeader
                  title="Document Details"
                  titleTypographyProps={{
                    variant: 'subtitle1',
                    fontWeight: 500,
                    fontSize: '1rem',
                  }}
                  sx={{
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    p: 2.5,
                  }}
                />

                <CardContent sx={{ p: 3 }}>
                  <Grid container spacing={4}>
                    <Grid item xs={12} sm={6}>
                      <Stack spacing={3}>
                        {fileRecord && (
                          <Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              gutterBottom
                              sx={{
                                textTransform: 'uppercase',
                                fontWeight: 500,
                                letterSpacing: '0.5px',
                                display: 'block',
                                mb: 0.75,
                              }}
                            >
                              File Name
                            </Typography>
                            <Typography variant="body2">{fileRecord?.name || 'N/A'}</Typography>
                          </Box>
                        )}
                        {fileRecord && (
                          <Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              gutterBottom
                              sx={{
                                textTransform: 'uppercase',
                                fontWeight: 500,
                                letterSpacing: '0.5px',
                                display: 'block',
                                mb: 0.75,
                              }}
                            >
                              File Type
                            </Typography>
                            <Chip
                              label={fileType}
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                bgcolor: alpha(theme.palette.primary.main, 0.08),
                                color: theme.palette.primary.main,
                                '&:hover': {
                                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                                },
                              }}
                            />
                          </Box>
                        )}

                        <Box>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            gutterBottom
                            sx={{
                              textTransform: 'uppercase',
                              fontWeight: 500,
                              letterSpacing: '0.5px',
                              display: 'block',
                              mb: 0.75,
                            }}
                          >
                            Record ID
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily: 'monospace',
                              bgcolor: alpha('#000', 0.03),
                              p: 1.5,
                              borderRadius: 1,
                              fontSize: '0.85rem',
                              overflow: 'auto',
                            }}
                          >
                            {record._key}
                          </Typography>
                        </Box>
                      </Stack>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <Stack spacing={3}>
                        <Box>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            gutterBottom
                            sx={{
                              textTransform: 'uppercase',
                              fontWeight: 500,
                              letterSpacing: '0.5px',
                              display: 'block',
                              mb: 0.75,
                            }}
                          >
                            File Size
                          </Typography>
                          <Typography variant="body2">{fileSize}</Typography>
                        </Box>

                        <Box>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            gutterBottom
                            sx={{
                              textTransform: 'uppercase',
                              fontWeight: 500,
                              letterSpacing: '0.5px',
                              display: 'block',
                              mb: 0.75,
                            }}
                          >
                            Origin
                          </Typography>
                          <Typography variant="body2">{record.origin}</Typography>
                        </Box>

                        <Box>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            gutterBottom
                            sx={{
                              textTransform: 'uppercase',
                              fontWeight: 500,
                              letterSpacing: '0.5px',
                              display: 'block',
                              mb: 0.75,
                            }}
                          >
                            Permissions
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {permissions.length > 0 ? (
                              permissions.map((permission: Permissions) => (
                                <Chip
                                  key={permission.id}
                                  label={permission.relationship}
                                  size="small"
                                  sx={{
                                    height: 22,
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                                    color: theme.palette.primary.main,
                                    '&:hover': {
                                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                                    },
                                  }}
                                />
                              ))
                            ) : (
                              <Typography variant="body2">No permissions assigned</Typography>
                            )}
                          </Box>
                        </Box>
                      </Stack>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              <Card
                elevation={0}
                sx={{
                  borderRadius: 1,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                  overflow: 'hidden',
                }}
              >
                <RecordDocumentViewer record={record} />
              </Card>
            </Grid>

            <Grid item xs={12} lg={4}>
              <Card
                elevation={0}
                sx={{
                  borderRadius: 1,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <CardHeader
                  title="Additional Information"
                  titleTypographyProps={{
                    variant: 'subtitle1',
                    fontWeight: 500,
                    fontSize: '1rem',
                  }}
                  sx={{
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    p: 2.5,
                  }}
                />

                <CardContent sx={{ p: 3, flexGrow: 1 }}>
                  <Stack spacing={3}>
                    {/* Departments */}
                    {metadata?.departments && metadata.departments.length > 0 && (
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          gutterBottom
                          sx={{
                            textTransform: 'uppercase',
                            fontWeight: 500,
                            letterSpacing: '0.5px',
                            display: 'block',
                            mb: 0.75,
                          }}
                        >
                          Departments
                        </Typography>
                        {renderChips(metadata.departments)}
                      </Box>
                    )}

                    {/* Categories */}
                    {metadata?.categories && metadata.categories.length > 0 && (
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          gutterBottom
                          sx={{
                            textTransform: 'uppercase',
                            fontWeight: 500,
                            letterSpacing: '0.5px',
                            display: 'block',
                            mb: 0.75,
                          }}
                        >
                          Document Category
                        </Typography>
                        {renderChips(metadata.categories)}
                      </Box>
                    )}

                    {/* Subcategories1 */}
                    {metadata?.subcategories1 && metadata.subcategories1.length > 0 && (
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          gutterBottom
                          sx={{
                            textTransform: 'uppercase',
                            fontWeight: 500,
                            letterSpacing: '0.5px',
                            display: 'block',
                            mb: 0.75,
                          }}
                        >
                         Document Sub-category Level 1
                        </Typography>
                        {renderChips(metadata.subcategories1)}
                      </Box>
                    )}
 
                    {/* Subcategories2 */}
                    {metadata?.subcategories2 && metadata.subcategories2.length > 0 && (
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          gutterBottom
                          sx={{
                            textTransform: 'uppercase',
                            fontWeight: 500,
                            letterSpacing: '0.5px',
                            display: 'block',
                            mb: 0.75,
                          }}
                        >
                          Document Sub-category Level 2
                        </Typography>
                        {renderChips(metadata.subcategories2)}
                      </Box>
                    )}

                    {/* Subcategories3 */}
                    {metadata?.subcategories3 && metadata.subcategories3.length > 0 && (
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          gutterBottom
                          sx={{
                            textTransform: 'uppercase',
                            fontWeight: 500,
                            letterSpacing: '0.5px',
                            display: 'block',
                            mb: 0.75,
                          }}
                        >
                          Document Sub-category Level 3
                        </Typography>
                        {renderChips(metadata.subcategories3)}
                      </Box>
                    )}

                    {/* Topics */}
                    {metadata?.topics && metadata.topics.length > 0 && (
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          gutterBottom
                          sx={{
                            textTransform: 'uppercase',
                            fontWeight: 500,
                            letterSpacing: '0.5px',
                            display: 'block',
                            mb: 0.75,
                          }}
                        >
                          Topics
                        </Typography>
                        {renderChips(metadata.topics)}
                      </Box>
                    )}

                    {/* Languages */}
                    {metadata?.languages && metadata.languages.length > 0 && (
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          gutterBottom
                          sx={{
                            textTransform: 'uppercase',
                            fontWeight: 500,
                            letterSpacing: '0.5px',
                            display: 'block',
                            mb: 0.75,
                          }}
                        >
                          Languages
                        </Typography>
                        {renderChips(metadata.languages)}
                      </Box>
                    )}

                    <Divider />

                    {/* Original department section from the record */}
                    {record.departments && record.departments.length > 0 && (
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          gutterBottom
                          sx={{
                            textTransform: 'uppercase',
                            fontWeight: 500,
                            letterSpacing: '0.5px',
                            display: 'block',
                            mb: 0.75,
                          }}
                        >
                          Record Departments
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {record.departments.map((dept) => (
                            <Chip
                              key={dept._id}
                              label={dept.name}
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                bgcolor: alpha(theme.palette.primary.main, 0.08),
                                color: theme.palette.primary.main,
                                '&:hover': {
                                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                                },
                              }}
                            />
                          ))}
                        </Box>
                      </Box>
                    )}

                    {/* Original categories from the record */}
                    {record.appSpecificRecordType && record.appSpecificRecordType.length > 0 && (
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          gutterBottom
                          sx={{
                            textTransform: 'uppercase',
                            fontWeight: 500,
                            letterSpacing: '0.5px',
                            display: 'block',
                            mb: 0.75,
                          }}
                        >
                          Record Categories
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {record.appSpecificRecordType.map((type) => (
                            <Chip
                              key={type._id}
                              label={type.name}
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                bgcolor: alpha(theme.palette.primary.main, 0.08),
                                color: theme.palette.primary.main,
                                '&:hover': {
                                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                                },
                              }}
                            />
                          ))}
                        </Box>
                      </Box>
                    )}

                    {/* Original modules from the record */}

                    {record.createdBy && (
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          gutterBottom
                          sx={{
                            textTransform: 'uppercase',
                            fontWeight: 500,
                            letterSpacing: '0.5px',
                            display: 'block',
                            mb: 0.75,
                          }}
                        >
                          Created By
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                          }}
                        >
                          <Icon icon={accountIcon} style={{ fontSize: '18px', opacity: 0.7 }} />
                          {(users && users.find((u) => u._id === record.createdBy)?.fullName) ||
                            'Unknown'}
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
        {/* Edit Record Dialog */}
        {recordData && recordData.record && recordData.knowledgeBase && (
          <EditRecordDialog
            open={isEditDialogOpen}
            onClose={() => setIsEditDialogOpen(false)}
            onRecordUpdated={refreshRecordData}
            storageDocumentId={record.externalRecordId}
            recordId={record._key}
            record={record}
          />
        )}
        {recordData && recordData.record && (
          <DeleteRecordDialog
            open={isDeleteDialogOpen}
            onClose={() => setIsDeleteDialogOpen(false)}
            onRecordDeleted={handleDeleteRecord}
            recordId={record._key}
            recordName={record.recordName}
          />
        )}
      </Box>

      {/* Chat Drawer */}
      <Drawer
        anchor="right"
        open={isChatOpen}
        onClose={toggleChat}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: '1050px', md: '1050px' },
            maxWidth: '100%',
            boxShadow: '-1px 0 8px rgba(0, 0, 0, 0.15)',
          },
        }}
        BackdropProps={{
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
          },
        }}
      >
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Chat Header */}
          <Box
            sx={{
              px: 3,
              py: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon
                  icon={robotIcon}
                  style={{ fontSize: '18px', color: theme.palette.primary.main }}
                />
              </Box>
              <Box>
                <Typography variant="subtitle2" fontWeight={500}>
                  AI Assistant
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Ask questions about this document
                </Typography>
              </Box>
            </Box>
            <IconButton
              onClick={toggleChat}
              size="small"
              sx={{ bgcolor: alpha('#000', 0.03), borderRadius: 1 }}
            >
              <Icon icon={closeIcon} fontSize={18} />
            </IconButton>
          </Box>

          {/* Chat Interface */}
          <Box sx={{ flexGrow: 1 }}>
            <RecordSalesAgent
              key={record._id} // Force new instance when record changes
              initialContext={{
                recordId: record._id,
                recordName: record.recordName,
                recordType: record.recordType,
                departments: record.departments?.map((d) => d.name),
                modules: record.modules?.map((m) => m.name),
                categories: record.appSpecificRecordType?.map((t) => t.name),
              }}
              recordId={record._id}
              containerStyle={{ height: '100%' }}
            />
          </Box>
        </Box>
      </Drawer>
    </>
  );
}

// Helper function to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
};

// Get file icon based on extension
function getFileIcon(extension: string): React.ComponentProps<typeof IconifyIcon>['icon'] {
  const ext = extension?.toLowerCase() || '';

  switch (ext) {
    case 'pdf':
      return filePdfBoxIcon;
    case 'doc':
    case 'docx':
      return fileWordBoxIcon;
    case 'xls':
    case 'xlsx':
      return fileExcelBoxIcon;
    case 'ppt':
    case 'pptx':
      return filePowerpointBoxIcon;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
      return fileImageBoxIcon;
    case 'zip':
    case 'rar':
    case '7z':
      return fileArchiveBoxIcon;
    case 'txt':
      return fileTextBoxIcon;
    case 'html':
    case 'css':
    case 'js':
      return fileCodeBoxIcon;
    default:
      return fileDocumentBoxIcon;
  }
}

// Get file icon color based on extension
function getFileIconColor(extension: string): string {
  const ext = extension?.toLowerCase() || '';

  switch (ext) {
    case 'pdf':
      return '#f44336';
    case 'doc':
    case 'docx':
      return '#2196f3';
    case 'xls':
    case 'xlsx':
      return '#4caf50';
    case 'ppt':
    case 'pptx':
      return '#ff9800';
    default:
      return '#1976d2';
  }
}
