import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';

import { alpha, useTheme } from '@mui/material/styles';
import {
  Box,
  Grid,
  Alert,
  Button,
  TextField,
  Typography,
  InputAdornment,
  CircularProgress,
} from '@mui/material';

import { Iconify } from 'src/components/iconify';

import { getArangoDBConfig, updateArangoDBConfig } from '../utils/services-configuration-service';

interface ArangoDBConfigFormProps {
  onValidationChange: (isValid: boolean) => void;
  onSaveSuccess?: () => void;
}

export interface ArangoDBConfigFormRef {
  handleSave: () => Promise<void>;
}

const ArangoDBConfigForm = forwardRef<ArangoDBConfigFormRef, ArangoDBConfigFormProps>(
  ({ onValidationChange, onSaveSuccess }, ref) => {
    const theme = useTheme();
    const [formData, setFormData] = useState({
      uri: '',
      db: '',
      username: '',
      password: '',
    });

    const [errors, setErrors] = useState({
      uri: '',
      db: '',
      username: '',
      password: '',
    });

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [originalData, setOriginalData] = useState({
      uri: '',
      db: '',
      username: '',
      password: '',
    });

    // Expose the handleSave method to the parent component
    useImperativeHandle(ref, () => ({
      handleSave: async () => {
        await handleSave();
      },
    }));

    // Load existing config on mount
    useEffect(() => {
      const fetchConfig = async () => {
        setIsLoading(true);
        try {
          const config = await getArangoDBConfig();

          const data = {
            uri: config?.uri || '',
            db: config?.db || '',
            username: config?.username || '',
            password: config?.password || '',
          };

          setFormData(data);
          setOriginalData(data);
        } catch (error) {
          console.error('Failed to load ArangoDB config:', error);
        } finally {
          setIsLoading(false);
        }
      };

      fetchConfig();
    }, []);

    // Validate form and notify parent
    useEffect(() => {
      const isValid =
        formData.uri.trim() !== '' &&
        formData.db.trim() !== '' &&
        formData.username.trim() !== '' &&
        !errors.uri &&
        !errors.db &&
        !errors.username;

      // Only notify about validation if in edit mode and has changes
      const hasChanges =
        formData.uri !== originalData.uri ||
        formData.db !== originalData.db ||
        formData.username !== originalData.username ||
        formData.password !== originalData.password;

      onValidationChange(isValid && isEditing && hasChanges);
    }, [formData, errors, onValidationChange, isEditing, originalData]);

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

      if (name === 'uri' && value.trim() === '') {
        error = 'URI is required';
      } else if (name === 'db' && value.trim() === '') {
        error = 'Database name is required';
      } else if (name === 'username' && value.trim() === '') {
        error = 'Username is required';
      }

      setErrors({
        ...errors,
        [name]: error,
      });
    };

    // Handle edit mode toggle
    const handleToggleEdit = () => {
      if (isEditing) {
        // Cancel edit - revert to original data
        setFormData(originalData);
        setErrors({
          uri: '',
          db: '',
          username: '',
          password: '',
        });
      }
      setIsEditing(!isEditing);
    };

    // Handle save
    const handleSave = async () => {
      setIsSaving(true);
      setSaveError(null);

      try {
        await updateArangoDBConfig({
          uri: formData.uri,
          db: formData.db,
          username: formData.username,
          password: formData.password,
        });

        // Update original data after successful save
        setOriginalData({
          uri: formData.uri,
          db: formData.db,
          username: formData.username,
          password: formData.password,
        });

        // Exit edit mode
        setIsEditing(false);

        if (onSaveSuccess) {
          onSaveSuccess();
        }

        return true;
      } catch (error) {
        setSaveError('Failed to save ArangoDB configuration');
        console.error('Error saving ArangoDB config:', error);
        return false;
      } finally {
        setIsSaving(false);
      }
    };

    if (isLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress size={24} />
        </Box>
      );
    }

    return (
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
            icon="mdi:information-outline"
            width={20}
            height={20}
            color={theme.palette.info.main}
            style={{ marginTop: 2 }}
          />
          <Box>
            <Typography variant="body2" color="text.secondary">
              ArangoDB connection information.
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            onClick={handleToggleEdit}
            startIcon={<Iconify icon={isEditing ? 'mdi:close' : 'mdi:pencil'} />}
            color={isEditing ? 'error' : 'primary'}
            size="small"
          >
            {isEditing ? 'Cancel' : 'Edit'}
          </Button>
        </Box>

        <Grid container spacing={2.5}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="ArangoDB URL"
              name="uri"
              value={formData.uri}
              onChange={handleChange}
              placeholder="http://localhost:8529"
              error={Boolean(errors.uri)}
              helperText={errors.uri || 'ArangoDB server URL'}
              required
              size="small"
              disabled={!isEditing}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="mdi:link" width={18} height={18} />
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
              label="Database Name"
              name="db"
              value={formData.db}
              onChange={handleChange}
              placeholder="database-name"
              error={Boolean(errors.db)}
              helperText={errors.db || 'ArangoDB database name'}
              required
              size="small"
              disabled={!isEditing}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="mdi:database" width={18} height={18} />
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
              label="Username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="username"
              error={Boolean(errors.username)}
              helperText={errors.username || 'ArangoDB username'}
              required
              size="small"
              disabled={!isEditing}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="mdi:account" width={18} height={18} />
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
              label="Password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              error={Boolean(errors.password)}
              helperText={errors.password || 'ArangoDB password'}
              required
              size="small"
              disabled={!isEditing}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="mdi:lock" width={18} height={18} />
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
    );
  }
);

export default ArangoDBConfigForm;
