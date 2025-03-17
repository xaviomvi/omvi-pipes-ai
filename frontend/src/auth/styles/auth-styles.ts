// styles/auth-styles.ts
import type { Theme } from '@mui/material/styles';

import { alpha } from '@mui/material/styles';

import type { StyleConfig } from '../types/auth';

export const CARD_STYLES = {
  width: '100%', 
  maxWidth: 480, 
  mx: 'auto', 
  mt: 4,
  backdropFilter: 'blur(6px)',
  bgcolor: (theme: Theme) => alpha(theme.palette.background.paper, 0.9),
  boxShadow: (theme: Theme) => `0 0 2px ${alpha(theme.palette.grey[500], 0.2)}, 
                               0 12px 24px -4px ${alpha(theme.palette.grey[500], 0.12)}`,
  borderRadius: 2,
  border: '1px solid',
  borderColor: 'divider',
};

export const TAB_STYLES = {
  mb: 4,
  '& .MuiTab-root': {
    minHeight: 48,
    textTransform: 'none',
    flexDirection: 'row',
    fontWeight: 600,
    color: 'text.secondary',
    borderRadius: '8px 8px 0 0',
    transition: 'all 0.2s ease-in-out',
    '&.Mui-selected': {
      color: 'primary.main',
      bgcolor: (theme: Theme) => alpha(theme.palette.primary.main, 0.08),
    },
    '& .MuiTab-iconWrapper': {
      mr: 1,
      transition: 'transform 0.2s ease-in-out',
    },
    '&:hover': {
      bgcolor: (theme: Theme) => alpha(theme.palette.primary.main, 0.04),
      '& .MuiTab-iconWrapper': {
        transform: 'scale(1.1)',
      },
    },
  },
  '& .MuiTabs-indicator': {
    height: 3,
    borderRadius: '3px 3px 0 0',
    bgcolor: 'primary.main',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as StyleConfig;

export const METHOD_CONFIGS = {
  tabConfig: {
    password: {
      icon: 'mdi:form-textbox-password',
      label: 'Password',
      component: 'PasswordSignIn',
    },
    otp: {
      icon: 'mdi:cellphone-message',
      label: 'OTP',
      component: 'OtpSignIn',
    },
    samlSso: {
      icon: 'mdi:shield-account',
      label: 'SSO',
      component: 'SamlSignIn',
    },
  },
  socialConfig: {
    google: {
      icon: 'mdi:google',
      label: 'Continue with Google',
      color: '#DB4437',
    },
    microsoft: {
      icon: 'mdi:microsoft',
      label: 'Continue with Microsoft',
      color: '#00A4EF',
    },
    azureAd: {
      icon: 'mdi:microsoft-azure',
      label: 'Continue with Azure AD',
      color: '#0078D4',
    },
  },
};