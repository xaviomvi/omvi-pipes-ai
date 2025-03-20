import type { GridColDef, GridRowParams } from '@mui/x-data-grid';

import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router';
import { useDropzone } from 'react-dropzone';
import React, { useState, useEffect } from 'react';

import { DataGrid } from '@mui/x-data-grid';
import {
  Box,
  Chip,
  Paper,
  Stack,
  alpha,
  Alert,
  Button,
  Dialog,
  Select,
  styled,
  Popover,
  Divider,
  Checkbox,
  MenuItem,
  FormGroup,
  TextField,
  Typography,
  Pagination,
  IconButton,
  AlertTitle,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  CircularProgress
} from '@mui/material';

import { useUsers } from 'src/context/UserContext';

import { handleDownloadDocument, uploadKnowledgeBaseFiles } from './utils';

import type { Record, KnowledgeBaseDetailsProps } from './types/knowledge-base';

interface ColumnVisibilityModel {
  [key: string]: boolean;
}

interface FileSizeErrorState {
  show: boolean;
  files: File[];
}

interface UploadErrorState {
  show: boolean;
  message: string;
}

const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  textTransform: 'none',
  fontWeight: 600,
  boxShadow: theme.shadows[2],
  '&:hover': {
    boxShadow: theme.shadows[4],
  },
}));

// Maximum file size: 30MB in bytes
const MAX_FILE_SIZE = 30 * 1024 * 1024;

