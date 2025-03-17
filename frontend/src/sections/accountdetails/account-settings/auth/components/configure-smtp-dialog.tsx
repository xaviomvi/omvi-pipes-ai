import React, { useRef, useState } from 'react';

import {
  Box,
  Dialog,
  Button,
  Divider,
  useTheme,
  IconButton,
  Typography,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';

import { Iconify } from 'src/components/iconify';

import SmtpConfigForm from './smtp-config-form';

import type { SmtpConfigFormRef } from './smtp-config-form';

interface ConfigureSmtpDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}

const ConfigureSmtpDialog: React.FC<ConfigureSmtpDialogProps> = ({ open, onClose, onSave }) => {
  const theme = useTheme();
  const [isFormValid, setIsFormValid] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const formRef = useRef<SmtpConfigFormRef>(null);

  const handleFormValidationChange = (isValid: boolean) => {
    setIsFormValid(isValid);
  };

  const handleSave = async () => {
    if (!formRef.current) return;

    setIsSaving(true);
    try {
      const success = await formRef.current.handleSave();

      if (success) {
        onSave();
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={!isSaving ? onClose : undefined}
      maxWidth="md"
      PaperProps={{
        elevation: 5,
        sx: {
          borderRadius: 2,
          width: '100%',
          maxWidth: 600,
        },
      }}
    >
      <DialogTitle
        sx={{
          pb: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Iconify icon="eva:email-outline" width={22} height={22} />
          <Typography variant="h6" component="span">
            Configure SMTP
          </Typography>
        </Box>
        <IconButton
          edge="end"
          onClick={onClose}
          disabled={isSaving}
          aria-label="close"
          sx={{
            color: theme.palette.text.secondary,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          <Iconify icon="eva:close-outline" />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 3 }}>
        <SmtpConfigForm
          ref={formRef}
          onValidationChange={handleFormValidationChange}
          onSaveSuccess={onSave}
        />
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          onClick={onClose}
          disabled={isSaving}
          variant="outlined"
          sx={{
            borderRadius: 1,
            borderColor: theme.palette.divider,
            color: theme.palette.text.primary,
            '&:hover': {
              borderColor: theme.palette.text.secondary,
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!isFormValid || isSaving}
          variant="contained"
          color="primary"
          sx={{
            borderRadius: 1,
            boxShadow: 'none',
            '&:hover': {
              boxShadow: 'none',
              backgroundColor: theme.palette.primary.dark,
            },
          }}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfigureSmtpDialog;
