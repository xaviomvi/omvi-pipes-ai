import { Icon } from '@iconify/react';
import menuIcon from '@iconify-icons/mdi/menu';
import refreshIcon from '@iconify-icons/mdi/refresh';
import chatIcon from '@iconify-icons/mdi/chat-outline';
import dotsIcon from '@iconify-icons/mdi/dots-vertical';
import fileSearchIcon from '@iconify-icons/mdi/file-search-outline';
import React, { useMemo, useState, useEffect, useCallback } from 'react';

import {
  Box,
  List,
  Menu,
  Alert,
  styled,
  Divider,
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

import scrollableContainerStyle from '../qna/utils/styles/scrollbar';

import type { SnackbarState } from '../accountdetails/types/organization-data';
import type { ConversationRecord, RecordSidebarProps } from './types/records-ask-me-anything';

const DRAWER_WIDTH = 350;

const SidebarHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  borderBottom: `1px solid ${theme.palette.divider}`,
  minHeight: 64,
  backgroundColor: theme.palette.background.paper,
}));

const SearchField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    backgroundColor: theme.palette.background.neutral,
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    '& fieldset': {
      borderColor: 'transparent',
    },
    '&:hover fieldset': {
      borderColor: theme.palette.primary.main,
    },
    '&.Mui-focused fieldset': {
      borderColor: theme.palette.primary.main,
    },
  },
}));

