import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import React, { useMemo, useState, useEffect, useCallback } from 'react';

import {
  Box,
  Fade,
  Grid,
  alpha,
  Button,
  useTheme,
  TextField,
  Typography,
  FormHelperText,
  CircularProgress,
} from '@mui/material';

import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

import type { ConnectorFormValues } from './types';

// Zod schema for business account (file upload)
const businessConnectorSchema = z.object({
  googleWorkspace: z.object({
    serviceCredentials: z.string().min(1, 'Service credentials are required'),
    // Adding extracted fields from JSON that will be hidden in the UI
    clientId: z.string().optional(),
    clientEmail: z.string().optional(),
    privateKey: z.string().optional(),
    projectId: z.string().optional(),
  }),
});

// Zod schema for individual account (manual entry)
const individualConnectorSchema = z.object({
  googleWorkspace: z.object({
    clientId: z.string().min(1, 'Client ID is required'),
    clientSecret: z.string().min(1, 'Client Secret is required'),
    redirectUri: z.string().min(1, 'Redirect URI is required'),
  }),
});

// File size limit in bytes (5 MB)
const FILE_SIZE_LIMIT = 5 * 1024 * 1024;
// Allowed file types
const ALLOWED_FILE_TYPES = ['application/json'];
// Allowed file extensions
const ALLOWED_FILE_EXTENSIONS = ['.json'];

interface ConnectorConfigStepProps {
  onSubmit: (data: ConnectorFormValues, file: File | null) => void;
  onSkip: () => void;
  initialValues: ConnectorFormValues | null;
  initialFile: File | null;
  setMessage : (message : string)=> void;
}

