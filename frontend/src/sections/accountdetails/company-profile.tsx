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
  Tooltip,
  Snackbar,
  MenuItem,
  CardMedia,
  Typography,
  CardContent,
  CircularProgress,
} from '@mui/material';

import { countries } from 'src/assets/data';

import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';

import { usePermissions } from './context/permission-context';
import {
  updateOrg,
  getOrgById,
  getOrgLogo,
  uploadOrgLogo,
  deleteOrgLogo,
  getOrgIdFromToken,
} from './context/utils';

import type { SnackbarState } from './types/organization-data';

const ProfileSchema = zod.object({
  registeredName: zod.string().min(1, { message: 'Name is required' }),
  shortName: zod.string().optional(),
  contactEmail: zod
    .string()
    .email({ message: 'Invalid email' })
    .min(1, { message: 'Email is required' }),
  permanentAddress: zod.object({
    addressLine1: zod.string().optional(),
    city: zod
      .string()
      .regex(/^[A-Za-z\s]+$/, 'City must contain only letters')
      .optional(),
    state: zod
      .string()
      .regex(/^[A-Za-z\s]+$/, 'State must contain only letters')
      .optional(),
    postCode: zod.string().optional(),
    country: zod.string().optional(),
  }),
});

type ProfileFormData = zod.infer<typeof ProfileSchema>;