export default function KnowledgeBaseDetails({
  knowledgeBaseData,
  onSearchChange,
  loading,
  pagination,
  onPageChange,
  onLimitChange,
}: KnowledgeBaseDetailsProps) {
  const [columnVisibilityModel, setColumnVisibilityModel] = useState<ColumnVisibilityModel>({});
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [openUploadDialog, setOpenUploadDialog] = useState<boolean>(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [fileSizeError, setFileSizeError] = useState<FileSizeErrorState>({ show: false, files: [] });
  const [uploadError, setUploadError] = useState<UploadErrorState>({ show: false, message: '' });
  const users = useUsers();

  const navigate = useNavigate();

  const handleRowClick = (params: GridRowParams, event: React.MouseEvent): void => {
    const isCheckboxClick = (event.target as HTMLElement).closest('.MuiDataGrid-cellCheckbox');
    if (!isCheckboxClick) {
      navigate(`/knowledge-base/record/${params.id}`);
    }
  };

  // Validate file size
  const validateFileSize = (filesToCheck: File[]) => {
    const oversizedFiles = filesToCheck.filter(file => file.size > MAX_FILE_SIZE);
    return {
      valid: oversizedFiles.length === 0,
      oversizedFiles
    };
  };

  // Modified onDrop function with file size validation
  const onDrop = (acceptedFiles: File[]) => {
    // Check for files exceeding size limit
    const { valid, oversizedFiles } = validateFileSize(acceptedFiles);
    
    if (!valid) {
      // Show error for oversized files
      setFileSizeError({
        show: true,
        files: oversizedFiles
      });
      
      // Only keep files that are within the size limit
      const validFiles = acceptedFiles.filter(file => file.size <= MAX_FILE_SIZE);
      setFiles(validFiles);
    } else {
      // All files are valid
      setFileSizeError({ show: false, files: [] });
      setFiles(acceptedFiles);
    }
  };

  // Enhanced dropzone with file size validation
  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    multiple: true,
    maxSize: MAX_FILE_SIZE,
    onDropRejected: (rejectedFiles) => {
      const oversizedFiles = rejectedFiles
        .filter(file => file.errors.some(error => error.code === 'file-too-large'))
        .map(file => file.file);
      
      if (oversizedFiles.length > 0) {
        setFileSizeError({
          show: true,
          files: oversizedFiles
        });
      }
    }
  });

  // Monitor fileRejections for size issues
  useEffect(() => {
    if (fileRejections.length > 0) {
      const oversizedFiles = fileRejections
        .filter(file => file.errors.some(error => error.code === 'file-too-large'))
        .map(file => file.file);
      
      if (oversizedFiles.length > 0) {
        setFileSizeError({
          show: true,
          files: oversizedFiles
        });
      }
    }
  }, [fileRejections]);

  const handleFileSizeErrorClose = () => {
    setFileSizeError({ show: false, files: [] });
  };

  const handleUploadErrorClose = () => {
    setUploadError({ show: false, message: '' });
  };

  const handleSearchInputChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    onSearchChange(event.target.value);
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / (k ** i)).toFixed(2))} ${sizes[i]}`;
  };

  // Get file icon based on extension
  const getFileIcon = (extension: string): string => {
    const ext = extension?.toLowerCase() || '';

    switch (ext) {
      case 'pdf':
        return 'mdi:file-pdf-box';
      case 'doc':
      case 'docx':
        return 'mdi:file-word-box';
      case 'xls':
      case 'xlsx':
        return 'mdi:file-excel-box';
      case 'ppt':
      case 'pptx':
        return 'mdi:file-powerpoint-box';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return 'mdi:file-image-box';
      case 'zip':
      case 'rar':
      case '7z':
        return 'mdi:file-archive-box';
      case 'txt':
        return 'mdi:file-text-box';
      case 'html':
      case 'css':
      case 'js':
        return 'mdi:file-code-box';
      default:
        return 'mdi:file-document-box';
    }
  };

  // Get file icon color based on extension
  const getFileIconColor = (extension: string): string => {
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
  };

  const columns: GridColDef<Record>[] = [
    {
      field: 'recordName',
      headerName: 'Name',
      flex: 1,
      minWidth: 200,
      renderCell: (params) => {
        const extension = params.row.fileRecord?.extension || '';
        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              height: '100%',
              width: '100%',
              pl: 0.5,
            }}
          >
            <Icon
              icon={extension ? getFileIcon(extension) : 'mdi:folder-outline'}
              style={{
                fontSize: '20px',
                color: getFileIconColor(extension),
                marginRight: '12px',
                flexShrink: 0,
              }}
            />
            <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
              {params.value}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: 'recordType',
      headerName: 'Type',
      width: 110,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            mt: 1.5,
          }}
        >
          <Chip
            label={params.value}
            size="small"
            color={params.value === 'FILE' ? 'primary' : 'secondary'}
            sx={{
              height: 24,
              minWidth: 70,
              fontWeight: 500,
              fontSize: '0.75rem',
            }}
          />
        </Box>
      ),
    },
    {
      field: 'indexingStatus',
      headerName: 'Status',
      width: 120,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const status = params.value || 'NOT STARTED';
        let color: 'default' | 'primary' | 'success' | 'error' | 'info' | 'warning' = 'default';

        switch (status) {
          case 'COMPLETED':
            color = 'success';
            break;
          case 'IN_PROGRESS':
            color = 'info';
            break;
          case 'FAILED':
            color = 'error';
            break;
          case 'NOT STARTED':
            color = 'warning';
            break;
          default:
            color = 'warning';
        }

        return (
          <Box
            sx={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              mt: 1.5,
            }}
          >
            <Chip
              label={status || 'PENDING'}
              size="small"
              color={color}
              sx={{
                height: 24,
                minWidth: 85,
                fontWeight: 500,
                fontSize: '0.75rem',
              }}
            />
          </Box>
        );
      },
    },
    {
      field: 'origin',
      headerName: 'Origin',
      width: 120,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            mt: 1.5,
          }}
        >
          <Chip
            label={params.value}
            size="small"
            variant="outlined"
            sx={{
              height: 24,
              minWidth: 70,
              fontWeight: 500,
              fontSize: '0.75rem',
            }}
          />
        </Box>
      ),
    },
    {
      field: 'fileRecord',
      headerName: 'File Size',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params) => (
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            pr: 2,
            mt: 1.5,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {params.value ? formatFileSize(params.value.sizeInBytes) : '-'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'createdAtTimestamp',
      headerName: 'Created',
      width: 170,
      align: 'left',
      headerAlign: 'left',
      renderCell: (params) => (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            justifyContent: 'center',
            pl: 2,
          }}
        >
          <Typography variant="body2" lineHeight={1.4}>
            {params.value ? new Date(params.value).toLocaleDateString() : '-'}
          </Typography>
          <Typography variant="caption" color="text.secondary" lineHeight={1.4}>
            {params.value
              ? new Date(params.value).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : ''}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'updatedAtTimestamp',
      headerName: 'Updated',
      width: 170,
      align: 'left',
      headerAlign: 'left',
      renderCell: (params) => (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            justifyContent: 'center',
            pl: 2,
          }}
        >
          <Typography variant="body2" lineHeight={1.4}>
            {params.value ? new Date(params.value).toLocaleDateString() : '-'}
          </Typography>
          <Typography variant="caption" color="text.secondary" lineHeight={1.4}>
            {params.value
              ? new Date(params.value).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : ''}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'version',
      headerName: 'Version',
      width: 140,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 1,
            mt: 1.5,
          }}
        >
          <Chip
            label={params.value || '1.0'}
            size="small"
            variant="outlined"
            sx={{
              minWidth: 40,
              height: 24,
              fontWeight: 500,
              fontSize: '0.75rem',
            }}
          />
         
        </Box>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            mt: 1,
          }}
        >
          <IconButton
            size="small"
            color="primary"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/knowledge-base/record/${params.row.id}`)
            }}
            sx={{ mx: 0.5 }}
          >
            <Icon icon="mdi:eye-outline" fontSize={18} />
          </IconButton>
          <IconButton
            size="small"
            color="primary"
            onClick={(e) => {
              e.stopPropagation();
              handleDownloadDocument(params.row.externalRecordId, params.row.recordName)
            }}
            sx={{ mx: 0.5 }}
          >
            <Icon icon="mdi:download-outline" fontSize={18} />
          </IconButton>
        </Box>
      ),
    },
  ];

  const handleColumnVisibilityClick = (event: React.MouseEvent<HTMLElement>): void => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleUploadDialogClose = () => {
    setOpenUploadDialog(false);
    setFiles([]);
    setFileSizeError({ show: false, files: [] });
    setUploadError({ show: false, message: '' });
  };

  // File size error alert component
  const FileSizeErrorAlert = () => {
    if (!fileSizeError.show) return null;
    
    return (
      <Box sx={{ mb: 3 }}>
        <Alert 
          severity="error" 
          onClose={handleFileSizeErrorClose}
          sx={{ 
            borderRadius: '8px',
            '& .MuiAlert-message': { width: '100%' }
          }}
        >
          <AlertTitle>File size exceeds limit</AlertTitle>
          <Typography variant="body2" sx={{ mb: 1 }}>
            The following file(s) exceed the maximum upload size of 30MB:
          </Typography>
          <Box 
            sx={{ 
              maxHeight: '100px', 
              overflowY: 'auto',
              bgcolor: alpha('#f44336', 0.05),
              borderRadius: '4px',
              p: 1
            }}
          >
            {fileSizeError.files.map((file, index) => (
              <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                • {file.name} ({formatFileSize(file.size)})
              </Typography>
            ))}
          </Box>
          <Typography variant="body2" sx={{ mt: 1, fontWeight: 500 }}>
            Please reduce file size or select different files.
          </Typography>
        </Alert>
      </Box>
    );
  };

  // Upload error alert component
  const UploadErrorAlert = () => {
    if (!uploadError.show) return null;
    
    return (
      <Box sx={{ mb: 3 }}>
        <Alert 
          severity="error" 
          onClose={handleUploadErrorClose}
          sx={{ borderRadius: '8px' }}
        >
          <AlertTitle>Upload Failed</AlertTitle>
          <Typography variant="body2">
            {uploadError.message}
          </Typography>
        </Alert>
      </Box>
    );
  };

  // Modified handleUpload function with file size validation
  const handleUpload = async () => {
    if (files.length === 0) {
      console.error('No files selected for upload.');
      return;
    }

    // Double-check file sizes before uploading
    const { valid, oversizedFiles } = validateFileSize(files);
    if (!valid) {
      setFileSizeError({
        show: true,
        files: oversizedFiles
      });
      return;
    }

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      setUploading(true);
      await uploadKnowledgeBaseFiles(formData);

      console.log('Files uploaded successfully!');
      handleUploadDialogClose();
      // Trigger a refresh of the knowledge base data
      onSearchChange('');
    } catch (error: any) {
      console.error('Error uploading files:', error);
      setUploadError({
        show: true,
        message: error.message || 'Failed to upload files. Please try again.'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleColumnToggle = (field: string): void => {
    setColumnVisibilityModel((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleShowAll = (): void => {
    const allVisible: ColumnVisibilityModel = {};
    columns.forEach((column) => {
      allVisible[column.field] = true;
    });
    setColumnVisibilityModel(allVisible);
  };

  const handleReset = () => {
    setColumnVisibilityModel({});
  };

  const open = Boolean(anchorEl);
  const id = open ? 'column-visibility-popover' : undefined;

  return (
    <Box sx={{ height: 'calc(100vh - 100px)', width: '100%', p: 3 }}>
      {/* Header section */}
      <Paper
        elevation={0}
        sx={{
          mb: 2.5,
          borderRadius: '12px',
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h5" fontWeight={600} color="text.primary">
            Knowledge Base
          </Typography>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              placeholder="Search files..."
              variant="outlined"
              size="small"
              onChange={handleSearchInputChange}
              InputProps={{
                startAdornment: (
                  <Icon icon="mdi:magnify" style={{ marginRight: 8, color: '#757575' }} />
                ),
              }}
              sx={{
                width: 240,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                },
              }}
            />
            <Button
              variant="outlined"
              startIcon={<Icon icon="mdi:view-column" />}
              onClick={handleColumnVisibilityClick}
              sx={{
                width: 100,
                borderRadius: '8px',
              }}
            >
              Columns
            </Button>
            <StyledButton
              variant="outlined"
              startIcon={<Icon icon="mdi:upload" />}
              onClick={() => setOpenUploadDialog(true)}
              sx={{
                width: 100,
                borderRadius: '8px',
              }}
            >
              Upload
            </StyledButton>
          </Stack>
        </Stack>
      </Paper>

      {/* Main content area */}
      <Paper
        elevation={0}
        sx={{
          overflow: 'hidden',
          height: 'calc(100vh - 200px)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <CircularProgress size={36} thickness={4} />
            <Typography variant="body1" color="text.secondary">
              Loading knowledge base data...
            </Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ flexGrow: 1, height: 'calc(100% - 64px)' }}>
              <DataGrid<Record>
                rows={knowledgeBaseData?.records || []}
                columns={columns}
                hideFooterPagination
                checkboxSelection
                disableRowSelectionOnClick
                columnVisibilityModel={columnVisibilityModel}
                onColumnVisibilityModelChange={(newModel) => setColumnVisibilityModel(newModel)}
                onRowClick={handleRowClick}
                getRowId={(row) => row.id}
                rowHeight={56}
                sx={{
                  border: 'none',
                  height: '100%',
                  '& .MuiDataGrid-columnHeaders': {
                    backgroundColor: alpha('#000', 0.02),
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    minHeight: '56px !important',
                    height: '56px !important',
                    maxHeight: '56px !important',
                    lineHeight: '56px !important',
                  },
                  '& .MuiDataGrid-columnHeader': {
                    height: '56px !important',
                    maxHeight: '56px !important',
                    lineHeight: '56px !important',
                  },
                  '& .MuiDataGrid-columnHeaderTitle': {
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    color: 'text.primary',
                  },
                  '& .MuiDataGrid-cell': {
                    border: 'none',
                    padding: 0,
                    maxHeight: '56px !important',
                    minHeight: '56px !important',
                    height: '56px !important',
                    lineHeight: '56px !important',
                  },
                  '& .MuiDataGrid-cellContent': {
                    maxHeight: '56px !important',
                    height: '56px !important',
                    lineHeight: '56px !important',
                  },
                  '& .MuiDataGrid-row': {
                    maxHeight: '56px !important',
                    minHeight: '56px !important',
                    height: '56px !important',
                    borderBottom: '1px solid',
                    borderColor: alpha('#000', 0.05),
                    '&:hover': {
                      backgroundColor: alpha('#1976d2', 0.03),
                      cursor: 'pointer',
                    },
                    '&.Mui-selected': {
                      backgroundColor: alpha('#1976d2', 0.08),
                      '&:hover': {
                        backgroundColor: alpha('#1976d2', 0.12),
                      },
                    },
                  },
                  '& .MuiDataGrid-cell:focus, .MuiDataGrid-cell:focus-within': {
                    outline: 'none',
                  },
                  '& .MuiDataGrid-columnHeader:focus, .MuiDataGrid-columnHeader:focus-within': {
                    outline: 'none',
                  },
                  // Styling for the checkbox cell
                  '& .MuiDataGrid-columnHeaderCheckbox, & .MuiDataGrid-cellCheckbox': {
                    width: '56px !important',
                    minWidth: '56px !important',
                    maxWidth: '56px !important',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                  '& .MuiCheckbox-root': {
                    padding: '4px',
                  },
                }}
              />
            </Box>

            {/* Pagination footer */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                px: 3,
                py: 2,
                borderTop: '1px solid',
                borderColor: alpha('#000', 0.05),
                bgcolor: alpha('#000', 0.01),
                height: '54px',
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {knowledgeBaseData?.pagination?.totalCount === 0
                  ? 'No records found'
                  : `Showing ${(pagination.page - 1) * pagination.limit + 1}-
                  ${Math.min(pagination.page * pagination.limit, knowledgeBaseData?.pagination?.totalCount || 0)} 
                  of ${knowledgeBaseData?.pagination?.totalCount || 0} records`}
              </Typography>

              <Stack direction="row" spacing={2} alignItems="center">
                <Pagination
                  count={knowledgeBaseData?.pagination?.totalPages || 1}
                  page={pagination.page}
                  onChange={(event, value) => onPageChange(value)}
                  color="primary"
                  size="small"
                  shape="rounded"
                  sx={{
                    '& .MuiPaginationItem-root': {
                      borderRadius: '6px',
                    },
                  }}
                />
                <Select
                  value={pagination.limit}
                  onChange={(event) => onLimitChange(parseInt(event.target.value as string, 10))}
                  size="small"
                  sx={{
                    minWidth: 100,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px',
                    },
                  }}
                >
                  <MenuItem value={10}>10 per page</MenuItem>
                  <MenuItem value={20}>20 per page</MenuItem>
                  <MenuItem value={50}>50 per page</MenuItem>
                  <MenuItem value={100}>100 per page</MenuItem>
                </Select>
              </Stack>
            </Box>
          </>
        )}
      </Paper>

      {/* Column visibility popover */}
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          elevation: 2,
          sx: {
            borderRadius: '12px',
            mt: 1,
            width: 280,
            p: 2,
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          },
        }}
      >
        <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 600 }}>
          Column Visibility
        </Typography>
        <Divider sx={{ mb: 1.5 }} />

        <Box sx={{ maxHeight: 300, overflow: 'auto', pr: 1 }}>
          <FormGroup>
            {columns.map((column) => (
              <FormControlLabel
                key={column.field}
                control={
                  <Checkbox
                    checked={columnVisibilityModel[column.field] !== false}
                    onChange={() => handleColumnToggle(column.field)}
                    size="small"
                    color="primary"
                  />
                }
                label={<Typography variant="body2">{column.headerName}</Typography>}
                sx={{ mb: 0.5 }}
              />
            ))}
          </FormGroup>
        </Box>

        <Divider sx={{ my: 1.5 }} />

        <Stack direction="row" spacing={1} justifyContent="space-between">
          <Button
            size="small"
            variant="outlined"
            onClick={handleReset}
            startIcon={<Icon icon="mdi:refresh" />}
            sx={{ borderRadius: '8px' }}
          >
            Reset
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleShowAll}
            startIcon={<Icon icon="mdi:eye" />}
            sx={{ borderRadius: '8px' }}
          >
            Show All
          </Button>
        </Stack>
      </Popover>

      {/* Upload dialog */}
      <Dialog
        open={openUploadDialog}
        onClose={handleUploadDialogClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          elevation: 3,
          sx: { borderRadius: '12px' },
        }}
      >
        <DialogTitle
          sx={{ px: 3, py: 2.5, borderBottom: '1px solid', borderColor: alpha('#000', 0.08) }}
        >
          <Typography variant="h6" fontWeight={600}>
            Upload Documents
          </Typography>
        </DialogTitle>

        {uploading ? (
          <DialogContent
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '250px',
              py: 4,
            }}
          >
            <CircularProgress size={40} thickness={4} sx={{ mb: 3 }} />
            <Typography variant="subtitle1" fontWeight={500}>
              Uploading your files...
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              This may take a few moments
            </Typography>
          </DialogContent>
        ) : (
          <DialogContent sx={{ px: 3, py: 3 }}>
            {/* File Size Error Alert */}
            <FileSizeErrorAlert />
            
            {/* Upload Error Alert */}
            <UploadErrorAlert />

            <Box
              {...getRootProps()}
              sx={{
                border: '2px dashed',
                borderColor: isDragActive ? 'primary.main' : alpha('#000', 0.15),
                borderRadius: '12px',
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                mb: 3,
                transition: 'all 0.2s ease-in-out',
                bgcolor: isDragActive ? alpha('#1976d2', 0.04) : 'transparent',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: alpha('#1976d2', 0.04),
                },
              }}
            >
              <input {...getInputProps()} />
              <Icon
                icon="mdi:cloud-upload-outline"
                style={{
                  fontSize: '48px',
                  marginBottom: '16px',
                  color: isDragActive ? '#1976d2' : '#757575',
                }}
              />
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 500 }}>
                {isDragActive ? 'Drop the files here...' : 'Drag and drop files here'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                or click to browse from your computer
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Icon icon="mdi:file-plus" />}
                sx={{ borderRadius: '8px' }}
              >
                Select Files
              </Button>
              <Typography variant="caption" display="block" sx={{ mt: 2, color: 'text.secondary' }}>
                Maximum file size: 30MB
              </Typography>
            </Box>

            {files.length > 0 && (
              <Paper
                variant="outlined"
                sx={{
                  mt: 3,
                  p: 2,
                  borderRadius: '12px',
                  bgcolor: alpha('#000', 0.01),
                  border: `1px solid ${alpha('#000', 0.08)}`,
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle1" fontWeight={500}>
                    Selected Files ({files.length})
                  </Typography>
                  <Button
                    size="small"
                    color="error"
                    variant="text"
                    onClick={() => setFiles([])}
                    startIcon={<Icon icon="mdi:trash-can-outline" />}
                    sx={{ borderRadius: '8px' }}
                  >
                    Clear All
                  </Button>
                </Stack>

                <Box
                  sx={{
                    maxHeight: '200px',
                    overflow: 'auto',
                    '&::-webkit-scrollbar': {
                      width: '4px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      backgroundColor: 'rgba(0,0,0,.2)',
                      borderRadius: '4px',
                    },
                  }}
                >
                  {files.map((file, index) => {
                    const extension = file.name.split('.').pop() || '';
                    return (
                      <Stack
                        key={file.name + index}
                        direction="row"
                        alignItems="center"
                        spacing={1.5}
                        sx={{
                          mb: 1,
                          p: 1.5,
                          borderRadius: '8px',
                          '&:hover': {
                            bgcolor: 'background.paper',
                          },
                        }}
                      >
                        <Icon
                          icon={getFileIcon(extension)}
                          style={{
                            fontSize: '24px',
                            color: getFileIconColor(extension),
                            flexShrink: 0,
                          }}
                        />
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography variant="body2" noWrap title={file.name} fontWeight={500}>
                            {file.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatFileSize(file.size)}
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                          sx={{ p: 0.5, flexShrink: 0 }}
                        >
                          <Icon icon="mdi:close" fontSize={18} />
                        </IconButton>
                      </Stack>
                    );
                  })}
                </Box>
              </Paper>
            )}
          </DialogContent>
        )}

        <DialogActions
          sx={{ px: 3, py: 2.5, borderTop: '1px solid', borderColor: alpha('#000', 0.08) }}
        >
          <Button
            onClick={handleUploadDialogClose}
            disabled={uploading}
            color="inherit"
            sx={{ borderRadius: '8px' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            variant="contained"
            disabled={files.length === 0 || uploading}
            startIcon={<Icon icon="mdi:cloud-upload" />}
            sx={{ borderRadius: '8px' }}
          >
            Upload
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}