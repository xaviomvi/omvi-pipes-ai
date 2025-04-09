import type { ChatHeaderProps } from 'src/types/chat-bot';

import React from 'react';
import { Icon } from '@iconify/react';
import menuIcon from '@iconify-icons/mdi/menu';

import { Box, Typography, IconButton } from '@mui/material';

const ChatHeader = ({ isDrawerOpen, onDrawerOpen }: ChatHeaderProps) => (
  <Box
    sx={{
      p: 2,
      display: 'flex',
      alignItems: 'center',
      borderBottom: 1,
      borderColor: 'divider',
      bgcolor: 'background.paper',
      minHeight: 64,
    }}
  >
    {!isDrawerOpen && (
      <IconButton
        onClick={onDrawerOpen}
        sx={{
          mr: 2,
          color: 'text.secondary',
          transition: 'transform 0.2s ease',
          '&:hover': {
            transform: 'scale(1.1)',
            color: 'primary.main',
          },
        }}
        size="small"
      >
        <Icon icon={menuIcon} />
      </IconButton>
    )}
    <Typography variant="h6">AI Assistant</Typography>
  </Box>
);

export default ChatHeader;
