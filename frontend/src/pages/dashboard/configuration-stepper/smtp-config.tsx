import { z } from 'zod';
import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  Box,
  Grid,
  TextField,
  Typography,
  IconButton,
  InputAdornment,
} from '@mui/material';

import { Iconify } from 'src/components/iconify';

import type { SmtpFormValues } from './types';

// Zod schema for validation
const smtpSchema = z.object({
  host: z.string().min(1, 'SMTP Host is required'),
  port: z.number().int().positive().min(1, 'Port must be a positive number'),
  username: z.string().optional(),
  password: z.string().optional(),
  fromEmail: z.string().email('Must be a valid email'),
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

  const {
    control,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isValid },
  } = useForm<SmtpFormValues>({
    resolver: zodResolver(smtpSchema),
    mode: 'onChange',
    defaultValues: {
      host: '',
      port: 587,
      username: '',
      password: '',
      fromEmail: '',
    },
  });

  // Initialize form with initial values if available
  useEffect(() => {
    if (initialValues) {
      reset(initialValues);
    }
  }, [initialValues, reset]);

  // Use a more reliable method to expose the submit function
  useEffect(() => {
    // Expose two functions: one for validated submission, one for skipping validation
    (window as any).submitSmtpForm = () => {
      if (isValid) {
        // If the form is valid, submit it normally
        console.log('SMTP form is valid, submitting normally');
        handleSubmit(onSubmit)();
        return true;
      }

      // No need for else - we'll only reach here if isValid is false
      console.log('SMTP form is invalid, cannot submit');
      return false;
    };

    // Add a bypass method that will skip validation and just send current values
    (window as any).getSmtpFormValues = () => getValues();

    return () => {
      // Clean up when component unmounts
      delete (window as any).submitSmtpForm;
      delete (window as any).getSmtpFormValues;
    };
  }, [isValid, handleSubmit, onSubmit, getValues]);

  return (
    <Box component="form" id="smtp-config-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Typography variant="subtitle1" gutterBottom>
        SMTP Configuration
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure SMTP settings for email notifications.
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={8}>
          <Controller
            name="host"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="SMTP Host"
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
                {...field}
                label="Port"
                fullWidth
                size="small"
                type="number"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                onChange={(e) => {
                  const {value} = e.target;
                  field.onChange(value === '' ? '' : Number(value));
                }}
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

      {/* No buttons here - all buttons moved to dialog footer */}
    </Box>
  );
};

export default SmtpConfigStep;
