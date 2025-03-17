import { z } from 'zod';
import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  Box,
  Grid,
  Alert,
  Select,
  MenuItem,
  TextField,
  Typography,
  IconButton,
  InputLabel,
  FormControl,
  InputAdornment,
  FormHelperText,
} from '@mui/material';

import { Iconify } from 'src/components/iconify';

// Storage types enum
const storageTypes = {
  LOCAL: 'local',
  S3: 's3',
  AZURE_BLOB: 'azureBlob',
} as const;

// Type for storage type values
type StorageType = typeof storageTypes[keyof typeof storageTypes];

// Base schema for all storage types
const baseStorageSchema = z.object({
  storageType: z.enum([storageTypes.LOCAL, storageTypes.S3, storageTypes.AZURE_BLOB]),
});

// S3 specific schema
const s3ConfigSchema = baseStorageSchema.extend({
  storageType: z.literal(storageTypes.S3),
  s3AccessKeyId: z.string().min(1, { message: 'S3 access key ID is required' }),
  s3SecretAccessKey: z.string().min(1, { message: 'S3 secret access key is required' }),
  s3Region: z.string().min(1, { message: 'S3 region is required' }),
  s3BucketName: z.string().min(1, { message: 'S3 bucket name is required' }),
});

// Azure Blob specific schema
const azureBlobConfigSchema = baseStorageSchema.extend({
  storageType: z.literal(storageTypes.AZURE_BLOB),
  endpointProtocol: z.enum(['http', 'https']).optional().default('https'),
  accountName: z.string().min(1, { message: 'Azure account name is required' }),
  accountKey: z.string().min(1, { message: 'Azure account key is required' }),
  endpointSuffix: z.string().min(1, { message: 'Azure endpoint suffix is required' }).optional().default('core.windows.net'),
  containerName: z.string().min(1, { message: 'Azure container name is required' }),
});

// Local storage specific schema
const localConfigSchema = baseStorageSchema.extend({
  storageType: z.literal(storageTypes.LOCAL),
  mountName: z.string().optional(),
  baseUrl: z.string().url().optional(),
});

// Combined schema using discriminated union based on storageType
const storageSchema = z.discriminatedUnion('storageType', [
  s3ConfigSchema,
  azureBlobConfigSchema,
  localConfigSchema,
]);

// Type for form values derived from the zod schema
export type StorageFormValues = z.infer<typeof storageSchema>;

// Helper types for each storage configuration
type S3Config = z.infer<typeof s3ConfigSchema>;
type AzureBlobConfig = z.infer<typeof azureBlobConfigSchema>;
type LocalConfig = z.infer<typeof localConfigSchema>;

interface StorageConfigStepProps {
  onSubmit: (data: StorageFormValues) => void;
  onSkip: () => void;
  isSubmitting?: boolean;
  initialValues: StorageFormValues | null;
}