const ConnectorConfigStep: React.FC<ConnectorConfigStepProps> = ({
  onSubmit,
  onSkip,
  initialValues,
  initialFile,
  setMessage
}) => {
  const theme = useTheme();
  const { user } = useAuthContext();
  const accountType = user?.accountType || 'individual'; // Default to individual if not available

  const [serviceCredentialsFile, setServiceCredentialsFile] = useState<File | null>(null);
  const [parsedJsonData, setParsedJsonData] = useState<any>(null);
  const [credentialsError, setCredentialsError] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Form for business accounts (file upload with extracted fields)
  const businessForm = useForm<any>({
    resolver: zodResolver(businessConnectorSchema),
    mode: 'onChange',
    defaultValues: {
      googleWorkspace: {
        serviceCredentials: '',
        clientId: '',
        clientEmail: '',
        privateKey: '',
        projectId: '',
      },
    },
  });

  // Form for individual accounts (always visible)
  const individualForm = useForm<any>({
    resolver: zodResolver(individualConnectorSchema),
    mode: 'onChange',
    defaultValues: {
      googleWorkspace: {
        clientId: '',
        clientSecret: '',
        redirectUri: 'http://localhost:3001/account/individual/settings/connector',
      },
    },
  });

  // Determine which form to use based on account type
  const { handleSubmit, formState, control } =
    accountType === 'business' ? businessForm : individualForm;

  const {isValid} = formState;

  // Initialize form with initial values and file if available
  useEffect(() => {
    if (initialValues) {
      if (accountType === 'business') {
        businessForm.reset(initialValues);
      } else {
        individualForm.reset(initialValues);
      }
    }
    if (initialFile) {
      setServiceCredentialsFile(initialFile);
    }
  }, [initialValues, initialFile, accountType, businessForm, individualForm]);

  // Extract data from uploaded JSON for individual users
// Extract data from uploaded JSON for individual users
const extractIndividualDataFromJson = useCallback(
  (jsonData: any) => {
    try {
      // Debug the incoming JSON data structure
      console.log('Parsing individual JSON data:', jsonData);
      
      // Try different JSON structures that Google might provide
      // Web application credentials format
      if (jsonData.web) {
        const clientId = jsonData.web.client_id;
        const clientSecret = jsonData.web.client_secret;
        const redirectUri = jsonData.web.redirect_uris && jsonData.web.redirect_uris[0];
        
        if (clientId && clientSecret) {
          individualForm.setValue('googleWorkspace.clientId', clientId, { shouldValidate: true });
          individualForm.setValue('googleWorkspace.clientSecret', clientSecret, { shouldValidate: true });
          
          if (redirectUri) {
            individualForm.setValue('googleWorkspace.redirectUri', redirectUri, { shouldValidate: true });
          }
          return true;
        }
      }
      
      // Try installed application format
      if (jsonData.installed) {
        const clientId = jsonData.installed.client_id;
        const clientSecret = jsonData.installed.client_secret;
        const redirectUri = jsonData.installed.redirect_uris && jsonData.installed.redirect_uris[0];
        
        if (clientId && clientSecret) {
          individualForm.setValue('googleWorkspace.clientId', clientId, { shouldValidate: true });
          individualForm.setValue('googleWorkspace.clientSecret', clientSecret, { shouldValidate: true });
          
          if (redirectUri) {
            individualForm.setValue('googleWorkspace.redirectUri', redirectUri, { shouldValidate: true });
          }
          return true;
        }
      }
      
      // Try direct properties (less common but possible)
      const clientId = jsonData.clientId || jsonData.client_id;
      const clientSecret = jsonData.clientSecret || jsonData.client_secret;
      const redirectUri = jsonData.redirectUri || jsonData.redirect_uri || 
                         (jsonData.redirect_uris && jsonData.redirect_uris[0]);

      if (clientId && clientSecret) {
        individualForm.setValue('googleWorkspace.clientId', clientId, { shouldValidate: true });
        individualForm.setValue('googleWorkspace.clientSecret', clientSecret, { shouldValidate: true });

        if (redirectUri) {
          individualForm.setValue('googleWorkspace.redirectUri', redirectUri, { shouldValidate: true });
        }
        return true;
      }
      
      setMessage('Could not find client ID and client secret in the JSON file');
      return false;
    } catch (error) {
      console.error('Error parsing JSON file:', error);
      setMessage('Failed to extract data from JSON file');
      return false;
    }
  },
  [individualForm, setMessage]
);

  // Extract data from uploaded JSON for business users
  const extractBusinessDataFromJson = useCallback( 
    (jsonData: any) => {
      try {
        // Store the full parsed JSON for later use
        setParsedJsonData(jsonData);

        // Extract required fields
        businessForm.setValue('googleWorkspace.clientId', jsonData.client_id || '', {
          shouldValidate: true,
        });
        businessForm.setValue('googleWorkspace.clientEmail', jsonData.client_email || '', {
          shouldValidate: true,
        });
        businessForm.setValue('googleWorkspace.privateKey', jsonData.private_key || '', {
          shouldValidate: true,
        });
        businessForm.setValue('googleWorkspace.projectId', jsonData.project_id || '', {
          shouldValidate: true,
        });

        return true;
      } catch (error) {
        setMessage('Failed to extract JSON data');
        return false;
      }
    },
    // eslint-disable-next-line
    [businessForm]
  );

  // Expose submit method to parent component
  useEffect(() => {
    (window as any).submitConnectorForm = () => {
      if (accountType === 'business') {
        // Business accounts require file upload
        if (isValid && serviceCredentialsFile && parsedJsonData) {
          handleSubmit((data) => {
            onSubmit(data, serviceCredentialsFile);
          })();
          return true;
        }
        return false;
      }

      // Individual accounts can now submit even without a file
      if (isValid) {
        handleSubmit((data) => {
          onSubmit(data, serviceCredentialsFile);
        })();
        return true;
      }
      return false;
    };

    return () => {
      delete (window as any).submitConnectorForm;
    };
  }, [accountType, isValid, serviceCredentialsFile, handleSubmit, onSubmit, parsedJsonData]);

  // Validate file type using both extension and MIME type
  const validateFileType = useCallback((file: File): boolean => {
    // Check file extension
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    const isValidExtension = ALLOWED_FILE_EXTENSIONS.includes(fileExtension);

    // Check MIME type (more reliable than extension)
    const isValidMimeType = ALLOWED_FILE_TYPES.includes(file.type);

    // For JSON files, we need to be more forgiving with MIME types as they can vary
    // Some systems might report "text/plain" or other MIME types for JSON
    const isJsonFile = fileExtension === '.json';

    return isValidExtension && (isValidMimeType || isJsonFile);
  }, []);



  // Process the selected file
  const processFile = useCallback(
    (file: File): void => {
      setIsProcessing(true);
      setCredentialsError('');

      // Check file size
      if (file.size > FILE_SIZE_LIMIT) {
        setCredentialsError(
          `File is too large. Maximum size is ${FILE_SIZE_LIMIT / (1024 * 1024)} MB.`
        );
        setIsProcessing(false);
        return;
      }

      // Check file type
      if (!validateFileType(file)) {
        setCredentialsError('Only JSON files are supported. Please select a valid JSON file.');
        setIsProcessing(false);
        return;
      }

      setServiceCredentialsFile(file);
      const reader = new FileReader();

      reader.onload = (e: ProgressEvent<FileReader>) => {
        if (e.target && typeof e.target.result === 'string') {
          try {
            // Validate JSON structure
            const jsonData = JSON.parse(e.target.result);

            if (accountType === 'business') {
              // Business account validation
              if (!jsonData.client_id || !jsonData.client_email || !jsonData.private_key) {
                throw new Error('Missing required fields in service account credentials file');
              }

              // Store the raw JSON content
              businessForm.setValue('googleWorkspace.serviceCredentials', e.target.result, {
                shouldValidate: true,
              });

              // Extract fields for business
              extractBusinessDataFromJson(jsonData);
            } else if (!extractIndividualDataFromJson(jsonData)) {
              // Individual account handling - using else if
              throw new Error('Missing required fields in the JSON file (clientId, clientSecret)');
            }

            setIsProcessing(false);
          } catch (error: any) {
            setCredentialsError(
              `Invalid JSON format: ${error.message || 'The file does not contain valid JSON data.'}`
            );
            setServiceCredentialsFile(null);
            setParsedJsonData(null);
            setIsProcessing(false);
          }
        }
      };

      reader.onerror = () => {
        setCredentialsError('Error reading file. Please try again.');
        setServiceCredentialsFile(null);
        setParsedJsonData(null);
        setIsProcessing(false);
      };

      reader.readAsText(file);
    },
    [
      validateFileType,
      accountType,
      extractIndividualDataFromJson,
      businessForm,
      extractBusinessDataFromJson,
    ]
  );

    // Handle file selection from input
    const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
      setCredentialsError('');
      const {files} = event.target;
  
      // Reset the file input to ensure onChange fires even if the same file is selected again
      event.target.value = '';
  
      if (files && files[0]) {
        processFile(files[0]);
      }
    }, [processFile]); 

  const handleFormSubmit = useCallback(
    (data: any) => {
      if (accountType === 'business') {
        if (serviceCredentialsFile && parsedJsonData) {
          onSubmit(data, serviceCredentialsFile);
        }
      } else {
        // Individual account - can submit with or without file
        onSubmit(data, serviceCredentialsFile);
      }
    },
    [accountType, onSubmit, serviceCredentialsFile, parsedJsonData]
  );

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const {files} = e.dataTransfer;
      if (files.length > 1) {
        setCredentialsError('Please drop only one file.');
        return;
      }

      if (files && files[0]) {
        processFile(files[0]);
      }
    },
    [processFile]
  );

  // Remove file handler
  const handleRemoveFile = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setServiceCredentialsFile(null);
      setParsedJsonData(null);

      if (accountType === 'business') {
        businessForm.setValue('googleWorkspace.serviceCredentials', '', { shouldValidate: true });
        businessForm.setValue('googleWorkspace.clientId', '');
        businessForm.setValue('googleWorkspace.clientEmail', '');
        businessForm.setValue('googleWorkspace.privateKey', '');
        businessForm.setValue('googleWorkspace.projectId', '');
      }
      // For individual accounts, we keep the form values to allow manual editing
    },
    [accountType, businessForm]
  );

  // Memoized upload area styles - reduced height to avoid scrolling
  const uploadAreaStyles = useMemo(
    () => ({
      border: `1px dashed ${
        isDragging
          ? theme.palette.primary.main
          : serviceCredentialsFile
            ? theme.palette.success.main
            : theme.palette.divider
      }`,
      borderRadius: 1,
      height: accountType === 'business' ? 160 : 100, // Reduced height
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
      bgcolor: isDragging
        ? alpha(theme.palette.primary.main, 0.05)
        : serviceCredentialsFile
          ? alpha(theme.palette.success.main, 0.05)
          : theme.palette.background.paper,
      cursor: isProcessing ? 'wait' : 'pointer',
      transition: theme.transitions.create(['border-color', 'background-color'], {
        duration: theme.transitions.duration.shorter,
      }),
      '&:hover': {
        borderColor: !isProcessing ? theme.palette.primary.main : undefined,
        bgcolor: !isProcessing ? alpha(theme.palette.primary.main, 0.05) : undefined,
      },
      position: 'relative',
      overflow: 'hidden',
      px: 2,
    }),
    [theme, isDragging, serviceCredentialsFile, isProcessing, accountType]
  );

  // Direct form submission handler
  const onFormSubmit = (data: ConnectorFormValues) => {
    handleFormSubmit(data);
  };

  return (
    <Box
      component="form"
      id="connector-config-form"
      onSubmit={handleSubmit(onFormSubmit)}
      noValidate
      sx={{
        height: '100%',
        maxHeight: '400px', // Constrain max height to fit in dialog
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ mb: 1 }}>
        <Typography variant="subtitle1" gutterBottom sx={{ mb: 0.5 }}>
          Google Workspace
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
          {accountType === 'business'
            ? 'Upload your Google Workspace service account credentials file.'
            : 'Configure your Google Workspace OAuth credentials.'}
        </Typography>
      </Box>

      {/* Individual account form fields - more compact spacing */}
      {accountType === 'individual' && (
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid item xs={12}>
            <Controller
              name="googleWorkspace.clientId"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Client ID"
                  placeholder="e.g., 969340771549-75fn6kuu6p4oapk45ibrc5acpps.com"
                  fullWidth
                  size="small"
                  margin="dense"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Grid>

          <Grid item xs={12}>
            <Controller
              name="googleWorkspace.clientSecret"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Client Secret"
                  placeholder="e.g., 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"
                  fullWidth
                  size="small"
                  margin="dense"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Grid>

          <Grid item xs={12}>
            <Controller
              name="googleWorkspace.redirectUri"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Redirect URI"
                  fullWidth
                  size="small"
                  margin="dense"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Grid>
        </Grid>
      )}

      {/* File Upload UI - Business accounts get file only, individual accounts get it as an option */}
      <Box sx={{ mt: 0, mb: 1, flexGrow: 1 }}>
        {accountType === 'individual' && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: '0.8rem' }}>
            Alternatively, upload a credentials file to populate the form:
          </Typography>
        )}

        <Box
          sx={uploadAreaStyles}
          component="div"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          onClick={() => !isProcessing && document.getElementById('file-upload-input')?.click()}
          onKeyDown={(e) => {
            if (!isProcessing && (e.key === 'Enter' || e.key === ' ')) {
              document.getElementById('file-upload-input')?.click();
            }
          }}
          aria-disabled={isProcessing}
        >
          {isProcessing ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <CircularProgress size={24} sx={{ mb: 1 }} />
              <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8rem' }}>
                Processing file...
              </Typography>
            </Box>
          ) : !serviceCredentialsFile ? (
            <>
              <Iconify
                icon={isDragging ? 'mdi:file-download-outline' : 'mdi:cloud-upload'}
                width={24}
                height={24}
                sx={{
                  color: isDragging ? theme.palette.primary.main : theme.palette.text.secondary,
                  mb: 1,
                  transition: theme.transitions.create('color', {
                    duration: theme.transitions.duration.shorter,
                  }),
                }}
              />
              <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.9rem' }}>
                {isDragging
                  ? 'Drop file here'
                  : accountType === 'business'
                    ? 'Drop service_credentials.json'
                    : 'Drop OAuth credentials.json'}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 0.5, fontSize: '0.75rem' }}
              >
                or click to browse files
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 0.5, fontSize: '0.7rem' }}
              >
                Only .json files supported (max 5MB)
              </Typography>
            </>
          ) : (
            <Fade in={!!serviceCredentialsFile}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: '100%',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    bgcolor: alpha(theme.palette.success.main, 0.1),
                    mb: 1,
                  }}
                >
                  <Iconify
                    icon="mdi:check-circle"
                    width={20}
                    height={20}
                    sx={{ color: theme.palette.success.main }}
                  />
                </Box>
                <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.9rem' }}>
                  {serviceCredentialsFile.name}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mb: 1, fontSize: '0.75rem' }}
                >
                  {(serviceCredentialsFile.size / 1024).toFixed(1)} KB
                </Typography>
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  sx={{
                    minWidth: 80,
                    borderRadius: 5,
                    px: 1.5,
                    py: 0.25,
                    fontSize: '0.75rem',
                  }}
                  onClick={handleRemoveFile}
                >
                  Remove
                </Button>
              </Box>
            </Fade>
          )}
        </Box>
      </Box>

      {credentialsError && (
        <FormHelperText error sx={{ mt: 0.5, mx: 0, textAlign: 'center', fontSize: '0.7rem' }}>
          <Iconify
            icon="mdi:alert-circle"
            width={12}
            height={12}
            sx={{ verticalAlign: 'text-bottom', mr: 0.5 }}
          />
          {credentialsError}
        </FormHelperText>
      )}

      {/* Hidden file input */}
      <input
        id="file-upload-input"
        type="file"
        accept=".json,application/json"
        hidden
        onChange={handleFileChange}
        disabled={isProcessing}
      />

      {/* Hidden submit button for programmatic submission */}
      <Button type="submit" style={{ display: 'none' }} id="connector-form-submit-button">
        Submit
      </Button>
    </Box>
  );
};

export default ConnectorConfigStep;
