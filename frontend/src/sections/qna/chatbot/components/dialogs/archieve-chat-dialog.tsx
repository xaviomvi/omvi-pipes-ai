import type { AlertColor } from '@mui/material';
import type { Conversation } from 'src/types/chat-bot';
import type { SnackbarState } from 'src/types/chat-sidebar';

import { Icon } from '@iconify/react';
import closeIcon from '@iconify-icons/mdi/close';
import React, { useState, useEffect } from 'react';
import archiveIcon from '@iconify-icons/mdi/archive-off-outline';
import archiveUpIcon from '@iconify-icons/mdi/archive-arrow-up-outline';

import {
  Box,
  List,
  Fade,
  Alert,
  Paper,
  Dialog,
  Divider,
  Tooltip,
  ListItem,
  Snackbar,
  useTheme,
  Skeleton,
  IconButton,
  Typography,
  DialogTitle,
  DialogContent,
  ListItemButton,
  CircularProgress,
} from '@mui/material';

import axiosInstance from 'src/utils/axios';

type ArchivedChatsDialogProps = {
  open: boolean;
  onClose: () => void;
  onSelectChat: (chat: Conversation) => Promise<void>;
  onUnarchive: () => Promise<void>;
};

const formatDistanceToNow = (date: string): string => {
  const now = new Date();
  const pastDate = new Date(date);
  const diff = now.getTime() - pastDate.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
};

const EmptyState = () => (
  <Fade in>
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      py={8}
      gap={2}
    >
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 2,
          bgcolor: 'background.neutral',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Icon icon={archiveIcon} width={48} height={48} color="text.secondary" />
        <Box textAlign="center">
          <Typography variant="subtitle1" color="text.secondary" gutterBottom>
            No Archived Conversations
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Archived conversations will appear here
          </Typography>
        </Box>
      </Paper>
    </Box>
  </Fade>
);

const LoadingSkeleton = () => (
  <Box p={2}>
    {[...Array(3)].map((_, i) => (
      <Box key={i} sx={{ mb: 2 }}>
        <Skeleton variant="text" width="60%" height={24} />
        <Skeleton variant="text" width="40%" height={20} />
        <Skeleton variant="text" width="80%" height={20} />
        {i < 2 && <Divider sx={{ mt: 2 }} />}
      </Box>
    ))}
  </Box>
);

const ArchivedChatsDialog = ({
  open,
  onClose,
  onSelectChat,
  onUnarchive,
}: ArchivedChatsDialogProps) => {
  const theme = useTheme();
  const [archivedChats, setArchivedChats] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUnarchiving, setIsUnarchiving] = useState<boolean>(false);
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });

  useEffect(() => {
    if (open) {
      fetchArchivedChats();
    }
  }, [open]);

  const fetchArchivedChats = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get('/api/v1/conversations/show/archives', {
        params: {
          conversationSource: 'sales',
        },
      });
      setArchivedChats(response.data.conversations || []);
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to load archived conversations',
        severity: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnarchive = async (chatId: string) => {
    setIsUnarchiving(true);
    setUnarchivingId(chatId);
    try {
      await axiosInstance.patch(`/api/v1/conversations/${chatId}/unarchive`);
      setArchivedChats((prev) => prev.filter((chat) => chat._id !== chatId));
      onUnarchive?.();

      setSnackbar({
        open: true,
        message: 'Conversation unarchived successfully',
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to unarchive conversation',
        severity: 'error',
      });
    } finally {
      setIsUnarchiving(false);
      setUnarchivingId(null);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Fade}
        PaperProps={{
          elevation: 24,
          sx: {
            borderRadius: 2,
            maxHeight: '80vh',
            bgcolor: 'background.paper',
          },
        }}
      >
        <DialogTitle sx={{ px: 3, py: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Icon icon={archiveIcon} width={28} height={28} color={theme.palette.primary.main} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Archived Conversations
              </Typography>
            </Box>
            <IconButton
              onClick={onClose}
              size="small"
              sx={{
                color: 'text.secondary',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Icon icon={closeIcon} />
            </IconButton>
          </Box>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ p: 0 }}>
          {isLoading ? (
            <LoadingSkeleton />
          ) : archivedChats.length === 0 ? (
            <EmptyState />
          ) : (
            <List sx={{ p: 0 }}>
              {archivedChats.map((chat) => {
                // Get the last message content
                const lastMessage =
                  chat.messages && chat.messages.length > 0
                    ? chat.messages[chat.messages.length - 1].content
                    : 'No messages';

                return (
                  <ListItem
                    key={chat._id}
                    divider
                    disablePadding
                    secondaryAction={
                      <Tooltip title="Unarchive conversation">
                        <IconButton
                          // edge="end"
                          size="small"
                          onClick={() => handleUnarchive(chat._id)}
                          disabled={isUnarchiving}
                          sx={{
                            ml: 1,
                            color: 'primary.main',
                            '&:hover': { bgcolor: 'primary.lighter' },
                          }}
                        >
                          {isUnarchiving && unarchivingId === chat._id ? (
                            <CircularProgress size={20} color="inherit" />
                          ) : (
                            <Icon icon={archiveUpIcon} />
                          )}
                        </IconButton>
                      </Tooltip>
                    }
                  >
                    <ListItemButton
                      onClick={() => onSelectChat(chat)}
                      sx={{
                        py: 2,
                        px: 3,
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          bgcolor: 'action.hover',
                        },
                      }}
                    >
                      <Box sx={{ width: '100%' }}>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 0.5,
                          }}
                        >
                          <Typography
                            variant="subtitle1"
                            sx={{
                              fontWeight: 600,
                              color: 'text.primary',
                            }}
                          >
                            {chat.title || 'Untitled Conversation'}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              ml: 2,
                              px: 1,
                              py: 0.5,
                              borderRadius: 1,
                              bgcolor: 'action.hover',
                              color: 'text.secondary',
                            }}
                          >
                            {formatDistanceToNow(chat.createdAt)}
                          </Typography>
                        </Box>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            lineHeight: 1.5,
                          }}
                        >
                          {lastMessage}
                        </Typography>
                      </Box>
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          )}
        </DialogContent>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        TransitionComponent={Fade}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity as AlertColor}
          variant="filled"
          elevation={6}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ArchivedChatsDialog;
