import React from 'react';
import { Icon } from '@iconify/react';

import {
  Box,
  Dialog,
  Button,
  Typography,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
 
interface DeleteConversationDialogProps {
  open : boolean;
  onClose:  ()=> void;
  onConfirm :   () => Promise<void>;
  title ?: string ;
  isDeleting : boolean;
}

const DeleteConversationDialog = ({ open, onClose, onConfirm, title, isDeleting } : DeleteConversationDialogProps) => (
  <Dialog
    open={open}
    onClose={!isDeleting ? onClose : undefined}
    maxWidth="sm"
    fullWidth
    PaperProps={{
      elevation: 0,
      sx: { borderRadius: '16px' },
    }}
  >
    <DialogTitle sx={{ pb: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Icon icon="mdi:alert-circle-outline" color="#d32f2f" width={24} />
        <Typography variant="h6">Delete Conversation</Typography>
      </Box>
    </DialogTitle>
    <DialogContent>
      <Typography variant="body1" sx={{ mb: 1 }}>
        Are you sure you want to delete this conversation?
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {title || 'Untitled Conversation'}
      </Typography>
    </DialogContent>
    <DialogActions sx={{ p: 2 }}>
      <Button onClick={onClose} disabled={isDeleting} variant="outlined">
        Cancel
      </Button>
      <Button
        onClick={onConfirm}
        color="error"
        variant="contained"
        disabled={isDeleting}
        startIcon={
          isDeleting ? <CircularProgress size={20} color="inherit" /> : <Icon icon="mdi:delete" />
        }
      >
        {isDeleting ? 'Deleting...' : 'Delete'}
      </Button>
    </DialogActions>
  </Dialog>
);

export default DeleteConversationDialog;
