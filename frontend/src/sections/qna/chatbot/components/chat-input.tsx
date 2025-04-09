import React from 'react';
import { Icon } from '@iconify/react';
import sendIcon from '@iconify-icons/mdi/send';

import { Box, Paper, TextField, IconButton } from '@mui/material';

type ChatInputProps = {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => Promise<void>;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
};

const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSubmit,
  isLoading,
  disabled,
  placeholder,
}) => {
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isLoading) {
        onSubmit();
      }
    }
  };

  return (
    <Box sx={{ p: 1.5, borderColor: 'divider', width: '70%', mx: 'auto' }}>
      <Paper
        elevation={3}
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: '8px 16px',
          borderRadius: 4,
        }}
      >
        <TextField
          fullWidth
          placeholder="Type your message..."
          variant="standard"
          InputProps={{
            disableUnderline: true,
          }}
          sx={{ mx: 2 }}
          value={value}
          onChange={onChange}
          onKeyPress={handleKeyPress}
          multiline
          maxRows={4}
        />

        <IconButton
          color="primary"
          onClick={onSubmit}
          disabled={!value.trim() || isLoading}
          size="small"
        >
          <Icon icon={sendIcon} />
        </IconButton>
      </Paper>
    </Box>
  );
};

export default ChatInput;
