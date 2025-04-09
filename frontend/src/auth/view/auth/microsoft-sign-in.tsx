import { useState } from 'react';
import microsoftIcon from '@iconify-icons/mdi/microsoft';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import LoadingButton from '@mui/lab/LoadingButton';

import { Iconify } from 'src/components/iconify';

interface MicrosoftSignInProps {
  email: string;
}

export default function MicrosoftSignIn({ email }: MicrosoftSignInProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleMicrosoftLogin = async () => {
    setLoading(true);
    setError('');
    try {
      // Initialize Microsoft OAuth flow
      window.location.href = `/api/auth/microsoft/login?email=${encodeURIComponent(email)}`;
    } catch (err) {
      setError('Failed to initialize Microsoft sign in. Please try again.');
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
        onClick={handleMicrosoftLogin}
        startIcon={<Iconify icon={microsoftIcon} />}
      >
        Continue with Microsoft
      </LoadingButton>
    </Box>
  );
}