const formatDate = (dateString: string | undefined) => {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date >= today) {
    return `Today at ${date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  if (date >= yesterday) {
    return `Yesterday at ${date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  return date.toLocaleDateString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const RecordSidebar = ({
  onClose,
  onRecordSelect,
  selectedRecordId,
  recordType,
  initialRecord,
  onRefreshComplete,
  shouldRefresh,
  onNewChat,
  recordId,
}: RecordSidebarProps) => {
  const [records, setRecords] = useState<ConversationRecord[]>([]);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState<ConversationRecord | null>(null);
  const [lastFetchedId, setLastFetchedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Memoized fetch function
  const fetchRecords = useCallback(
    async (pageNum: number, forceRefresh = false) => {
      if (!recordId) return;

      // Skip if we've already fetched for this recordId and it's not a force refresh
      if (!forceRefresh && lastFetchedId === recordId && pageNum === 1) {
        return;
      }

      setIsLoading(true);
      try {
        const response = await axiosInstance.get('/api/v1/conversations/', {
          params: {
            page: pageNum,
            conversationSource: 'records',
            limit: 20,
            recordIds: [recordId],
            conversationSourceRecordId: recordId,
          },
        });

        const { conversations = [], pagination = {} } = response.data;

        if (pageNum === 1) {
          setRecords(conversations);
          setLastFetchedId(recordId);
        } else {
          setRecords((prev) => [...prev, ...conversations]);
        }

        setHasMore(pagination.hasNextPage || false);
        setPage(pageNum);
      } catch (error) {
        setHasMore(false);
        // setSnackbar({
        //   open: true,
        //   message: 'Failed to fetch conversations',
        //   severity: 'error',
        // });
      } finally {
        setIsLoading(false);
      }
    },
    [recordId, lastFetchedId]
  );

  // Initial fetch effect
  useEffect(() => {
    if (recordId && recordId !== lastFetchedId) {
      setPage(1);
      fetchRecords(1);
    }
  }, [recordId, lastFetchedId, fetchRecords]);

  // Refresh effect
  useEffect(() => {
    if (shouldRefresh) {
      fetchRecords(1, true);
      onRefreshComplete?.();
    }
  }, [shouldRefresh, fetchRecords, onRefreshComplete]);

  const handleNewChatClick = useCallback(() => {
    if (onNewChat) {
      onNewChat();
    } else {
      onRecordSelect({
        ...initialRecord,
        conversationSource: 'records',
      });
    }
  }, [onNewChat, onRecordSelect, initialRecord]);

  const handleRefresh = useCallback(() => {
    fetchRecords(1, true);
  }, [fetchRecords]);

  const handleSearchChange = useCallback((e: any) => {
    setSearchQuery(e.target.value);
    setPage(1);
  }, []);

  // Memoized filtered records
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const query = searchQuery.toLowerCase();
    return records.filter((record) => record.title?.toLowerCase().includes(query));
  }, [records, searchQuery]);

  // Memoized grouped records
  const groupedRecords = useMemo(() => {
    const groups: { [key: string]: ConversationRecord[] } = {
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

    filteredRecords.forEach((record: ConversationRecord) => {
      const recordDate = new Date(record.createdAt);

      if (recordDate >= today) {
        groups.Today.push(record);
      } else if (recordDate >= yesterday) {
        groups.Yesterday.push(record);
      } else if (recordDate >= weekAgo) {
        groups['Previous 7 days'].push(record);
      } else if (recordDate >= monthAgo) {
        groups['Previous 30 days'].push(record);
      } else {
        groups.Older.push(record);
      }
    });

    return Object.fromEntries(Object.entries(groups).filter(([_, recs]) => recs.length > 0));
  }, [filteredRecords]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement;
      const bottom = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 1;

      if (bottom && hasMore && !isLoading) {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchRecords(nextPage);
      }
    },
    [hasMore, isLoading, page, fetchRecords]
  );

  const handleListItemClick = useCallback(
    (record: ConversationRecord) => {
      if (record) {
        onRecordSelect?.(record);
      }
    },
    [onRecordSelect]
  );

  const handleMenuOpen = useCallback((event: any, record: ConversationRecord) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setSelectedRecord(record);
  }, []);

  const handleMenuClose = useCallback(() => {
    setMenuAnchor(null);
    setSelectedRecord(null);
  }, []);

  return (
    <Box
      sx={{
        width: DRAWER_WIDTH,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.paper',
        borderRight: '1px solid',
        borderRightColor: 'divider',
        ...scrollableContainerStyle,
      }}
    >
      <SidebarHeader>
        <IconButton
          size="small"
          onClick={onClose}
          sx={{
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          }}
        >
          <Icon icon={menuIcon} />
        </IconButton>
        <Typography variant="h6" sx={{ flex: 1, fontWeight: 600 }}>
          Conversations
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="New Chat">
            <IconButton
              size="small"
              onClick={handleNewChatClick}
              sx={{
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <Icon icon={chatIcon} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh">
            <IconButton
              size="small"
              onClick={handleRefresh}
              sx={{
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <Icon icon={refreshIcon} />
            </IconButton>
          </Tooltip>
        </Box>
      </SidebarHeader>
      <Divider />
      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          px: 1,
        }}
        onScroll={handleScroll}
      >
        {Object.entries(groupedRecords).map(([group, groupRecords]) => (
          <React.Fragment key={group}>
            <Typography
              variant="caption"
              sx={{
                px: 2,
                py: 1.5,
                display: 'block',
                color: 'text.secondary',
                fontWeight: 600,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                fontSize: '0.75rem',
              }}
            >
              {group}
            </Typography>
            <List dense disablePadding>
              {groupRecords.map((record) => (
                <ListItem
                  key={record._id}
                  disablePadding
                  secondaryAction={
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={(e) => handleMenuOpen(e, record)}
                      sx={{
                        opacity: 0,
                        transition: 'opacity 0.2s',
                        '.MuiListItemButton-root:hover &': {
                          opacity: 1,
                        },
                      }}
                    >
                      <Icon icon={dotsIcon} />
                    </IconButton>
                  }
                >
                  <ListItemButton
                    selected={selectedRecordId === record._id}
                    onClick={() => handleListItemClick(record)}
                    sx={{
                      borderRadius: 1,
                      py: 1.5,
                      px: 2,
                      '&.Mui-selected': {
                        backgroundColor: 'primary.lighter',
                        '&:hover': {
                          backgroundColor: 'primary.lighter',
                        },
                      },
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Icon
                          icon={chatIcon}
                          style={{
                            color:
                              selectedRecordId === record._id ? 'primary.main' : 'text.secondary',
                          }}
                        />
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{
                            flex: 1,
                            color:
                              selectedRecordId === record._id ? 'primary.main' : 'text.primary',
                            fontWeight: 500,
                          }}
                        >
                          {record.title || 'Untitled Conversation'}
                        </Typography>
                      </Box>
                      <Typography
                        variant="caption"
                        noWrap
                        sx={{
                          color: 'text.secondary',
                          pl: 3.5,
                        }}
                      >
                        {formatDate(record.lastActivityAt)}
                      </Typography>
                    </Box>
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </React.Fragment>
        ))}

        {isLoading && (
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress size={24} />
          </Box>
        )}

        {!isLoading && records.length === 0 && (
          <Box
            sx={{
              p: 3,
              textAlign: 'center',
              color: 'text.secondary',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Icon icon={fileSearchIcon} width={40} height={40} />
            <Typography>No conversations found</Typography>
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
        <MenuItem
          onClick={() => {
            handleMenuClose();
            if (selectedRecord) {
              handleListItemClick(selectedRecord);
            }
          }}
        >
          <Icon icon={chatIcon} style={{ marginRight: 8 }} />
          Open Conversation
        </MenuItem>
      </Menu>
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
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default RecordSidebar;
