import { z as zod } from 'zod';
import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import loginIcon from '@iconify-icons/mdi/login';
import eyeFillIcon from '@iconify-icons/ri/eye-fill';
import { zodResolver } from '@hookform/resolvers/zod';
import key2FillIcon from '@iconify-icons/ri/key-2-fill';
import { useLocation, useNavigate } from 'react-router-dom';
import eyeOffFillIcon from '@iconify-icons/ri/eye-off-fill';
import lockPasswordFillIcon from '@iconify-icons/ri/lock-password-fill';
import shieldKeyholeFillIcon from '@iconify-icons/ri/shield-keyhole-fill';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Fade from '@mui/material/Fade';
import Grow from '@mui/material/Grow';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import { alpha } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';
import InputAdornment from '@mui/material/InputAdornment';

import { useRouter } from 'src/routes/hooks';

import { Iconify } from 'src/components/iconify';

import { resetPassword } from '../../context/jwt';

// ----------------------------------------------------------------------

export const ResetPasswordSchema = zod
  .object({
    newPassword: zod
      .string()
      .min(6, { message: 'Password must be at least 6 characters!' })
      .nonempty({ message: 'New Password is required!' }),
    confirmNewPassword: zod
      .string()
      .min(6, { message: 'Password must be at least 6 characters!' })
      .nonempty({ message: 'Confirm New Password is required!' }),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords don't match",
    path: ['confirmNewPassword'],
  });

type ResetPasswordSchemaType = zod.infer<typeof ResetPasswordSchema>;

interface ErrorResponse {
  errorMessage: string;
}

// ----------------------------------------------------------------------

