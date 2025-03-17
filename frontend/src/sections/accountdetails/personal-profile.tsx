import { z as zod } from 'zod';
import { useForm } from 'react-hook-form';
import React, { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';

import { LoadingButton } from '@mui/lab';
import {
  Box,
  Grid,
  Card,
  Alert,
  Button,
  Dialog,
  Snackbar,
  CardMedia,
  Typography,
  CardContent,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';

import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';

import { usePermissions } from './context/permission-context';
import {
  updateUser,
  getUserById,
  getUserLogo,
  deleteUserLogo,
  uploadUserLogo,
  changePassword,
  getUserIdFromToken,
} from './context/utils';

import type { SnackbarState } from './types/organization-data';

const ProfileSchema = zod.object({
  fullName: zod.string().min(1, { message: 'Full Name is required' }),
  firstName: zod.string().optional(),
  lastName: zod.string().optional(),
  email: zod.string().email({ message: 'Invalid email' }).min(1, { message: 'Email is required' }),
  designation: zod.string().optional(),
});

const PasswordSchema = zod
  .object({
    currentPassword: zod.string().min(1, { message: 'Current password is required' }),
    newPassword: zod
      .string()
      .min(8, { message: 'Password must be at least 8 characters long' })
      .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
      .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
      .regex(/[0-9]/, { message: 'Password must contain at least one number' })
      .regex(/[^a-zA-Z0-9]/, { message: 'Password must contain at least one symbol' }),
    repeatNewPassword: zod.string().min(1, { message: 'Please repeat your new password' }),
  })
  .refine((data) => data.newPassword === data.repeatNewPassword, {
    message: "Passwords don't match",
    path: ['repeatNewPassword'],
  });

type ProfileFormData = zod.infer<typeof ProfileSchema>;
type PasswordFormData = zod.infer<typeof PasswordSchema>;

export default function PersonalProfile() {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [snackbar, setSnackbar] = useState<SnackbarState>({ 
    open: false, 
    message: '', 
    severity: undefined 
  });
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState<boolean>(false);
  const [saveChanges, setSaveChanges] = useState<boolean>(false);
  const { isAdmin } = usePermissions(); 

  const methods = useForm<ProfileFormData>({
    resolver: zodResolver(ProfileSchema),
    mode: 'onChange',
  });

  const passwordMethods = useForm<PasswordFormData>({
    resolver: zodResolver(PasswordSchema),
    mode: 'onChange',
  });

  const {
    handleSubmit,
    reset,
    formState: { isValid, isDirty },
  } = methods;

  const handleCloseSnackbar = () => {
    setSnackbar({ open: false, message: '', severity: undefined });
  };

  useEffect(() => {
    const fetchOrgData = async () => {
      try {
        setLoading(true);
        const userId = await getUserIdFromToken();
        const userData = await getUserById(userId);
        const { fullName, firstName, email, lastName, designation } = userData;

        reset({
          fullName,
          firstName,
          email,
          lastName,
          designation,
        });

        setLoading(false);
      } catch (err) {
        setError('Failed to fetch organization data');
        setSnackbar({
          open: true,
          message: err.errorMessage,
          severity: 'error',
        });
        setLoading(false);
      }
    };

    fetchOrgData();
  }, [reset]);

  useEffect(() => {
    const fetchLogo = async () : Promise<void> => {
      try {
        const userId = await getUserIdFromToken();
        const logoUrl = await getUserLogo(userId);
        setLogo(logoUrl);
      } catch (err) {
        setError('Failed to fetch User logo');
        setSnackbar({ open: true, message: err.errorMessage, severity: 'error' });
      }
    };

    fetchLogo();
  }, []);

  const onSubmit = async (data : ProfileFormData) : Promise<void> => {
    try {
      setSaveChanges(true);
      const userId = await getUserIdFromToken();
      await updateUser(userId, data);
      setSnackbar({
        open: true,
        message: 'User updated successfully',
        severity: 'success',
      });
      setLoading(false);
    } catch (err) {
      setError('Failed to update user');
      setSnackbar({ open: true, message: err.errorMessage, severity: 'error' });
      setLoading(false);
    } finally {
      setSaveChanges(false);
    }
  };

  const handleDelete = async () : Promise<void> => {
    try {
      setDeleting(true);
      const userId = await getUserIdFromToken();
      await deleteUserLogo(userId);
      setSnackbar({ open: true, message: 'Logo removed successfully!', severity: 'success' });
      setDeleting(false);
      setLogo(null);
    } catch (err) {
      setSnackbar({ open: true, message: err.errorMessage, severity: 'error' });
      setDeleting(false);
    }
  };

  const handleUpload = async (event : React.ChangeEvent<HTMLInputElement>) : Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('logo', file);

    try {
      setUploading(true);
      const userId = await getUserIdFromToken();
      await uploadUserLogo(userId, formData);
      setSnackbar({ open: true, message: 'Logo updated successfully!', severity: 'success' });
      setUploading(false);
      setLogo(URL.createObjectURL(file));
    } catch (err) {
      setError('Failed to upload logo');
      setSnackbar({ open: true, message: 'Failed to upload logo', severity: 'error' });
      setUploading(false);
    }
  };

  const handleChangePassword = async (data: PasswordFormData): Promise<void> => {
    try {
      await changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      setSnackbar({
        open: true,
        message: 'Password changed successfully',
        severity: 'success',
      });
      setIsChangePasswordOpen(false);
      passwordMethods.reset();
    } catch (err) {
      setSnackbar({ open: true, message: err.errorMessage, severity: 'error' });
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          width: '100%',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box component="main" sx={{ flexGrow: 1, p: 3, overflow: 'auto' }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        Personal Profile
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Form methods={methods} onSubmit={handleSubmit(onSubmit)}  {...({ noValidate: true } as any)}>
            <Grid container spacing={5}>
              <Grid item xs={6}>
                <Field.Text name="firstName" label="First name" fullWidth />
              </Grid>
              <Grid item xs={6}>
                <Field.Text name="lastName" label="Last Name" fullWidth />
              </Grid>
              <Grid item xs={12}>
                <Field.Text
                  name="fullName"
                  label={
                    <>
                      Full Name{' '}
                      <span style={{ color: 'red', fontSize: '1.5rem', verticalAlign: 'middle' }}>
                        *
                      </span>
                    </>
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <Field.Text name="designation" label="Designation" fullWidth />
              </Grid>

              <Grid item xs={12}>
                <Field.Text
                  name="email"
                  label={
                    <>
                      Contact Email{' '}
                      <span style={{ color: 'red', fontSize: '1.5rem', verticalAlign: 'middle' }}>
                        *
                      </span>
                    </>
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <LoadingButton
                  color="primary"
                  type="submit"
                  variant="contained"
                  loading={saveChanges}
                  loadingIndicator="Saving ..."
                  disabled={!isValid || !isDirty}
                  sx={{ width: '150px', mt: -1 }}
                >
                  Save
                </LoadingButton>
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={() => setIsChangePasswordOpen(true)}
                  sx={{ ml: 2 }}
                >
                  Change Password
                </Button>
              </Grid>
            </Grid>
          </Form>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', mb: 2 }}>
                {isAdmin && (
                  <>
                    <LoadingButton
                      variant="contained"
                      component="label"
                      startIcon={<Iconify icon="ep:upload-filled" width="24" height="24" />}
                      loadingIndicator="Uploading..."
                      loading={uploading}
                    >
                      Upload
                      <input
                        style={{ display: 'none' }}
                        id="file-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleUpload}
                      />
                    </LoadingButton>
                    {logo && (
                      <LoadingButton
                        startIcon={<Iconify icon="ic:baseline-delete" width="24" height="24" />}
                        variant="contained"
                        sx={{ ml: 2 }}
                        onClick={handleDelete}
                        loadingIndicator="Removing..."
                        loading={deleting}
                      >
                        Remove
                      </LoadingButton>
                    )}
                  </>
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                {logo ? (
                  <CardMedia
                    component="img"
                    sx={{ width: 120, height: 120, borderRadius: 1, flexShrink: 0 }}
                    image={logo}
                    alt="User Logo"
                  />
                ) : (
                  <>
                    <Box
                      sx={{
                        width: 100,
                        height: 100,
                        bgcolor: 'grey.200',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 1,
                        mr: 2,
                        flexShrink: 0,
                      }}
                    >
                      <Iconify icon="mdi:account" width={48} height={48} color="#9e9e9e" />
                    </Box>
                    {isAdmin && (
                      <Typography variant="body2" color="text.secondary">
                        Upload a logo to customize your Pipeshub account and email notifications.
                      </Typography>
                    )}
                  </>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)}>
        <DialogTitle>Change Password</DialogTitle>
        <Form
          methods={passwordMethods}
          onSubmit={passwordMethods.handleSubmit(handleChangePassword)}
        >
          <DialogContent>
            <Field.Text
              name="currentPassword"
              label="Current password"
              type="password"
              fullWidth
              margin="normal"
            />
            <Field.Text
              name="newPassword"
              label="New password"
              type="password"
              fullWidth
              margin="normal"
            />
            <Typography variant="caption" color="text.secondary">
              Min. 8 characters • Lowercase letter • Uppercase letter • Number • Symbol
            </Typography>
            <Field.Text
              name="repeatNewPassword"
              label="Repeat new password"
              type="password"
              fullWidth
              margin="normal"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsChangePasswordOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" color="primary" disabled={!isValid}>
              Set Password
            </Button>
          </DialogActions>
        </Form>
        <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={handleCloseSnackbar}>
          <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
