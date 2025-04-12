import type { Conversation } from 'src/types/chat-bot';
import type {
  SnackbarState,
  ChatSidebarProps,
  ConversationGroup,
  DeleteDialogState,
  ConversationsResponse,
} from 'src/types/chat-sidebar';

import { Icon } from '@iconify/react';
import editIcon from '@iconify-icons/mdi/edit';
import menuIcon from '@iconify-icons/mdi/menu';
import checkIcon from '@iconify-icons/mdi/check';
import closeIcon from '@iconify-icons/mdi/close';
import shareIcon from '@iconify-icons/mdi/share';
import deleteIcon from '@iconify-icons/mdi/delete';
import chatIcon from '@iconify-icons/mdi/chat-outline';
import dotsIcon from '@iconify-icons/mdi/dots-vertical';
import archiveIcon from '@iconify-icons/mdi/archive-outline';
import messageIcon from '@iconify-icons/mdi/message-outline';
import React, { useMemo, useState, useEffect, useCallback } from 'react';

import {
  Box,
  List,
  Menu,
  Alert,
  Tooltip,
  ListItem,
  MenuItem,
  Snackbar,
  TextField,
  Typography,
  IconButton,
  ListItemButton,
  CircularProgress,
} from '@mui/material';

import axiosInstance from 'src/utils/axios';

import ArchivedChatsDialog from './dialogs/archieve-chat-dialog';
import scrollableContainerStyle from '../utils/styles/scrollbar';
import ShareConversationDialog from './dialogs/share-conversation-dialog';
import DeleteConversationDialog from './dialogs/delete-conversation-dialog';

