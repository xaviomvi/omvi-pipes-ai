// WelcomeMessage.js
import React from 'react';

import { Box, Typography } from '@mui/material';

const WelcomeMessage = () => (
  // const theme = useTheme();

  <Box
    sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
      opacity: 0.7,
    }}
  >
    <img
      src="/logo/logo-blue.svg"
      alt="AI Assistant Logo"
      style={{
        width: '4rem',
        marginBottom: '16px',
      }}
    />
    <Typography variant="h5" gutterBottom>
      Welcome to AI Assistant
    </Typography>
    <Typography variant="body1" color="textSecondary">
      Start a conversation by typing a message below
    </Typography>
  </Box>
);

export default WelcomeMessage;
