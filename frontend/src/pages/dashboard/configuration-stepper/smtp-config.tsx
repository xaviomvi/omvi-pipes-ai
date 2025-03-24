import { z } from 'zod';
import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  Box,
  Grid,
  Alert,
  TextField,
  Typography,
  IconButton,
  InputAdornment,
} from '@mui/material';

import { Iconify } from 'src/components/iconify';

import type { SmtpFormValues } from './types';

// Very simple schema - all fields are optional by default
const smtpSchema = z.object({
  host: z.string().optional(),
  port: z.number().optional().default(587),
  username: z.string().optional(),
  password: z.string().optional(),
  fromEmail: z.string().optional(),
}).superRefine((data, ctx) => {
  // Only validate if any field has a value
  const hasValues = data.host || (data.fromEmail && data.fromEmail.trim() !== '') || 
                    (data.username && data.username.trim() !== '') || 
                    (data.password && data.password.trim() !== '');
  
  if (hasValues) {
    // Check host
    if (!data.host || data.host.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SMTP Host is required when configuring SMTP",
        path: ["host"]
      });
    }
    
    // Check fromEmail
    if (!data.fromEmail || data.fromEmail.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "From Email is required when configuring SMTP",
        path: ["fromEmail"]
      });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.fromEmail)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must be a valid email address",
        path: ["fromEmail"]
      });
    }
  }
});

interface SmtpConfigStepProps {
  onSubmit: (data: SmtpFormValues) => void;
  onSkip: () => void;
  isSubmitting: boolean;
  initialValues: SmtpFormValues | null;
}

const SmtpConfigStep: React.FC<SmtpConfigStepProps> = ({
  onSubmit,
  onSkip,
  isSubmitting,
  initialValues,
}) => {
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showValidationWarning, setShowValidationWarning] = useState<boolean>(false);
  const [displayPort, setDisplayPort] = useState<string>(''); // For UI display
  
  // Default values - with port as a number to match the type
  const defaultValues = {
    host: '',
    port: 587, // Using the default number value
    username: '',
    password: '',
    fromEmail: '',
  };

  const {
    control,
    handleSubmit,
    reset,
    watch,
    getValues,
    formState: { errors },
    trigger,
    setValue,
  } = useForm<SmtpFormValues>({
    resolver: zodResolver(smtpSchema),
    mode: 'onSubmit',
    defaultValues,
  });

  // Watch form values
  const formValues = watch();

  // Initialize form with initial values if available
  useEffect(() => {
    if (initialValues) {
      reset(initialValues);
      // Update display port if initial values include a custom port
      if (initialValues.port && initialValues.port !== 587) {
        setDisplayPort(initialValues.port.toString());
      }
    }
  }, [initialValues, reset]);

  // Simple check if the user has entered any data
  const hasUserInput = (): boolean => {
    return !!(
      (formValues.host && formValues.host.trim()) ||
      (formValues.username && formValues.username.trim()) ||
      (formValues.password && formValues.password.trim()) ||
      (formValues.fromEmail && formValues.fromEmail.trim()) ||
      displayPort !== '' // Check if port has been changed
    );
  };

  // Expose the submit function with a clear signature that returns a promise
  useEffect(() => {
    // This function will be called from the parent component
    (window as any).submitSmtpForm = async () => {
      // If there's no user input, allow skipping without validation
      if (!hasUserInput()) {
        return true;
      }
      
      // If there is user input, validate the form
      const isFormValid = await trigger();
      
      if (!isFormValid) {
        // Show validation warning for partially filled forms
        setShowValidationWarning(true);
        return false;
      }
      
      // Form has input and is valid, submit it
      handleSubmit((data) => {
        // Use the actual port value in the form data
        onSubmit(data);
      })();
      
      return true;
    };

    // For getting form values without validation
    (window as any).getSmtpFormValues = () => getValues();

    return () => {
      // Clean up
      delete (window as any).submitSmtpForm;
      delete (window as any).getSmtpFormValues;
    };
  }, [handleSubmit, onSubmit, getValues, trigger, hasUserInput]);

  return (
    <Box component="form" id="smtp-config-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Typography variant="subtitle1" gutterBottom>
        SMTP Configuration
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure SMTP settings for email notifications. You can leave all fields empty to skip this configuration.
      </Typography>

      {/* Validation warning */}
      {showValidationWarning && Object.keys(errors).length > 0 && (
        <Alert 
          severity="warning" 
          sx={{ mb: 2 }}
          onClose={() => setShowValidationWarning(false)}
        >
          Please complete all required fields or leave all fields empty to skip this step.
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} sm={8}>
          <Controller
            name="host"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="SMTP Host"
                placeholder="e.g., smtp.gmail.com"
                fullWidth
                size="small"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} sm={4}>
          <Controller
            name="port"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                value={displayPort}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  setDisplayPort(inputValue);
                  
                  // Update the actual form value (empty string defaults to 587)
                  if (inputValue === '') {
                    field.onChange(587);
                  } else {
                    field.onChange(Number(inputValue));
                  }
                }}
                onBlur={field.onBlur}
                label="Port"
                placeholder="587"
                fullWidth
                size="small"
                type="number"
                error={!!fieldState.error}
                helperText={fieldState.error?.message || 'Default: 587'}
              />
            )}
          />
        </Grid>

        <Grid item xs={12}>
          <Controller
            name="fromEmail"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="From Email Address"
                placeholder="e.g., notifications@yourdomain.com"
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
            name="username"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="SMTP Username (Optional)"
                placeholder="e.g., your.username"
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
            name="password"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="SMTP Password (Optional)"
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
      </Grid>
    </Box>
  );
};

export default SmtpConfigStep;