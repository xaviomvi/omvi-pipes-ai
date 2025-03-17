// import { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
// import { alpha, useTheme } from '@mui/material/styles';
// import { Box, Alert, Typography, CircularProgress, Button, Link, Paper } from '@mui/material';

// import axios from 'src/utils/axios';
// import { Iconify } from 'src/components/iconify';

// interface GoogleWorkspaceConfigFormProps {
//   onValidationChange: (isValid: boolean) => void;
//   onSaveSuccess?: () => void;
// }

// export interface GoogleWorkspaceConfigFormRef {
//   handleSave: () => Promise<boolean>;
// }

// export const GoogleWorkspaceConfigForm = forwardRef<
//   GoogleWorkspaceConfigFormRef,
//   GoogleWorkspaceConfigFormProps
// >(({ onValidationChange, onSaveSuccess }, ref) => {
//   const theme = useTheme();
//   const fileInputRef = useRef<HTMLInputElement>(null);

//   const [isLoading, setIsLoading] = useState(false);
//   const [isSaving, setIsSaving] = useState(false);
//   const [saveError, setSaveError] = useState<string | null>(null);
//   const [fileName, setFileName] = useState<string | null>(null);
//   const [fileUploadError, setFileUploadError] = useState<string | null>(null);
//   const [selectedFile, setSelectedFile] = useState<File | null>(null);

//   // Expose the handleSave method to the parent component
//   useImperativeHandle(ref, () => ({
//     handleSave,
//   }));

//   // Update validation state when file is selected or removed
//   useEffect(() => {
//     onValidationChange(!!selectedFile);
//   }, [selectedFile, onValidationChange]);

//   // Handle file upload click
//   const handleUploadClick = () => {
//     if (fileInputRef.current) {
//       fileInputRef.current.click();
//     }
//   };

//   // Handle file selection
//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (!file) {
//       setSelectedFile(null);
//       setFileName(null);
//       setFileUploadError(null);
//       onValidationChange(false);
//       return;
//     }

//     setFileName(file.name);
//     setFileUploadError(null);

//     // Check file type
//     if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
//       setFileUploadError('Only JSON files are accepted.');
//       setSelectedFile(null);
//       onValidationChange(false);
//       return;
//     }

//     setSelectedFile(file);
//     onValidationChange(true);
//   };

//   // Handle save - upload the file directly
//   const handleSave = async (): Promise<boolean> => {
//     if (!selectedFile) {
//       setFileUploadError('Please select a JSON file to upload.');
//       return false;
//     }

//     setIsSaving(true);
//     setSaveError(null);

//     try {
//       // Create FormData with the specific field name that the server expects
//       const formData = new FormData();

//       // Make sure "file" is the field name expected by your server middleware
//       // Check that this matches the field name in your multer configuration
//       formData.append('googleWorkspaceCredentials', selectedFile);

//       // Add the userType to the form data
//       formData.append('userType', 'business');

//       // Log the file size to confirm it's not empty
//       console.log('Uploading file:', selectedFile.name, 'Size:', selectedFile.size, 'bytes');

//       // Send the file to the backend
//       const response = await axios.post('/api/v1/connectors/credentials', formData, {
//         params: {
//           service: 'googleWorkspace',
//         },
//         headers: {
//           // Don't set Content-Type explicitly - axios will set it with the correct boundary
//           // when using FormData
//         },
//       });

//       console.log('Upload response:', response);

//       if (onSaveSuccess) {
//         onSaveSuccess();
//       }

//       return true;
//     } catch (error) {
//       console.error('Error uploading Google Workspace config:', error);
//       setSaveError('Failed to upload Google Workspace configuration file');
//       return false;
//     } finally {
//       setIsSaving(false);
//     }
//   };

//   // Handle file removal
//   const handleRemoveFile = () => {
//     setSelectedFile(null);
//     setFileName(null);
//     if (fileInputRef.current) {
//       fileInputRef.current.value = '';
//     }
//     onValidationChange(false);
//   };

//   return (
//     <>
//       {isLoading ? (
//         <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
//           <CircularProgress size={24} />
//         </Box>
//       ) : (
//         <>
//           {saveError && (
//             <Alert
//               severity="error"
//               sx={{
//                 mb: 3,
//                 borderRadius: 1,
//               }}
//             >
//               {saveError}
//             </Alert>
//           )}

