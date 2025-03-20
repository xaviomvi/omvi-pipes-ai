import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';

import { alpha, useTheme } from '@mui/material/styles';
import { 
  Box, 
  Grid, 
  Alert,
  Snackbar, 
  TextField, 
  Typography,
  InputAdornment,
  CircularProgress
} from '@mui/material';

import { Iconify } from 'src/components/iconify';

import { getGoogleAuthConfig, updateGoogleAuthConfig } from '../utils/auth-configuration-service';

interface GoogleAuthFormProps {
  onValidationChange: (isValid: boolean) => void;
  onSaveSuccess?: () => void;
}

export interface GoogleAuthFormRef {
  handleSave: () => Promise<boolean>;
}

const GoogleAuthForm = forwardRef<GoogleAuthFormRef, GoogleAuthFormProps>(
  ({ onValidationChange, onSaveSuccess }, ref) => {
    const theme = useTheme();
    const [formData, setFormData] = useState({
      clientId: '',
      redirectUri: `${window.location.origin}/auth/google/callback`
    });
    
    const [errors, setErrors] = useState({
      clientId: '',
    });
    
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [snackbar, setSnackbar] = useState({
      open: false,
      message: '',
      severity: 'success' as 'success' | 'error',
    });

    // Helper functions for snackbar
    const showSuccessSnackbar = (message: string) => {
      setSnackbar({
        open: true,
        message,
        severity: 'success',
      });
    };

    const showErrorSnackbar = (message: string) => {
      setSnackbar({
        open: true,
        message,
        severity: 'error',
      });
    };

    const handleCloseSnackbar = () => {
      setSnackbar((prev) => ({ ...prev, open: false }));
    };

    // Expose the handleSave method to the parent component
    useImperativeHandle(ref, () => ({
      handleSave
    }));

    // Load existing config on mount
    useEffect(() => {
      const fetchConfig = async () => {
        setIsLoading(true);
        try {
          const config = await getGoogleAuthConfig();
          
          setFormData(prev => ({
            ...prev,
            clientId: config?.clientId || ''
          }));
        } catch (error) {
          showErrorSnackbar('Failed to load Google authentication configuration');
        } finally {
          setIsLoading(false);
        }
      };

      fetchConfig();
    }, []);

    // Validate form and notify parent
    useEffect(() => {
      const isValid = 
        formData.clientId.trim() !== '' &&
        !errors.clientId;
        
      onValidationChange(isValid);
    }, [formData, errors, onValidationChange]);
    
    // Handle input change
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      
      setFormData({
        ...formData,
        [name]: value,
      });
      
      // Validate
      validateField(name, value);
    };
    
    // Field validation
    const validateField = (name: string, value: string) => {
      let error = '';
      
      if (value.trim() === '') {
        error = 'This field is required';
      } else if (name === 'clientId' && value.length < 8) {
        error = 'Client ID appears to be too short';
      }
      
      setErrors({
        ...errors,
        [name]: error,
      });
    };

    // Handle save
    const handleSave = async (): Promise<boolean> => {
      setIsSaving(true);
      
      try {
        // Use the utility function to update Google configuration
        await updateGoogleAuthConfig({
          clientId: formData.clientId
        });
        
        showSuccessSnackbar('Google authentication configuration saved successfully');
        
        if (onSaveSuccess) {
          onSaveSuccess();
        }
        
        return true;
      } catch (error) {
        showErrorSnackbar('Failed to save Google authentication configuration');
        return false;
      } finally {
        setIsSaving(false);
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
              <Iconify icon="eva:info-outline" width={20} height={20} color={theme.palette.info.main} style={{ marginTop: 2 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Redirect URI (add to your Google OAuth settings):
                  <Box component="code" sx={{ 
                    display: 'block', 
                    p: 1.5, 
                    mt: 1, 
                    bgcolor: alpha(theme.palette.background.default, 0.7),
                    borderRadius: 1,
                    fontSize: '0.8rem',
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                    border: `1px solid ${theme.palette.divider}`
                  }}>
                    {formData.redirectUri}
                  </Box>
                </Typography>
              </Box>
            </Box>
            
            <Grid container spacing={2.5}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Client ID"
                  name="clientId"
                  value={formData.clientId}
                  onChange={handleChange}
                  placeholder="Enter your Google OAuth Client ID"
                  error={Boolean(errors.clientId)}
                  helperText={errors.clientId || "The client ID from your Google OAuth credentials"}
                  required
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Iconify icon="eva:hash-outline" width={18} height={18} />
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

        {/* Snackbar for success and error messages */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Alert
            onClose={handleCloseSnackbar}
            severity={snackbar.severity}
            variant="filled"
            sx={{
              width: '100%',
              boxShadow: '0px 3px 8px rgba(0, 0, 0, 0.12)',
              ...(snackbar.severity === 'error' && {
                bgcolor: theme.palette.error.main,
                color: theme.palette.error.contrastText,
              }),
              ...(snackbar.severity === 'success' && {
                bgcolor: theme.palette.success.main,
                color: theme.palette.success.contrastText,
              }),
            }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </>
    );
  }
);

export default GoogleAuthForm;