import type {
  SelectChangeEvent} from '@mui/material';

import { z } from 'zod';
import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  Box,
  Grid,
  Alert,
  Select,
  Button,
  MenuItem,
  useTheme,
  TextField,
  Typography,
  InputLabel,
  IconButton,
  FormControl,
  FormHelperText,
  InputAdornment
} from '@mui/material';

import { Iconify } from 'src/components/iconify';

import type { LlmFormValues, AzureLlmFormValues, OpenAILlmFormValues } from './types';

// Zod schema for OpenAI validation
const openaiSchema = z.object({
  modelType: z.literal('openai'),
  clientId: z.string().min(1, 'Client ID is required'),
  apiKey: z.string().min(1, 'API Key is required'),
  model: z.string().min(1, 'Model is required'),
});

// Zod schema for Azure OpenAI validation
const azureSchema = z.object({
  modelType: z.literal('azure'),
  endpoint: z.string().min(1, 'Endpoint is required'),
  apiKey: z.string().min(1, 'API Key is required'),
  deploymentName: z.string().min(1, 'Deployment Name is required'),
  model: z.string().min(1, 'Model is required'),
});

// Combined schema using discriminated union
const llmSchema = z.discriminatedUnion('modelType', [openaiSchema, azureSchema]);

interface LlmConfigStepProps {
  onSubmit: (data: LlmFormValues) => void;
  onSkip: () => void; // Keep interface unchanged, but we won't use this
  initialValues: LlmFormValues | null;
}

const LlmConfigStep: React.FC<LlmConfigStepProps> = ({ onSubmit, onSkip, initialValues }) => {
  const theme = useTheme();
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [modelType, setModelType] = useState<'openai' | 'azure'>(
    initialValues?.modelType || 'openai'
  );

  // Get default values based on modelType
  const getDefaultValues = () => {
    if (modelType === 'azure') {
      return {
        modelType: 'azure' as const,
        endpoint: (initialValues as AzureLlmFormValues)?.endpoint || '',
        apiKey: initialValues?.apiKey || '',
        deploymentName: (initialValues as AzureLlmFormValues)?.deploymentName || '',
        model: initialValues?.model || '',
      } as AzureLlmFormValues;
    }
    return {
      modelType: 'openai' as const,
      clientId: (initialValues as OpenAILlmFormValues)?.clientId || '',
      apiKey: initialValues?.apiKey || '',
      model: initialValues?.model || '',
    } as OpenAILlmFormValues;
  };

  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid },
  } = useForm<LlmFormValues>({
    resolver: zodResolver(llmSchema),
    mode: 'onChange',
    defaultValues: getDefaultValues(),
  });

  // Handle model type change
  const handleModelTypeChange = (newType: 'openai' | 'azure') => {
    setModelType(newType);
    reset(
      newType === 'azure'
        ? ({
            modelType: 'azure',
            endpoint: '',
            apiKey: '',
            deploymentName: '',
            model: '',
          } as AzureLlmFormValues)
        : ({
            modelType: 'openai',
            clientId: '',
            apiKey: '',
            model: '',
          } as OpenAILlmFormValues)
    );
  };

  // Initialize form with initial values if available
  useEffect(() => {
    if (initialValues) {
      setModelType(initialValues.modelType);
      reset(initialValues);
    }
  }, [initialValues, reset]);

  // Expose submit method to parent component - make sure this works with a single click
  useEffect(() => {
    (window as any).submitLlmForm = () => {
      if (isValid) {
        // Use a simple trick to ensure the form submits directly
        const formSubmitHandler = handleSubmit((data) => {
          onSubmit(data);
          return true;
        });

        // Execute the submission handler directly
        formSubmitHandler();
        return true;
      }
      return false;
    };

    return () => {
      delete (window as any).submitLlmForm;
    };
  }, [isValid, handleSubmit, onSubmit]);

  // Direct form submission handler to avoid double-click issues
  const onFormSubmit = (data: LlmFormValues) => {
    // Call the parent's onSubmit directly
    onSubmit(data);
  };

  return (
    <Box component="form" id="llm-config-form" onSubmit={handleSubmit(onFormSubmit)} noValidate>
      <Typography variant="subtitle1" gutterBottom>
        Large Language Model
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Configure OpenAI or Azure OpenAI to enable AI features.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        LLM configuration is required to proceed with setup.
      </Alert>

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Controller
            name="modelType"
            control={control}
            render={({ field, fieldState }) => (
              <FormControl fullWidth error={!!fieldState.error} size="small">
                <InputLabel>Provider</InputLabel>
                <Select
                  {...field}
                  label="Provider"
                  onChange={(e: SelectChangeEvent) => {
                    const newType = e.target.value as 'openai' | 'azure';
                    field.onChange(newType);
                    handleModelTypeChange(newType);
                  }}
                >
                  <MenuItem value="openai">OpenAI</MenuItem>
                  <MenuItem value="azure">Azure OpenAI</MenuItem>
                </Select>
                {fieldState.error && <FormHelperText>{fieldState.error.message}</FormHelperText>}
              </FormControl>
            )}
          />
        </Grid>

        {/* OpenAI specific fields */}
        {modelType === 'openai' && (
          <Grid item xs={12}>
            <Controller
              name="clientId"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Client ID"
                  fullWidth
                  size="small"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Grid>
        )}

        {/* Azure OpenAI specific fields */}
        {modelType === 'azure' && (
          <>
            <Grid item xs={12}>
              <Controller
                name="endpoint"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Endpoint"
                    fullWidth
                    size="small"
                    error={!!fieldState.error}
                    helperText={
                      fieldState.error?.message ||
                      'e.g., https://your-resource-name.openai.azure.com/'
                    }
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="deploymentName"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Deployment Name"
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

        {/* Common fields for both providers */}
        <Grid item xs={12}>
          <Controller
            name="apiKey"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="API Key"
                fullWidth
                size="small"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                type={showPassword ? 'text' : 'password'}
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

        <Grid item xs={12}>
          <Controller
            name="model"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Model Name"
                fullWidth
                size="small"
                error={!!fieldState.error}
                helperText={
                  fieldState.error?.message ||
                  (modelType === 'openai' ? 'e.g., gpt-4-turbo' : 'e.g., gpt-4')
                }
              />
            )}
          />
        </Grid>
      </Grid>

      {/* This hidden submit button ensures the form can be submitted programmatically */}
      <Button type="submit" style={{ display: 'none' }} id="llm-form-submit-button">
        Submit
      </Button>
    </Box>
  );
};

export default LlmConfigStep;
