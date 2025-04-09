import { useState } from 'react';
import microsoftAzureIcon from '@iconify-icons/mdi/microsoft-azure';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import LoadingButton from '@mui/lab/LoadingButton';

import { Iconify } from 'src/components/iconify';

interface AzureAdSignInProps {
  email: string;
}

export default function AzureAdSignIn({ email }: AzureAdSignInProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAzureLogin = async () => {
    setLoading(true);
    setError('');
    try {
      // Initialize Azure AD OAuth flow
      window.location.href = `/api/auth/azure/login?email=${encodeURIComponent(email)}`;
    } catch (err) {
      setError('Failed to initialize Azure AD sign in. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <LoadingButton
        fullWidth
        size="large"
        variant="outlined"
        loading={loading}
        onClick={handleAzureLogin}
        startIcon={<Iconify icon={microsoftAzureIcon} />}
      >
        Continue with Azure AD
      </LoadingButton>
    </Box>
  );
}
