import { z } from 'zod';
import eyeIcon from '@iconify-icons/eva/eye-fill';
import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import eyeOffIcon from '@iconify-icons/eva/eye-off-fill';

import {
  Box,
  Grid,
  Alert,
  TextField,
  Typography,
  Link,
  IconButton,
  InputAdornment,
} from '@mui/material';

import { Iconify } from 'src/components/iconify';

import type { SmtpFormValues } from './types';

// Very simple schema - all fields are optional by default
const smtpSchema = z
  .object({
    host: z.string().optional(),
    port: z.number().optional().default(587),
    username: z.string().optional(),
    password: z.string().optional(),
    fromEmail: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Only validate if any field has a value
    const hasValues =
      data.host ||
      (data.fromEmail && data.fromEmail.trim() !== '') ||
      (data.username && data.username.trim() !== '') ||
      (data.password && data.password.trim() !== '');

    if (hasValues) {
      // Check host
      if (!data.host || data.host.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SMTP Host is required when configuring SMTP',
          path: ['host'],
        });
      }

      // Check fromEmail
      if (!data.fromEmail || data.fromEmail.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'From Email is required when configuring SMTP',
          path: ['fromEmail'],
        });
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.fromEmail)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Must be a valid email address',
          path: ['fromEmail'],
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
  const [validationAttempted, setValidationAttempted] = useState<boolean>(false);

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

  // Function to check if user has entered any data
  const hasUserInput = (): boolean =>
    !!(
      (formValues.host && formValues.host.trim()) ||
      (formValues.username && formValues.username.trim()) ||
      (formValues.password && formValues.password.trim()) ||
      (formValues.fromEmail && formValues.fromEmail.trim()) ||
      displayPort !== ''
    );

  // Expose the submit function with a clear signature that returns a promise
  useEffect(() => {
    // This function will be called from the parent component when Continue button is clicked
    (window as any).submitSmtpForm = async () => {
      setValidationAttempted(true);

      // Check if ANY field has input
      const hasAnyInput = hasUserInput();

      // If ANY field has input, ALL required fields must be filled
      if (hasAnyInput) {
        // Validate the entire form
        const isFormValid = await trigger();
        if (!isFormValid) {
          setShowValidationWarning(true);
          return false; // Return false to prevent submission
        }

        // Form is valid, submit it
        handleSubmit(onSubmit)();
        return true;
      }
      // ALL fields are empty - this should NOT happen when clicking Complete Setup
      // We should force the user to explicitly skip using the Skip button
      setShowValidationWarning(true);
      return false; // Return false to prevent submission
    };

    // For skipping - completely bypass validation
    (window as any).skipSmtpForm = () => {
      onSkip(); // Directly call skip
      return true;
    };

    // For checking if form has any input - needed by parent
    (window as any).hasSmtpInput = () => hasUserInput();

    // For getting form values
    (window as any).getSmtpFormValues = () => getValues();

    return () => {
      // Clean up
      delete (window as any).submitSmtpForm;
      delete (window as any).skipSmtpForm;
      delete (window as any).hasSmtpInput;
      delete (window as any).getSmtpFormValues;
    };
    // eslint-disable-next-line
  }, [handleSubmit, onSubmit, onSkip, getValues, trigger, formValues, displayPort]);
  return (
    <Box component="form" id="smtp-config-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Typography variant="subtitle1" gutterBottom>
        SMTP Configuration
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure SMTP settings for email notifications. You can leave all fields empty to skip this
        configuration or use the Skip button.
      </Typography>
      <Alert variant="outlined" severity="info" sx={{ my: 3 }}>
        Refer to{' '}
        <Link href="https://docs.pipeshub.com/smtp" target="_blank" rel="noopener">
          the documentation
        </Link>{' '}
        for more information.
      </Alert>

      {/* Validation warning - show when validation attempted and has errors */}
      {showValidationWarning && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setShowValidationWarning(false)}>
          <strong>SMTP Configuration Error:</strong>
          <br />
          {hasUserInput()
            ? 'Please complete all required SMTP fields to continue.'
            : "Please use the 'Skip SMTP Configuration' button if you don't want to configure SMTP."}
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
                error={validationAttempted && !!fieldState.error}
                helperText={
                  validationAttempted && fieldState.error
                    ? fieldState.error.message
                    : 'Required if configuring SMTP'
                }
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
                error={validationAttempted && !!fieldState.error}
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
                error={validationAttempted && !!fieldState.error}
                helperText={
                  validationAttempted && fieldState.error
                    ? fieldState.error.message
                    : 'Required if configuring SMTP'
                }
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
                error={validationAttempted && !!fieldState.error}
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
                error={validationAttempted && !!fieldState.error}
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
                          icon={showPassword ? eyeOffIcon : eyeIcon}
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