const StorageConfigStep: React.FC<StorageConfigStepProps> = ({
  onSubmit,
  onSkip,
  isSubmitting = false,
  initialValues,
}) => {
  const [showPassword, setShowPassword] = useState<boolean>(false);
  
  // Get the default values based on the storage type
  const getDefaultValues = (): StorageFormValues => {
    if (!initialValues) {
      // If no initial values provided, return default local config
      return {
        storageType: storageTypes.LOCAL,
        mountName: '',
        baseUrl: '',
      } as LocalConfig;
    }
    
    // If initialValues are provided, use them directly since they should already be typed correctly
    return initialValues;
  };

  const {
    control,
    handleSubmit,
    reset,
    watch,
    getValues,
    formState: { errors, isValid },
  } = useForm<StorageFormValues>({
    resolver: zodResolver(storageSchema),
    mode: 'onChange',
    defaultValues: getDefaultValues(),
  });

  // Watch the storageType to conditionally render fields
  const storageType = watch('storageType');

  // Reset form with proper default values when storage type changes
  useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (name === 'storageType' && value.storageType) {
        const type = value.storageType;
        
        // Create a new form state based on the selected storage type
        let newValues: StorageFormValues;
        
        switch (type) {
          case storageTypes.S3:
            newValues = {
              storageType: storageTypes.S3,
              s3AccessKeyId: '',
              s3SecretAccessKey: '',
              s3Region: '',
              s3BucketName: '',
            } as S3Config;
            break;
            
          case storageTypes.AZURE_BLOB:
            newValues = {
              storageType: storageTypes.AZURE_BLOB,
              endpointProtocol: 'https',
              accountName: '',
              accountKey: '',
              endpointSuffix: 'core.windows.net',
              containerName: '',
            } as AzureBlobConfig;
            break;
            
          default:
            newValues = {
              storageType: storageTypes.LOCAL,
              mountName: '',
              baseUrl: '',
            } as LocalConfig;
            break;
        }
        
        reset(newValues);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [watch, reset]);

  // Initialize form with initial values if available
  useEffect(() => {
    if (initialValues) {
      reset(initialValues);
    }
  }, [initialValues, reset]);

  // Expose submit method to parent component
  useEffect(() => {
    (window as any).submitStorageForm = () => {
      if (isValid) {
        handleSubmit(onSubmit)();
        return true;
      }
      return false;
    };

    // Also expose a method to get the current values
    (window as any).getStorageFormValues = () => getValues();

    return () => {
      delete (window as any).submitStorageForm;
      delete (window as any).getStorageFormValues;
    };
  }, [isValid, handleSubmit, onSubmit, getValues]);

  return (
    <Box component="form" id="storage-config-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Typography variant="subtitle1" gutterBottom>
        Storage Configuration
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure storage settings for your application data.
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Controller
            name="storageType"
            control={control}
            render={({ field, fieldState }) => (
              <FormControl fullWidth size="small" error={!!fieldState.error}>
                <InputLabel>Storage Type</InputLabel>
                <Select
                  {...field}
                  label="Storage Type"
                >
                  <MenuItem value={storageTypes.LOCAL}>Local Storage</MenuItem>
                  <MenuItem value={storageTypes.S3}>Amazon S3</MenuItem>
                  <MenuItem value={storageTypes.AZURE_BLOB}>Azure Blob Storage</MenuItem>
                </Select>
                {fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
              </FormControl>
            )}
          />
        </Grid>

        {/* S3 specific fields */}
        {storageType === storageTypes.S3 && (
          <>
            <Grid item xs={12}>
              <Controller
                name="s3AccessKeyId"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Access Key ID"
                    fullWidth
                    size="small"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="s3SecretAccessKey"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Secret Access Key"
                    fullWidth
                    size="small"
                    type={showPassword ? 'text' : 'password'}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            size="small"
                          >
                            <Iconify
                              icon={showPassword ? 'eva:eye-off-fill' : 'eva:eye-fill'}
                              width={16}
                              height={16}
                            />
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="s3Region"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Region"
                    fullWidth
                    size="small"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="s3BucketName"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Bucket Name"
                    fullWidth
                    size="small"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Grid>
          </>
        )}

        {/* Azure Blob specific fields */}
        {storageType === storageTypes.AZURE_BLOB && (
          <>
            <Grid item xs={12} sm={6}>
              <Controller
                name="accountName"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Account Name"
                    fullWidth
                    size="small"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="containerName"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Container Name"
                    fullWidth
                    size="small"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="accountKey"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Account Key"
                    fullWidth
                    size="small"
                    type={showPassword ? 'text' : 'password'}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            size="small"
                          >
                            <Iconify
                              icon={showPassword ? 'eva:eye-off-fill' : 'eva:eye-fill'}
                              width={16}
                              height={16}
                            />
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="endpointProtocol"
                control={control}
                render={({ field, fieldState }) => (
                  <FormControl fullWidth size="small" error={!!fieldState.error}>
                    <InputLabel>Protocol</InputLabel>
                    <Select
                      {...field}
                      label="Protocol"
                    >
                      <MenuItem value="https">HTTPS</MenuItem>
                      <MenuItem value="http">HTTP</MenuItem>
                    </Select>
                    {fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
                  </FormControl>
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="endpointSuffix"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Endpoint Suffix"
                    fullWidth
                    size="small"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message || 'e.g., core.windows.net'}
                  />
                )}
              />
            </Grid>
          </>
        )}

        {/* Local storage specific fields */}
        {storageType === storageTypes.LOCAL && (
          <>
            <Grid item xs={12}>
              <Alert severity="info" sx={{ mb: 2 }}>
                Local storage is configured automatically. Additional options are optional.
              </Alert>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="mountName"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Mount Name (Optional)"
                    fullWidth
                    size="small"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller
                name="baseUrl"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Base URL (Optional)"
                    fullWidth
                    size="small"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message || 'e.g., http://localhost:3000/files'}
                  />
                )}
              />
            </Grid>
          </>
        )}
      </Grid>
    </Box>
  );
};

export default StorageConfigStep;