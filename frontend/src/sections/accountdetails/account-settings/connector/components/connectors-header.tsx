import editIcon from '@iconify-icons/eva/edit-outline';
import linkIcon from '@iconify-icons/eva/link-2-outline';
import closeIcon from '@iconify-icons/eva/close-outline';
import checkmarkIcon from '@iconify-icons/eva/checkmark-outline';

import { Box, alpha, Button, useTheme, Typography } from '@mui/material';

import { Iconify } from 'src/components/iconify';

interface ConnectorsHeaderProps {
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
  handleSaveChanges: () => void;
  handleCancelEdit: () => void;
  isLoading: boolean;
}

const ConnectorsHeader = ({
  isEditing,
  setIsEditing,
  handleSaveChanges,
  handleCancelEdit,
  isLoading,
}: ConnectorsHeaderProps) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        p: 2,
        mb: 3,
        borderRadius: 1,
        bgcolor: alpha(theme.palette.primary.main, 0.04),
        borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'space-between',
        gap: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Iconify
          icon={linkIcon}
          width={20}
          height={20}
          sx={{ color: theme.palette.primary.main }}
        />
        <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
          Available Connectors
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 1 }}>
        {isEditing ? (
          <>
            <Button
              variant="outlined"
              color="inherit"
              onClick={handleCancelEdit}
              disabled={isLoading}
              startIcon={<Iconify icon={closeIcon} width={18} height={18} />}
              sx={{
                borderColor: alpha(theme.palette.text.primary, 0.2),
                color: theme.palette.text.primary,
                '&:hover': {
                  borderColor: alpha(theme.palette.text.primary, 0.3),
                  bgcolor: alpha(theme.palette.text.primary, 0.03),
                },
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSaveChanges}
              disabled={isLoading}
              startIcon={<Iconify icon={checkmarkIcon} width={18} height={18} />}
              sx={{
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: 'none',
                  bgcolor: theme.palette.primary.dark,
                },
              }}
            >
              Save Changes
            </Button>
          </>
        ) : (
          <Button
            variant="outlined"
            color="primary"
            onClick={() => setIsEditing(true)}
            disabled={isLoading}
            startIcon={<Iconify icon={editIcon} width={18} height={18} />}
            sx={{
              borderColor: theme.palette.primary.main,
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.04),
              },
            }}
          >
            Edit Connectors
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default ConnectorsHeader;
