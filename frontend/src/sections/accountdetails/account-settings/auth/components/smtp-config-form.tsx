import { z } from 'zod';
import React, { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';

import { alpha, useTheme } from '@mui/material/styles';
import {
  Box,
  Grid,
  Alert,
  TextField,
  Typography,
  IconButton,
  InputAdornment,
  CircularProgress,
} from '@mui/material';

import axios from 'src/utils/axios';

import { Iconify } from 'src/components/iconify';

interface SmtpConfigFormProps {
  onValidationChange: (isValid: boolean) => void;
  onSaveSuccess?: () => void;
}

export interface SmtpConfigFormRef {
  handleSave: () => Promise<boolean>;
}

// Define Zod schema for form validation
const smtpConfigSchema = z.object({
  host: z.string().min(1, { message: 'SMTP host is required' }),
  port: z
    .number()
    .int()
    .min(1, { message: 'Port must be at least 1' })
    .max(65535, { message: 'Port must be at most 65535' }),
  fromEmail: z
    .string()
    .min(1, { message: 'From email is required' })
    .email({ message: 'Please enter a valid email address' }),
  username: z.string().optional(),
  password: z.string().optional(),
});

type SmtpConfigFormData = z.infer<typeof smtpConfigSchema>;

const SmtpConfigForm = forwardRef<SmtpConfigFormRef, SmtpConfigFormProps>(
  ({ onValidationChange, onSaveSuccess }, ref) => {
    const theme = useTheme();
    const [formData, setFormData] = useState<SmtpConfigFormData>({
      host: '',
      port: 587,
      username: '',
      password: '',
      fromEmail: '',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);

    // Validate form function - memoized with useCallback to ensure it can be safely used in dependency arrays
    const validateForm = useCallback((data: SmtpConfigFormData) => {
      try {
        // Parse the data with zod schema
        smtpConfigSchema.parse(data);
        setErrors({});
        onValidationChange(true);
        return true;
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          // Extract errors into a more manageable format
          const errorMap: Record<string, string> = {};
          validationError.errors.forEach((err) => {
            const path = err.path.join('.');
            errorMap[path] = err.message;
          });
          setErrors(errorMap);
          onValidationChange(false);
          return false;
        }
        return false;
      }
    }, [onValidationChange]);

    // Toggle password visibility
    const handleTogglePasswordVisibility = () => {
      setShowPassword(!showPassword);
    };

    // Handle input change
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value, type } = e.target;
      
      // Create a new form data object with the updated field
      const updatedFormData = {
        ...formData,
        [name]: type === 'number' ? Number(value) : value,
      };
      
      setFormData(updatedFormData);
    };

    // Expose the handleSave method to the parent component
    // Move handleSave inside useImperativeHandle to fix the dependency issue
    useImperativeHandle(ref, () => ({
      handleSave: async (): Promise<boolean> => {
        setIsSaving(true);
        setSaveError(null);
  
        try {
          // Validate the form data with Zod before saving
          if (!validateForm(formData)) {
            setSaveError('Please correct the form errors before saving');
            return false;
          }
  
          // Prepare the payload
          const payload = {
            host: formData.host,
            port: formData.port,
            fromEmail: formData.fromEmail,
            username: formData.username,
            password: formData.password,
          };
  
          // Send the update request
          await axios.post('/api/v1/configurationManager/smtpConfig', payload);
  
          if (onSaveSuccess) {
            onSaveSuccess();
          }
  
          return true;
        } catch (error) {
          if (error instanceof z.ZodError) {
            // Handle validation errors
            const errorMap: Record<string, string> = {};
            error.errors.forEach((err) => {
              const path = err.path.join('.');
              errorMap[path] = err.message;
            });
            setErrors(errorMap);
            setSaveError('Please correct the form errors before saving');
          } else {
            // Handle API errors
            setSaveError('Failed to save SMTP configuration');
            console.error('Error saving SMTP config:', error);
          }
          return false;
        } finally {
          setIsSaving(false);
        }
      }
    }), [formData, onSaveSuccess, validateForm]);

    // Load existing config on mount
    useEffect(() => {
      const fetchConfig = async () => {
        setIsLoading(true);
        try {
          const response = await axios.get('/api/v1/configurationManager/smtpConfig');

          if (response.data) {
            const { host, port, username, password, fromEmail } = response.data;

            const loadedData = {
              host: host || '',
              port: typeof port === 'string' ? parseInt(port, 10) : (port || 587),
              username: username || '',
              password: password || '',
              fromEmail: fromEmail || '',
            };

            setFormData(loadedData);
            
            // Set the form as valid if we have the required fields
            if (host && fromEmail) {
              validateForm(loadedData);
            }
          }
        } catch (error) {
          console.error('Failed to load SMTP config:', error);
        } finally {
          setIsLoading(false);
          setInitialLoad(false);
        }
      };

      fetchConfig();
    }, [validateForm]);

    // Use effect for validation, but only after initial load is complete
    useEffect(() => {
      if (!initialLoad) {
        validateForm(formData);
      }
    }, [formData, initialLoad, validateForm]);

    // Helper to get field error
    const getFieldError = (fieldName: string): string => errors[fieldName] || '';

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
                  SMTP configuration is required for email-based features like OTP authentication
                  and password reset. Please enter the details of your email server below.
                </Typography>
              </Box>
            </Box>

            <Grid container spacing={2.5}>
              <Grid item xs={12} md={8}>
                <TextField
                  fullWidth
                  label="SMTP Host"
                  name="host"
                  value={formData.host}
                  onChange={handleChange}
                  placeholder="e.g., smtp.gmail.com"
                  error={Boolean(getFieldError('host'))}
                  helperText={getFieldError('host') || 'The hostname of your SMTP server'}
                  required
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Iconify icon="eva:server-outline" width={18} height={18} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: alpha(theme.palette.text.primary, 0.15),
                      },
                    },
                  }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Port"
                  name="port"
                  type="number"
                  value={formData.port}
                  onChange={handleChange}
                  placeholder="587"
                  error={Boolean(getFieldError('port'))}
                  helperText={getFieldError('port') || 'Common ports: 25, 465, 587'}
                  required
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Iconify icon="eva:radio-outline" width={18} height={18} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: alpha(theme.palette.text.primary, 0.15),
                      },
                    },
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="From Email Address"
                  name="fromEmail"
                  value={formData.fromEmail}
                  onChange={handleChange}
                  placeholder="noreply@yourcompany.com"
                  error={Boolean(getFieldError('fromEmail'))}
                  helperText={
                    getFieldError('fromEmail') || 'The email address that will appear as the sender'
                  }
                  required
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Iconify icon="eva:email-outline" width={18} height={18} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: alpha(theme.palette.text.primary, 0.15),
                      },
                    },
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Username (Optional)"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Enter SMTP username"
                  error={Boolean(getFieldError('username'))}
                  helperText={
                    getFieldError('username') || 'Username for SMTP authentication (if required)'
                  }
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Iconify icon="eva:person-outline" width={18} height={18} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: alpha(theme.palette.text.primary, 0.15),
                      },
                    },
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Password (Optional)"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter SMTP password"
                  error={Boolean(getFieldError('password'))}
                  helperText={
                    getFieldError('password') || 'Password for SMTP authentication (if required)'
                  }
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Iconify icon="eva:lock-outline" width={18} height={18} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={handleTogglePasswordVisibility}
                          edge="end"
                          size="small"
                          aria-label={showPassword ? 'hide password' : 'show password'}
                        >
                          <Iconify
                            icon={showPassword ? 'eva:eye-off-outline' : 'eva:eye-outline'}
                            width={18}
                            height={18}
                          />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: alpha(theme.palette.text.primary, 0.15),
                      },
                    },
                  }}
                />
              </Grid>
            </Grid>

            {isSaving && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                <CircularProgress size={24} />
              </Box>
            )}
          </>
        )}
      </>
    );
  }
);

export default SmtpConfigForm;