const ChatSidebar = ({
  onClose,
  onChatSelect,
  onNewChat,
  selectedId,
  shouldRefresh,
  onRefreshComplete,
}: ChatSidebarProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [selectedChat, setSelectedChat] = useState<Conversation | null>(null);
  const [editingChat, setEditingChat] = useState<Conversation | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({ open: false, chat: null });
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState<boolean>(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  // const [sharedConversations, setSharedConversations] = useState([]);
  const [activeTab, setActiveTab] = useState<'my' | 'shared'>('my');
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });

  const [archiveDialogOpen, setArchiveDialogOpen] = useState<boolean>(false);

  const fetchConversations = useCallback(async (pageNum: number): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get<ConversationsResponse>('/api/v1/conversations/', {
        // params: {
        //   page: pageNum,
        //   limit: 20,
        //   shared: activeTab === 'shared'
        // },
      });

      const {
        conversations: newConversations = [],
        pagination = {
          page: 1,
          limit: 20,
          totalCount: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      } = response.data;

      if (pageNum === 1) {
        setConversations(newConversations);
      } else {
        setConversations((prev) => [...prev, ...newConversations]);
      }

      setHasMore(pagination.hasNextPage || false);
      setPage(pageNum);
    } catch (error) {
      setHasMore(false);
      setSnackbar({
        open: true,
        message: 'Failed to fetch conversations',
        severity: 'error',
      });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (shouldRefresh) {
      fetchConversations(1).then(() => {
        onRefreshComplete?.();
      });
    }
  }, [shouldRefresh, fetchConversations, onRefreshComplete]);

  // Menu handling
  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>, chat: Conversation): void => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setSelectedChat(chat);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedChat(null);
  };

  // Grouped conversations logic
  const groupedConversations = useMemo(() => {
    const groups: ConversationGroup = {
      Today: [],
      Yesterday: [],
      'Previous 7 days': [],
      'Previous 30 days': [],
      Older: [],
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    conversations.forEach((chat) => {
      const chatDate = new Date(chat.lastActivityAt || chat.createdAt);

      if (chatDate >= today) {
        groups.Today.push(chat);
      } else if (chatDate >= yesterday) {
        groups.Yesterday.push(chat);
      } else if (chatDate >= weekAgo) {
        groups['Previous 7 days'].push(chat);
      } else if (chatDate >= monthAgo) {
        groups['Previous 30 days'].push(chat);
      } else {
        groups.Older.push(chat);
      }
    });

    // Return only groups that have conversations
    return Object.fromEntries(Object.entries(groups).filter(([_, chats]) => chats.length > 0));
  }, [conversations]);

  // const memoizedConversations = useMemo(() => conversations, [conversations]);

  useEffect(() => {
    setPage(1);
    fetchConversations(1);
  }, [fetchConversations, activeTab]);

  const handleListItemClick = (chat: Conversation): void => {
    onChatSelect?.(chat);
  };

  const handleNewChat = (): void => {
    handleMenuClose();
    onNewChat?.();
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const target = e.target as HTMLDivElement;
    const bottom = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 1;

    if (bottom && hasMore && !isLoading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchConversations(nextPage);
    }
  };

  const handleEditStart = (chat: Conversation): void => {
    setEditingChat(chat);
    setEditTitle(chat.title || '');
    handleMenuClose();
  };

  const handleEditCancel = (): void => {
    setEditingChat(null);
    setEditTitle('');
  };

  const handleEditSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!editingChat || !editTitle.trim()) return;

    try {
      await axiosInstance.patch(`/api/v1/conversations/${editingChat._id}/title`, {
        title: editTitle.trim(),
      });

      setConversations((prev) =>
        prev.map((chat) =>
          chat._id === editingChat._id ? { ...chat, title: editTitle.trim() } : chat
        )
      );

      setSnackbar({
        open: true,
        message: 'Conversation renamed successfully',
        severity: 'success',
      });
      handleEditCancel();
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to rename conversation',
        severity: 'error',
      });
    }
  };

  const handleDeleteClick = (chat: Conversation): void => {
    setDeleteDialog({ open: true, chat });
    handleMenuClose();
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deleteDialog.chat) return;
    setIsDeleting(true);

    try {
      await axiosInstance.delete(`/api/v1/conversations/${deleteDialog.chat._id}`);

      setConversations((prev) => prev.filter((chat) => chat._id !== deleteDialog.chat?._id));

      if (selectedId === deleteDialog.chat._id) {
        onNewChat?.();
      }

      setSnackbar({
        open: true,
        message: 'Conversation deleted successfully',
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to delete conversation',
        severity: 'error',
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialog({ open: false, chat: null });
    }
  };

  const renderChatItem = (chat: Conversation) => (
    <ListItem
      key={chat._id}
      disablePadding
      secondaryAction={
        editingChat?._id !== chat._id && (
          <IconButton edge="end" size="small" onClick={(e) => handleMenuOpen(e, chat)}>
            <Icon icon={dotsIcon} />
          </IconButton>
        )
      }
    >
      {editingChat?._id === chat._id ? (
        <Box
          component="form"
          onSubmit={handleEditSubmit}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            width: '100%',
            px: 1,
          }}
        >
          <TextField
            size="small"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            autoFocus
            fullWidth
            variant="outlined"
            placeholder="Enter conversation title"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 1,
              },
            }}
          />
          <IconButton size="small" color="primary" type="submit" disabled={!editTitle.trim()}>
            <Icon icon={checkIcon} />
          </IconButton>
          <IconButton size="small" onClick={handleEditCancel}>
            <Icon icon={closeIcon} />
          </IconButton>
        </Box>
      ) : (
        <ListItemButton
          selected={selectedId === chat._id}
          onClick={() => handleListItemClick(chat)}
          sx={{
            borderRadius: 1,
            py: 1,
            '&.Mui-selected': {
              bgcolor: 'action.selected',
            },
            '&:hover': {
              bgcolor: 'action.hover',
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Icon icon={messageIcon} />
            <Typography
              variant="body2"
              noWrap
              sx={{
                flex: 1,
                color: 'text.primary',
              }}
            >
              {chat.title || 'New conversation'}
            </Typography>
          </Box>
        </ListItemButton>
      )}
    </ListItem>
  );

  const handleArchive = async (chat: Conversation): Promise<void> => {
    try {
      await axiosInstance.patch(`/api/v1/conversations/${chat._id}/archive`);
      await fetchConversations(1); // Refresh conversations after archiving
      handleMenuClose();
      onNewChat?.();
      setSnackbar({
        open: true,
        message: 'Conversation archived successfully',
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to archive conversation',
        severity: 'error',
      });
    }
  };

  const handleUnarchive = useCallback(async (): Promise<void> => {
    await fetchConversations(1); // Refresh conversations after unarchiving
  }, [fetchConversations]);

  const handleShareConversation = (conversationId: string): void => {
    setSelectedConversationId(conversationId);
    setIsShareDialogOpen(true);
  };

  const handleShareDialogClose = (): void => {
    setIsShareDialogOpen(false);
    setSelectedConversationId(null);
  };

  // Update menu items
  const menuItems = [
    {
      icon: editIcon,
      label: 'Rename',
      onClick: () => selectedChat && handleEditStart(selectedChat),
      show: activeTab === 'my',
    },
    {
      icon: archiveIcon,
      label: 'Archive',
      onClick: () => selectedChat && handleArchive(selectedChat),
      show: activeTab === 'my',
    },
    {
      icon: deleteIcon,
      label: 'Delete',
      onClick: () => selectedChat && handleDeleteClick(selectedChat),
      color: 'error',
      show: activeTab === 'my',
    },
    {
      icon: shareIcon,
      label: 'Share',
      onClick: () => selectedChat && handleShareConversation(selectedChat._id),
      color: 'error',
      show: activeTab === 'my',
    },
  ];

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        ...scrollableContainerStyle,
      }}
    >
      {/* Header */}
      <Box sx={{ p: 1.68, display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton size="small" onClick={onClose}>
          <Icon icon={menuIcon} />
        </IconButton>
        <Typography variant="h6" sx={{ flex: 1 }}>
          PipesHub Agent
        </Typography>
        {activeTab === 'my' && (
          <>
            <Tooltip title="Archived Chats">
              <IconButton size="small" onClick={() => setArchiveDialogOpen(true)}>
                <Icon icon={archiveIcon} />
              </IconButton>
            </Tooltip>
            <Tooltip title="New Chat">
              <IconButton size="small" onClick={handleNewChat}>
                <Icon icon={chatIcon}  />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>
      <Box>
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Box
            onClick={() => setActiveTab('my')}
            sx={{
              py: 1,
              px: 2,
              cursor: 'pointer',
              borderBottom: 2,
              borderColor: activeTab === 'my' ? 'primary.main' : 'transparent',
              color: activeTab === 'my' ? 'primary.main' : 'text.secondary',
              '&:hover': {
                color: 'primary.main',
              },
              transition: 'all 0.2s',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: activeTab === 'my' ? 600 : 400 }}>
              My Conversations
            </Typography>
          </Box>
          <Box
            onClick={() => setActiveTab('shared')}
            sx={{
              py: 1,
              px: 2,
              cursor: 'pointer',
              borderBottom: 2,
              borderColor: activeTab === 'shared' ? 'primary.main' : 'transparent',
              color: activeTab === 'shared' ? 'primary.main' : 'text.secondary',
              '&:hover': {
                color: 'primary.main',
              },
              transition: 'all 0.2s',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: activeTab === 'shared' ? 600 : 400 }}>
              Shared with Me
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* New Chat Button */}
      {/* <Box sx={{ p: 2 }}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<Icon icon="mdi:plus" />}
          onClick={handleNewChat}
          sx={{
            justifyContent: 'flex-start',
            color: 'text.primary',
            borderColor: 'divider',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'action.hover',
            },
          }}
        >
          New chat
        </Button>
      </Box> */}

      {/* <Divider sx={{ my: 1 }} /> */}

      {/* Conversations List */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          px: 1,
        }}
        onScroll={handleScroll}
      >
        {Object.entries(groupedConversations).map(([group, chats]) => (
          <React.Fragment key={group}>
            <Typography
              variant="caption"
              sx={{
                px: 2,
                py: 1,
                display: 'block',
                color: 'text.secondary',
                fontWeight: 500,
              }}
            >
              {group}
            </Typography>
            <List dense disablePadding>
              {chats.map((chat) => renderChatItem(chat))}
            </List>
          </React.Fragment>
        ))}

        {isLoading && (
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress size={24} />
          </Box>
        )}
      </Box>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {menuItems.map((item) => (
          <MenuItem key={item.label} onClick={item.onClick} sx={{ gap: 1 }}>
            <Icon icon={item.icon} />
            {item.label}
          </MenuItem>
        ))}
      </Menu>

      {/* Delete Dialog */}
      <DeleteConversationDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, chat: null })}
        onConfirm={handleDeleteConfirm}
        title={deleteDialog.chat?.title}
        isDeleting={isDeleting}
      />
      <ArchivedChatsDialog
        open={archiveDialogOpen}
        onClose={() => setArchiveDialogOpen(false)}
        onUnarchive={handleUnarchive}
        onSelectChat={onChatSelect}
      />

      <ShareConversationDialog
        open={isShareDialogOpen}
        onClose={handleShareDialogClose}
        conversationId={selectedConversationId}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
          elevation={6}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ChatSidebar;
