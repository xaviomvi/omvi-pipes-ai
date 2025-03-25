import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';

import { alpha, useTheme } from '@mui/material/styles';
import {
  Box,
  Grid,
  Button,
  TextField,
  Typography,
  InputAdornment,
  CircularProgress,
} from '@mui/material';

import { Iconify } from 'src/components/iconify';

import { getMongoDBConfig, updateMongoDBConfig } from '../utils/services-configuration-service';

interface MongoDBConfigFormProps {
  onValidationChange: (isValid: boolean) => void;
  onSaveSuccess?: () => void;
}
interface SaveResult {
  success: boolean;
  warning?: string;
  error?: string;
}

export interface MongoDBConfigFormRef {
  handleSave: () => Promise<SaveResult>;
}

const MongoDBConfigForm = forwardRef<MongoDBConfigFormRef, MongoDBConfigFormProps>(
  ({ onValidationChange, onSaveSuccess }, ref) => {
    const theme = useTheme();
    const [formData, setFormData] = useState({
      uri: '',
      database: '',
    });

    const [errors, setErrors] = useState({
      uri: '',
      database: '',
    });

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [originalData, setOriginalData] = useState({
      uri: '',
      database: '',
    });

    // Expose the handleSave method to the parent component
    useImperativeHandle(ref, () => ({
      handleSave: async (): Promise<SaveResult> => handleSave(),
    }));

    // Load existing config on mount
    useEffect(() => {
      const fetchConfig = async () => {
        setIsLoading(true);
        try {
          const config = await getMongoDBConfig();

          // Parse database from URI if it exists in the current config
          const uri = config?.uri || '';
          const database = config?.db || '';

          // Set both current and original data
          const data = {
            uri,
            database,
          };

          setFormData(data);
          setOriginalData(data);
        } catch (error) {
          console.error('Failed to load MongoDB config:', error);
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
        formData.database.trim() !== '' &&
        !errors.uri &&
        !errors.database;

      // Only notify about validation if in edit mode or if the form has changed
      const hasChanges =
        formData.uri !== originalData.uri || formData.database !== originalData.database;

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

      if (name === 'uri') {
        if (value.trim() === '') {
          error = 'MongoDB URI is required';
        } else if (!value.startsWith('mongodb://') && !value.startsWith('mongodb+srv://')) {
          error = 'URI must start with mongodb:// or mongodb+srv://';
        }
      } else if (name === 'database') {
        if (value.trim() === '') {
          error = 'Database name is required';
        } else if (/[/\\. "$*<>:|?]/.test(value)) {
          error = 'Database name contains invalid characters';
        }
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
          database: '',
        });
      }
      setIsEditing(!isEditing);
    };

    // Handle save
    const handleSave = async () => {
      setIsSaving(true);
      setSaveError(null);

      try {
        const response = await updateMongoDBConfig({
          uri: formData.uri,
          db: formData.database,
        });
        const warningHeader = response.data?.warningMessage;

        // Update original data after successful save
        setOriginalData({
          uri: formData.uri,
          database: formData.database,
        });

        // Exit edit mode
        setIsEditing(false);

        if (onSaveSuccess) {
          onSaveSuccess();
        }

        return {
          success: true,
          warning: warningHeader || undefined,
        };
      } catch (error) {
        const errorMessage = 'Failed to save MongoDB configuration';
        setSaveError(error.message || errorMessage);
        console.error('Error saving MongoDB config:', error);
        // Return error result
        return {
          success: false,
          error: error.message || errorMessage,
        };
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
              Enter your MongoDB connection details. For replica sets, use the format{' '}
              <code>mongodb://host1:port1,host2:port2</code>. For MongoDB Atlas, use the format{' '}
              <code>mongodb+srv://username:password@cluster.example.mongodb.net</code>. The database
              name will be automatically appended to the connection string.
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
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="MongoDB URI"
              name="uri"
              value={formData.uri}
              onChange={handleChange}
              placeholder="mongodb://username:password@host:port"
              error={Boolean(errors.uri)}
              helperText={errors.uri || 'The MongoDB connection string without the database name'}
              required
              size="small"
              disabled={!isEditing}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="mdi:database-outline" width={18} height={18} />
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
              label="Database Name"
              name="database"
              value={formData.database}
              onChange={handleChange}
              placeholder="mydatabase"
              error={Boolean(errors.database)}
              helperText={errors.database || 'The name of the MongoDB database to connect to'}
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

export default MongoDBConfigForm;
