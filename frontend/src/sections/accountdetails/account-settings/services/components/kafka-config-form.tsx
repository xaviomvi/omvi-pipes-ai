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

import { getKafkaConfig, updateKafkaConfig } from '../utils/services-configuration-service';

interface KafkaConfigFormProps {
  onValidationChange: (isValid: boolean) => void;
  onSaveSuccess?: () => void;
}

export interface KafkaConfigFormRef {
  handleSave: () => Promise<void>;
}

const KafkaConfigForm = forwardRef<KafkaConfigFormRef, KafkaConfigFormProps>(
  ({ onValidationChange, onSaveSuccess }, ref) => {
    const theme = useTheme();
    const [formData, setFormData] = useState({
      clientId: '',
      brokers: '',
      groupId: '',
    });

    const [errors, setErrors] = useState({
      clientId: '',
      brokers: '',
      groupId: '',
    });

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [originalData, setOriginalData] = useState({
      clientId: '',
      brokers: '',
      groupId: '',
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
          const config = await getKafkaConfig();

          const data = {
            clientId: config?.clientId || '',
            brokers: config?.brokers || '',
            groupId: config?.groupId || '',
          };

          setFormData(data);
          setOriginalData(data);
        } catch (error) {
          console.error('Failed to load Kafka config:', error);
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
        formData.brokers.trim() !== '' &&
        formData.groupId.trim() !== '' &&
        !errors.clientId &&
        !errors.brokers &&
        !errors.groupId;

      // Only notify about validation if in edit mode or if the form has changed
      const hasChanges =
        formData.clientId !== originalData.clientId ||
        formData.brokers !== originalData.brokers ||
        formData.groupId !== originalData.groupId;

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

      if (value.trim() === '') {
        error = 'This field is required';
      } else if (name === 'clientId' && value.length < 3) {
        error = 'Client ID must be at least 3 characters';
      } else if (name === 'brokers' && !value.includes(':')) {
        error = 'Brokers should include host:port format';
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
          clientId: '',
          brokers: '',
          groupId: '',
        });
      }
      setIsEditing(!isEditing);
    };

    // Handle save
    const handleSave = async () => {
      setIsSaving(true);
      setSaveError(null);

      try {
        await updateKafkaConfig({
          clientId: formData.clientId,
          brokers: formData.brokers,
          groupId: formData.groupId,
        });

        // Update original data after successful save
        setOriginalData({
          clientId: formData.clientId,
          brokers: formData.brokers,
          groupId: formData.groupId,
        });

        // Exit edit mode
        setIsEditing(false);

        if (onSaveSuccess) {
          onSaveSuccess();
        }

        return true;
      } catch (error) {
        setSaveError('Failed to save Kafka configuration');
        console.error('Error saving Kafka config:', error);
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
              Kafka connection details. For multiple brokers, use a comma-separated list in the
              format <code>host1:port1,host2:port2</code>.
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
              label="Client ID"
              name="clientId"
              value={formData.clientId}
              onChange={handleChange}
              placeholder="my-application"
              error={Boolean(errors.clientId)}
              helperText={errors.clientId || 'Unique identifier for this client application'}
              required
              size="small"
              disabled={!isEditing}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="mdi:identifier" width={18} height={18} />
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
              label="Group ID"
              name="groupId"
              value={formData.groupId}
              onChange={handleChange}
              placeholder="consumer-group-1"
              error={Boolean(errors.groupId)}
              helperText={errors.groupId || 'Consumer group identifier for this application'}
              required
              size="small"
              disabled={!isEditing}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="mdi:account-group" width={18} height={18} />
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
              label="Brokers"
              name="brokers"
              value={formData.brokers}
              onChange={handleChange}
              placeholder="kafka-host1:9092,kafka-host2:9092"
              error={Boolean(errors.brokers)}
              helperText={
                errors.brokers || 'Comma-separated list of Kafka brokers in host:port format'
              }
              required
              size="small"
              disabled={!isEditing}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="mdi:server-network" width={18} height={18} />
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

export default KafkaConfigForm;