//           <Box
//             sx={{
//               mb: 3,
//               p: 2,
//               borderRadius: 1,
//               bgcolor: alpha(theme.palette.info.main, 0.04),
//               border: `1px solid ${alpha(theme.palette.info.main, 0.15)}`,
//               display: 'flex',
//               alignItems: 'flex-start',
//               gap: 1,
//             }}
//           >
//             <Iconify
//               icon="eva:info-outline"
//               width={20}
//               height={20}
//               color={theme.palette.info.main}
//               style={{ marginTop: 2 }}
//             />
//             <Box>
//               <Typography variant="body2" color="text.secondary">
//                 To configure Google Workspace integration, you need to upload your OAuth 2.0
//                 credentials JSON file from the{' '}
//                 <Link
//                   href="https://console.cloud.google.com/apis/credentials"
//                   target="_blank"
//                   rel="noopener"
//                   sx={{ fontWeight: 500 }}
//                 >
//                   Google Cloud Console
//                 </Link>
//                 .
//               </Typography>
//             </Box>
//           </Box>

//           {/* File Upload Section */}
//           <Box sx={{ mb: 3 }}>
//             <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
//               Upload Credentials JSON
//             </Typography>

//             <Paper
//               variant="outlined"
//               sx={{
//                 p: 2,
//                 display: 'flex',
//                 flexDirection: { xs: 'column', sm: 'row' },
//                 alignItems: 'center',
//                 justifyContent: 'space-between',
//                 borderColor: alpha(theme.palette.primary.main, 0.2),
//                 borderStyle: 'dashed',
//                 borderRadius: 1,
//                 bgcolor: alpha(theme.palette.primary.main, 0.02),
//                 gap: 2,
//               }}
//             >
//               <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
//                 <Box
//                   sx={{
//                     display: 'flex',
//                     alignItems: 'center',
//                     justifyContent: 'center',
//                     width: 40,
//                     height: 40,
//                     borderRadius: '8px',
//                     bgcolor: alpha(theme.palette.primary.main, 0.08),
//                   }}
//                 >
//                   <Iconify
//                     icon="mdi:file-text-outline"
//                     width={24}
//                     height={24}
//                     color={theme.palette.primary.main}
//                   />
//                 </Box>

//                 <Box>
//                   <Typography variant="subtitle2">{fileName || 'No file selected'}</Typography>
//                   <Typography variant="caption" color="text.secondary">
//                     Upload your Google Cloud OAuth credentials JSON file
//                   </Typography>
//                 </Box>
//               </Box>

//               {selectedFile ? (
//                 <Button
//                   variant="outlined"
//                   size="small"
//                   onClick={handleRemoveFile}
//                   startIcon={<Iconify icon="eva:trash-outline" width={18} height={18} />}
//                   color="error"
//                   sx={{
//                     minWidth: 120,
//                     flexShrink: 0,
//                   }}
//                 >
//                   Remove
//                 </Button>
//               ) : (
//                 <Button
//                   variant="outlined"
//                   size="small"
//                   onClick={handleUploadClick}
//                   startIcon={<Iconify icon="eva:upload-outline" width={18} height={18} />}
//                   sx={{
//                     minWidth: 120,
//                     flexShrink: 0,
//                   }}
//                 >
//                   Upload JSON
//                 </Button>
//               )}

//               <input
//                 ref={fileInputRef}
//                 type="file"
//                 accept="application/json"
//                 onChange={handleFileChange}
//                 style={{ display: 'none' }}
//               />
//             </Paper>

//             {fileUploadError && (
//               <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
//                 {fileUploadError}
//               </Typography>
//             )}
//           </Box>

//           {isSaving && (
//             <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
//               <CircularProgress size={24} />
//             </Box>
//           )}
//         </>
//       )}
//     </>
//   );
// });

// export default GoogleWorkspaceConfigForm;

import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';

import { alpha, useTheme } from '@mui/material/styles';
import {
  Box,
  Link,
  Alert,
  Paper,
  Stack,
  Button,
  Typography,
  CircularProgress,
} from '@mui/material';

import axios from 'src/utils/axios';

