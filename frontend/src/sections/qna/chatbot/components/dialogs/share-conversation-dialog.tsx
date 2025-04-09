import type { User } from 'src/context/UserContext';
import type { SnackbarState } from 'src/types/chat-sidebar';

import { Icon } from '@iconify/react';
import React, { useState } from 'react';
import magnifyIcon from '@iconify-icons/mdi/magnify';
import contentCopyIcon from '@iconify-icons/mdi/content-copy';

import {
  Box,
  Paper,
  Alert,
  Dialog,
  Button,
  Checkbox,
  Snackbar,
  MenuItem,
  TextField,
  Typography,
  IconButton,
  DialogTitle,
  Autocomplete,
  DialogContent,
  DialogActions,
} from '@mui/material';

import axiosInstance from 'src/utils/axios';

import { useUsers } from 'src/context/UserContext';

interface ShareConversationDialogProps {
  open: boolean;
  onClose: () => void;
  conversationId: string | null;
}

const ShareConversationDialog = ({
  open,
  onClose,
  conversationId,
}: ShareConversationDialogProps) => {
  const users = useUsers();
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [shareLink, setShareLink] = useState<string>('');
  const [isShared, setIsShared] = useState<boolean>(false);
  const [snackbarState, setSnackbarState] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });

  const handleShareConversation = async () => {
    try {
      const response = await axiosInstance.post(`/api/v1/conversations/${conversationId}/share`, {
        isPublic: true,
        userIds: selectedUsers.map((user) => user._id),
      });

      // const { shareLink } = response.data;
      setShareLink(response.data.shareLink);
      setIsShared(true);
      setSnackbarState({
        open: true,
        message: 'Conversation shared successfully',
        severity: 'success',
      });
    } catch (error) {
      setSnackbarState({
        open: true,
        message: 'Failed to share conversation',
        severity: 'error',
      });
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setSnackbarState({
        open: true,
        message: 'Link copied to clipboard',
        severity: 'success',
      });
    } catch (error) {
      setSnackbarState({
        open: true,
        message: 'Failed to copy link',
        severity: 'error',
      });
    }
  };

  const handleDialogClose = () => {
    setSelectedUsers([]);
    setShareLink('');
    setIsShared(false);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={handleDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h6">Share Conversation</Typography>
        </DialogTitle>
        <DialogContent dividers>
          {/* Share Link Section */}
          {(isShared || shareLink) && (
            <Box mb={3} sx={{ backgroundColor: 'background.neutral', p: 2, borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Share Link
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  backgroundColor: 'background.paper',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  p: 1,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {shareLink}
                </Typography>
                <IconButton
                  size="small"
                  onClick={handleCopyLink}
                  sx={{
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  <Icon icon={contentCopyIcon} />
                </IconButton>
              </Box>
            </Box>
          )}

          {/* User Selection Section */}
          <Box mb={2}>
            <Autocomplete
              multiple
              limitTags={2}
              options={users}
              getOptionLabel={(user) => user.fullName}
              value={selectedUsers}
              onChange={(event, newValue) => {
                setSelectedUsers(newValue);
              }}
              renderOption={(props, user, { selected }) => (
                <MenuItem {...props}>
                  <Checkbox checked={selected} color="primary" />
                  <Box ml={1}>
                    <Typography>{user.fullName}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {user.email}
                    </Typography>
                  </Box>
                </MenuItem>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  variant="outlined"
                  placeholder="Search users"
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <Box mr={1} display="flex" alignItems="center">
                          <Icon icon={magnifyIcon} />
                        </Box>
                        {params.InputProps.startAdornment}
                      </>
                    ),
                  }}
                />
              )}
              PaperComponent={({ children }) => (
                <Paper
                  sx={{
                    maxHeight: 200,
                    overflow: 'auto',
                    '&::-webkit-scrollbar': {
                      width: '8px',
                    },
                    '&::-webkit-scrollbar-track': {
                      backgroundColor: 'background.neutral',
                      borderRadius: '8px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      backgroundColor: 'grey.400',
                      borderRadius: '8px',
                      '&:hover': {
                        backgroundColor: 'grey.500',
                      },
                    },
                  }}
                >
                  {children}
                </Paper>
              )}
              ListboxProps={{
                style: {
                  maxHeight: 'none', // Remove the default listbox scrolling
                },
              }}
            />
          </Box>

          <Box mt={2}>
            <Typography variant="caption" color="textSecondary">
              Sharing conversations with user uploaded images is not yet supported
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Close</Button>
          {(!isShared || !shareLink) && (
            <Button
              onClick={handleShareConversation}
              variant="contained"
              color="primary"
              disabled={selectedUsers.length === 0}
            >
              Share
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarState.open}
        autoHideDuration={3000}
        onClose={() => setSnackbarState((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbarState((prev) => ({ ...prev, open: false }))}
          severity={snackbarState.severity}
          variant="filled"
          elevation={6}
        >
          {snackbarState.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ShareConversationDialog;