export default function CompanyProfile() {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [saveChanges, setSaveChanges] = useState<boolean>(false);
  const [snackbar, setSnackbar] = useState<SnackbarState>({ 
    open: false, 
    message: '', 
    severity: undefined 
  });

  const { isAdmin } = usePermissions();

  const methods = useForm<ProfileFormData>({
    resolver: zodResolver(ProfileSchema),
    mode: 'onChange',
  });

  const {
    handleSubmit,
    reset,
    formState: { isValid, isDirty },
  } = methods;

  const handleCloseSnackbar = (): void => {
    setSnackbar({ open: false, message: '', severity: undefined });
  };

  useEffect(() => {
    const fetchOrgData = async () : Promise<void> => {
      try {
        setLoading(true);
        const orgId = await getOrgIdFromToken();
        const orgData = await getOrgById(orgId);
        const { registeredName, shortName, contactEmail, permanentAddress } = orgData;

        reset({
          registeredName,
          shortName,
          contactEmail,
          permanentAddress: {
            addressLine1: permanentAddress?.addressLine1 || '',
            city: permanentAddress?.city || '',
            state: permanentAddress?.state || '',
            postCode: permanentAddress?.postCode || '',
            country: permanentAddress?.country || '',
          },
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
    const fetchLogo = async () => {
      try {
        const orgId = await getOrgIdFromToken();
        const logoUrl = await getOrgLogo(orgId);
        setLogo(logoUrl);
      } catch (err) {
        setError('Failed to fetch logo');
        setSnackbar({ open: true, message: err.errorMessage, severity: 'error' });
        console.error(err, 'error in fetching logo');
      }
    };

    fetchLogo();
  }, []);

  const onSubmit = async (data : ProfileFormData) : Promise<void> => {
    try {
      setSaveChanges(true);
      const orgId = await getOrgIdFromToken();
      const msg = await updateOrg(orgId, data);
      setSnackbar({
        open: true,
        message: msg,
        severity: 'success',
      });
    } catch (err) {
      setError('Failed to update organization');
      setSnackbar({ open: true, message: err.errorMessage, severity: 'error' });
    } finally {
      setSaveChanges(false);
    }
  };

  const handleDelete = async () : Promise<void>  => {
    try {
      setDeleting(true);
      const orgId = await getOrgIdFromToken();
      await deleteOrgLogo(orgId);
      setSnackbar({ open: true, message: 'Logo removed successfully!', severity: 'success' });
      setDeleting(false);
      setLogo(null);
    } catch (err) {
      setError('Failed to remove logo');
      setSnackbar({ open: true, message: 'Failed to remove logo', severity: 'error' });
      setDeleting(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) : Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('logo', file);

    try {
      setUploading(true);
      const orgId = await getOrgIdFromToken();
      await uploadOrgLogo(orgId, formData);
      setSnackbar({ open: true, message: 'Logo updated successfully!', severity: 'success' });
      setUploading(false);
      setLogo(URL.createObjectURL(file));
    } catch (err) {
      setError('Failed to upload logo');
      setSnackbar({ open: true, message: 'Failed to upload logo', severity: 'error' });
      setUploading(false);
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
    <Box component="main" sx={{ flexGrow: 1, pl: 3, overflow: 'auto' }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 2 }}>
        Company Profile
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Form methods={methods} onSubmit={handleSubmit(onSubmit)}  {...({ noValidate: true } as any)}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Tooltip
                  title="The legal name the company was incorporated under"
                  arrow
                  placement="top-start"
                >
                  <Field.Text
                    name="registeredName"
                    label={
                      <>
                        Registered Name{' '}
                        <Typography
                          component="span"
                          color="error"
                          fontSize="1.5rem"
                          sx={{ verticalAlign: 'middle' }}
                        >
                          *
                        </Typography>
                      </>
                    }
                    fullWidth
                    disabled={!isAdmin}
                    sx={{
                      '& .MuiInputBase-input.Mui-disabled': {
                        cursor: 'not-allowed',
                      },
                    }}
                  />
                </Tooltip>
              </Grid>
              <Grid item xs={12}>
                <Tooltip
                  title="The name of the company to display within Pipeshub"
                  arrow
                  placement="top-start"
                >
                  <Field.Text
                    name="shortName"
                    label="Displayed name"
                    fullWidth
                    disabled={!isAdmin}
                    sx={{
                      '& .MuiInputBase-input.Mui-disabled': {
                        cursor: 'not-allowed',
                      },
                    }}
                  />
                </Tooltip>
              </Grid>
              <Grid item xs={12}>
                <Field.Text
                  disabled={!isAdmin}
                  sx={{
                    '& .MuiInputBase-input.Mui-disabled': {
                      cursor: 'not-allowed',
                    },
                  }}
                  name="permanentAddress.addressLine1"
                  label="Street address"
                  fullWidth
                />
              </Grid>
              <Grid item xs={6}>
                <Field.Text
                  disabled={!isAdmin}
                  sx={{
                    '& .MuiInputBase-input.Mui-disabled': {
                      cursor: 'not-allowed',
                    },
                  }}
                  name="permanentAddress.city"
                  label="City"
                  fullWidth
                />
              </Grid>
              <Grid item xs={6}>
                <Field.Text
                  disabled={!isAdmin}
                  sx={{
                    '& .MuiInputBase-input.Mui-disabled': {
                      cursor: 'not-allowed',
                    },
                  }}
                  name="permanentAddress.state"
                  label="State"
                  fullWidth
                />
              </Grid>
              <Grid item xs={6}>
                <Field.Text
                  name="permanentAddress.postCode"
                  label="Zip code/ Post code"
                  fullWidth
                  disabled={!isAdmin}
                  sx={{
                    '& .MuiInputBase-input.Mui-disabled': {
                      cursor: 'not-allowed',
                    },
                  }}
                />
              </Grid>
              <Grid item xs={6}>
                <Field.Select
                  disabled={!isAdmin}
                  sx={{
                    '& .MuiInputBase-input.Mui-disabled': {
                      cursor: 'not-allowed',
                    },
                  }}
                  name="permanentAddress.country"
                  label="Country"
                  fullWidth
                >
                  {countries.map((country) => (
                    <MenuItem key={country.code} value={country.code}>
                      {country.label}
                    </MenuItem>
                  ))}
                </Field.Select>
              </Grid>
              <Grid item xs={12}>
                <Field.Text
                  disabled={!isAdmin}
                  sx={{
                    '& .MuiInputBase-input.Mui-disabled': {
                      cursor: 'not-allowed',
                    },
                  }}
                  name="contactEmail"
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
                  size="large"
                  type="submit"
                  variant="contained"
                  loading={saveChanges}
                  loadingIndicator="Saving ..."
                  disabled={!isValid || !isDirty || !isAdmin}
                  sx={{
                    mt: -1,
                    width: '150px',
                    '&.Mui-disabled': {
                      cursor: 'not-allowed',
                      pointerEvents: 'auto',
                    },
                  }}
                >
                  Save
                </LoadingButton>
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
                      sx={{ mb: 2 }}
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
                        sx={{ mb: 2, ml: 2 }}
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
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {logo ? (
                  <CardMedia
                    component="img"
                    sx={{ width: 120, height: 120, borderRadius: 1, flexShrink: 0 }}
                    image={logo}
                    alt="Company Logo"
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
                      <Iconify icon="mdi:office-building" width={48} height={48} color="#9e9e9e" />
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

      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
