import React, { useRef, useState } from 'react';
import closeIcon from '@iconify-icons/eva/close-outline';

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
      onClose={onClose}
      fullWidth
      maxWidth="md"
      aria-labelledby="configure-smtp-dialog-title"
    >
      <DialogTitle id="configure-smtp-dialog-title" sx={{ pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" component="div">
            Configure SMTP
          </Typography>
          <IconButton edge="end" color="inherit" onClick={onClose} aria-label="close">
            <Iconify icon={closeIcon} />
          </IconButton>
        </Box>
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
          variant="text"
          color="inherit"
          sx={{ color: theme.palette.text.secondary }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!isFormValid || isSaving}
          sx={{ px: 3, borderRadius: 1 }}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfigureSmtpDialog;