import { Iconify } from 'src/components/iconify';

interface GoogleWorkspaceConfigFormProps {
  onValidationChange: (isValid: boolean) => void;
  onSaveSuccess?: () => void;
}

export interface GoogleWorkspaceConfigFormRef {
  handleSave: () => Promise<boolean>;
}

export const GoogleWorkspaceConfigForm = forwardRef<
  GoogleWorkspaceConfigFormRef,
  GoogleWorkspaceConfigFormProps
>(({ onValidationChange, onSaveSuccess }, ref) => {
  const theme = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileUploadError, setFileUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [hasExistingFile, setHasExistingFile] = useState(false);

  // Load existing configuration on component mount
  useEffect(() => {
    const fetchExistingConfig = async () => {
      try {
        const response = await axios.get('/api/v1/connectors/credentials', {
          params: {
            service: 'googleWorkspace',
          },
        });

        if (response.data && response.data.isConfigured) {
          setHasExistingFile(true);
          if (response.data.fileName) {
            setFileName(response.data.fileName);
          } else {
            setFileName('google-workspace-credentials.json');
          }
          onValidationChange(true);
        }
      } catch (error) {
        console.error('Error fetching existing configuration:', error);
        // If error, assume no config exists
        setHasExistingFile(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExistingConfig();
  }, [onValidationChange]);

  // Expose the handleSave method to the parent component
  useImperativeHandle(ref, () => ({
    handleSave,
  }));

  // Update validation state when file is selected or removed
  useEffect(() => {
    if (hasExistingFile || selectedFile) {
      onValidationChange(true);
    } else {
      onValidationChange(false);
    }
  }, [selectedFile, hasExistingFile, onValidationChange]);

  // Handle file upload click
  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      if (!hasExistingFile) {
        setSelectedFile(null);
        setFileName(null);
        setFileUploadError(null);
        onValidationChange(false);
      }
      return;
    }

    setFileName(file.name);
    setFileUploadError(null);

    // Check file type
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      setFileUploadError('Only JSON files are accepted.');
      setSelectedFile(null);
      if (!hasExistingFile) {
        onValidationChange(false);
      }
      return;
    }

    setSelectedFile(file);
    onValidationChange(true);
  };

  // Handle file download
  const handleDownload = async () => {
    if (selectedFile) {
      // If we have a file in memory, download it directly
      const url = URL.createObjectURL(selectedFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = selectedFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (hasExistingFile) {
      // If we have a file on the server, fetch and download it
      try {
        setIsLoading(true);
        const response = await axios.get('/api/v1/connectors/credentials/download', {
          params: {
            service: 'googleWorkspace',
          },
          responseType: 'blob',
        });

        const url = URL.createObjectURL(new Blob([response.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || 'google-workspace-credentials.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error downloading file:', error);
        setSaveError('Failed to download configuration file');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Handle save - upload the file directly
  const handleSave = async (): Promise<boolean> => {
    // If no new file is selected and we already have a config, just return success
    if (!selectedFile && hasExistingFile) {
      return true;
    }

    if (!selectedFile) {
      setFileUploadError('Please select a JSON file to upload.');
      return false;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // Create FormData with the specific field name that the server expects
      const formData = new FormData();

      // Make sure "file" is the field name expected by your server middleware
      formData.append('googleWorkspaceCredentials', selectedFile);

      // Add the userType to the form data
      formData.append('userType', 'business');

      // Send the file to the backend
      const response = await axios.post('/api/v1/connectors/credentials', formData, {
        params: {
          service: 'googleWorkspace',
        },
        // Let axios set the Content-Type header with correct boundary
      });

      setHasExistingFile(true);

      if (onSaveSuccess) {
        onSaveSuccess();
      }

      return true;
    } catch (error) {
      console.error('Error uploading Google Workspace config:', error);
      setSaveError('Failed to upload Google Workspace configuration file');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Handle file removal
  const handleRemoveFile = () => {
    if (hasExistingFile && !selectedFile) {
      // If removing a server-side file
      setIsLoading(true);

      axios
        .delete('/api/v1/connectors/credentials', {
          params: {
            service: 'googleWorkspace',
          },
        })
        .then(() => {
          setHasExistingFile(false);
          setFileName(null);
          onValidationChange(false);
        })
        .catch((error) => {
          console.error('Error removing configuration:', error);
          setSaveError('Failed to remove configuration');
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      // If removing a locally selected file
      setSelectedFile(null);
      if (!hasExistingFile) {
        setFileName(null);
        onValidationChange(false);
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <>
          {saveError && (
            <Alert
              severity="error"
              sx={{
                mb: 3,
                borderRadius: 1,
              }}
            >
              {saveError}
            </Alert>
          )}

          <Box
            sx={{
              mb: 3,
              p: 2,
              borderRadius: 1,
              bgcolor: alpha(theme.palette.info.main, 0.04),
              border: `1px solid ${alpha(theme.palette.info.main, 0.15)}`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1,
            }}
          >
            <Iconify
              icon="eva:info-outline"
              width={20}
              height={20}
              color={theme.palette.info.main}
              style={{ marginTop: 2 }}
            />
            <Box>
              <Typography variant="body2" color="text.secondary">
                To configure Google Workspace integration, you need to upload your OAuth 2.0
                credentials JSON file from the{' '}
                <Link
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener"
                  sx={{ fontWeight: 500 }}
                >
                  Google Cloud Console
                </Link>
                .
              </Typography>
            </Box>
          </Box>

          {/* File Upload Section */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
              {hasExistingFile ? 'Google Workspace Credentials' : 'Upload Credentials JSON'}
            </Typography>

            <Paper
              variant="outlined"
              sx={{
                p: 2,
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: 'center',
                justifyContent: 'space-between',
                borderColor: alpha(theme.palette.primary.main, 0.2),
                borderStyle: hasExistingFile ? 'solid' : 'dashed',
                borderRadius: 1,
                bgcolor: hasExistingFile
                  ? alpha(theme.palette.success.main, 0.04)
                  : alpha(theme.palette.primary.main, 0.02),
                gap: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 40,
                    height: 40,
                    borderRadius: '8px',
                    bgcolor: hasExistingFile
                      ? alpha(theme.palette.success.main, 0.08)
                      : alpha(theme.palette.primary.main, 0.08),
                  }}
                >
                  <Iconify
                    icon={
                      hasExistingFile ? 'eva:checkmark-circle-outline' : 'mdi:file-text-outline'
                    }
                    width={24}
                    height={24}
                    color={
                      hasExistingFile ? theme.palette.success.main : theme.palette.primary.main
                    }
                  />
                </Box>

                <Box>
                  <Typography variant="subtitle2">
                    {fileName || 'No file selected'}
                    {hasExistingFile && !selectedFile && ' (Saved)'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {hasExistingFile && !selectedFile
                      ? 'Google Workspace credentials are configured'
                      : 'Upload your Google Cloud OAuth credentials JSON file'}
                  </Typography>
                </Box>
              </Box>

              {hasExistingFile || selectedFile ? (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleDownload}
                    startIcon={<Iconify icon="eva:download-outline" width={18} height={18} />}
                    color="primary"
                    sx={{
                      minWidth: 120,
                      flexShrink: 0,
                    }}
                  >
                    Download
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleRemoveFile}
                    startIcon={<Iconify icon="eva:trash-outline" width={18} height={18} />}
                    color="error"
                    sx={{
                      minWidth: 120,
                      flexShrink: 0,
                    }}
                  >
                    Remove
                  </Button>
                  {hasExistingFile && !selectedFile && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleUploadClick}
                      startIcon={<Iconify icon="eva:edit-outline" width={18} height={18} />}
                      sx={{
                        minWidth: 120,
                        flexShrink: 0,
                      }}
                    >
                      Replace
                    </Button>
                  )}
                </Stack>
              ) : (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleUploadClick}
                  startIcon={<Iconify icon="eva:upload-outline" width={18} height={18} />}
                  sx={{
                    minWidth: 120,
                    flexShrink: 0,
                  }}
                >
                  Upload JSON
                </Button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </Paper>

            {fileUploadError && (
              <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                {fileUploadError}
              </Typography>
            )}
          </Box>

          {isSaving && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <CircularProgress size={24} />
            </Box>
          )}
        </>
      )}
    </>
  );
});

export default GoogleWorkspaceConfigForm;