export default function ResetPassword() {
  const location = useLocation();
  const router = useRouter();
  const navigate = useNavigate();

  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [isValidRoute, setIsValidRoute] = useState<boolean>(true);

  // Extract token from URL (query params or hash)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    let token = params.get('token');

    // Check if token is in hash fragment
    if (!token && location.hash) {
      // Handle format like #token=xyz
      if (location.hash.includes('token=')) {
        token = location.hash.split('token=')[1];

        // Remove any additional hash parameters if present
        if (token.includes('&')) {
          token = token.split('&')[0];
        }
      }
    }

    if (token) {
      setResetToken(token);
      setIsValidRoute(true);
    } else {
      setIsValidRoute(false);
      setErrorMsg(
        'Password reset token is missing. This page is only accessible from a password reset email link.'
      );
    }
  }, [location]);

  const methods = useForm<ResetPasswordSchemaType>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  const {
    handleSubmit,
    register,
    formState: { errors },
  } = methods;

  const onSubmit = async (data: ResetPasswordSchemaType): Promise<void> => {
    try {
      if (!resetToken) {
        setErrorMsg('Password reset token is missing. Please use the link from your email.');
        return;
      }

      setIsSubmitting(true);
      const { newPassword } = data;

      await resetPassword({ token: resetToken, newPassword });

      // Show success message
      setErrorMsg('');
      setSuccessMsg('Password has been reset successfully. Redirecting to login...');

      // Redirect after a short delay
      setTimeout(() => {
        router.replace('/auth/sign-in');
      }, 2000);
    } catch (error) {
      setErrorMsg(
        typeof error === 'string'
          ? error
          : (error as ErrorResponse).errorMessage || 'Failed to reset password. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNavigateToSignIn = () => {
    navigate('/auth/sign-in');
  };

  return (
    <Fade in timeout={450}>
      <Card
        sx={{
          width: '100%',
          maxWidth: 480,
          mx: 'auto',
          mt: 4,
          backdropFilter: 'blur(6px)',
          bgcolor: (theme) => alpha(theme.palette.background.paper, 0.9),
          boxShadow: (theme) => `0 0 2px ${alpha(theme.palette.grey[500], 0.2)}, 
                             0 12px 24px -4px ${alpha(theme.palette.grey[500], 0.12)}`,
        }}
      >
        <CardContent sx={{ pt: 5, pb: 5 }}>
          <Box sx={{ mb: 5, textAlign: 'center' }}>
            <Typography variant="h4" sx={{ mb: 1, fontWeight: 700 }}>
              Reset Password
            </Typography>

            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {isValidRoute
                ? 'Please enter your new password below'
                : 'This page is only accessible from a password reset email link'}
            </Typography>
          </Box>

          {!!errorMsg && (
            <Grow in>
              <Alert
                severity="error"
                onClose={() => setErrorMsg('')}
                sx={{
                  mb: 3,
                  '& .MuiAlert-message': { width: '100%' },
                }}
              >
                {errorMsg}
              </Alert>
            </Grow>
          )}
          {!!successMsg && (
            <Grow in>
              <Alert
                severity="success"
                sx={{
                  mb: 3,
                  '& .MuiAlert-message': { width: '100%' },
                }}
              >
                {successMsg}
              </Alert>
            </Grow>
          )}

          {!isValidRoute ? (
            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                If you need to reset your password, please return to the sign-in page and use the
                &quot;Forgot Password&quot; option.
              </Typography>
              <Button
                fullWidth
                size="large"
                variant="contained"
                onClick={handleNavigateToSignIn}
                startIcon={<Iconify icon={loginIcon} />}
                sx={{
                  height: 48,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  borderRadius: 1.5,
                  '&:hover': {
                    bgcolor: 'primary.dark',
                  },
                }}
              >
                Go to Sign In
              </Button>
            </Box>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)}>
              <Stack spacing={3}>
                <TextField
                  fullWidth
                  autoFocus
                  size="medium"
                  label="New Password"
                  type={showNewPassword ? 'text' : 'password'}
                  {...register('newPassword')}
                  error={!!errors.newPassword}
                  helperText={errors.newPassword?.message}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Iconify
                          icon={lockPasswordFillIcon}
                          width={24}
                          sx={{ color: 'text.secondary' }}
                        />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          edge="end"
                          sx={{
                            color: (theme) => alpha(theme.palette.primary.main, 0.8),
                            '&:hover': {
                              backgroundColor: (theme) => alpha(theme.palette.primary.lighter, 0.2),
                            },
                          }}
                        >
                          <Iconify icon={showNewPassword ? eyeFillIcon : eyeOffFillIcon} />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1.5,
                      bgcolor: 'background.paper',
                    },
                  }}
                />

                <TextField
                  fullWidth
                  size="medium"
                  label="Confirm New Password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  {...register('confirmNewPassword')}
                  error={!!errors.confirmNewPassword}
                  helperText={errors.confirmNewPassword?.message}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Iconify
                          icon={shieldKeyholeFillIcon}
                          width={24}
                          sx={{ color: 'text.secondary' }}
                        />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          edge="end"
                          sx={{
                            color: (theme) => alpha(theme.palette.primary.main, 0.8),
                            '&:hover': {
                              backgroundColor: (theme) => alpha(theme.palette.primary.lighter, 0.2),
                            },
                          }}
                        >
                          <Iconify icon={showConfirmPassword ? eyeFillIcon : eyeOffFillIcon} />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1.5,
                      bgcolor: 'background.paper',
                    },
                  }}
                />

                <LoadingButton
                  fullWidth
                  size="large"
                  type="submit"
                  variant="contained"
                  loading={isSubmitting}
                  loadingIndicator="Resetting password..."
                  disabled={!resetToken}
                  sx={{
                    height: 48,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    borderRadius: 1.5,
                    mt: 2,
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                    '&.Mui-disabled': {
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.4),
                    },
                  }}
                  startIcon={<Iconify icon={key2FillIcon} />}
                >
                  Reset Password
                </LoadingButton>
              </Stack>
            </form>
          )}
        </CardContent>
      </Card>
    </Fade>
  );
}
