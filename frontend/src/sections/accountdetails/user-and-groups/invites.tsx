import { Icon } from '@iconify/react';
import { useDispatch } from 'react-redux';
import React, { useState, useEffect } from 'react';

import {
  Box,
  Chip,
  Table,
  Paper,
  Alert,
  Button,
  TableRow,
  Snackbar,
  TableBody,
  TableCell,
  TableHead,
  TextField,
  Typography,
  TableContainer,
  TablePagination,
  CircularProgress,
} from '@mui/material';

import { usePermissions } from '../context/permission-context';
import { decrementInvitesCount } from '../../../store/userAndGroupsSlice';
import { removeUser, resendInvite, getAllUsersWithGroups } from '../context/utils';

import type { GroupUser } from '../types/group-details';
import type { SnackbarState } from '../types/organization-data';

export default function Invites() {
  const [users, setUsers] = useState<GroupUser[]>([]);
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(5);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'info',
  });

  const dispatch = useDispatch();
  const { isAdmin } = usePermissions();

  useEffect(() => {
    const fetchUsers = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const response: GroupUser[] = await getAllUsersWithGroups();
        const pendingUsers = response.filter((user) => !user.iamUser?.isEmailVerified);

        setUsers(pendingUsers);
      } catch (error) {
        setSnackbar({ open: true, message: error.errorMessage, severity: 'error' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const filteredUsers = users.filter((user) =>
    user.iamUser?.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleChangePage = (event: unknown, newPage: number): void => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleResendInvite = async (userId: string): Promise<void> => {
    try {
      await resendInvite(userId);
      setSnackbar({ open: true, message: 'Invite resent successfully', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: error.errorMessage, severity: 'error' });
    }
  };

  const handleRemoveUser = async (userId: string): Promise<void> => {
    try {
      await removeUser(userId);
      setUsers(users.filter((user) => user.iamUser?._id !== userId));
      dispatch(decrementInvitesCount());
      setSnackbar({ open: true, message: 'User removed successfully', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: error.errorMessage, severity: 'error' });
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const renderUserActions = (user: GroupUser): JSX.Element => {
    const userId = user.iamUser?._id;
    if (!userId) return <></>;

    return (
      <>
        <Button
          onClick={() => handleResendInvite(userId)}
          disabled={!isAdmin}
          sx={{
            '&.Mui-disabled': {
              cursor: 'not-allowed',
              pointerEvents: 'auto',
            },
            color: 'text.primary',
            backgroundColor: 'transparent',
            border: 'none',
            boxShadow: 'none',
            textTransform: 'none',
            fontWeight: 'normal',
            '&:hover': {
              backgroundColor: 'action.hover',
              border: 'none',
              boxShadow: 'none',
            },
            mr: 1,
          }}
        >
          Resend invite
        </Button>

        <Button
          onClick={() => handleRemoveUser(userId)}
          disabled={!isAdmin}
          sx={{
            '&.Mui-disabled': {
              cursor: 'not-allowed',
              pointerEvents: 'auto',
            },
            color: 'text.primary',
            backgroundColor: 'transparent',
            border: 'none',
            boxShadow: 'none',
            textTransform: 'none',
            fontWeight: 'normal',
            '&:hover': {
              backgroundColor: 'action.hover',
              border: 'none',
              boxShadow: 'none',
            },
          }}
        >
          Remove User
        </Button>
      </>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <TextField
          placeholder="Search by email"
          variant="outlined"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: <Icon icon="mdi:magnify" style={{ marginRight: '8px' }} />,
          }}
          sx={{ width: '40%' }}
        />
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650, mt: 3 }} aria-label="pending users table">
            <TableHead>
              <TableRow>
                <TableCell>NAME</TableCell>
                <TableCell>GROUPS</TableCell>
                <TableCell sx={{ pl: 10 }}>ACTIONS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((user) => (
                  <TableRow
                    key={user._id}
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    <TableCell component="th" scope="row">
                      <Box>
                        <Typography variant="subtitle1">{user.iamUser?.email}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Pending invitation
                        </Typography>
                      </Box>
                    </TableCell>

                    <TableCell>
                      {user.groups.map((group, index) => (
                        <Chip
                          key={index}
                          label={group.name}
                          sx={{
                            mr: 1,
                            mb: 1,
                            bgcolor: 'grey.100',
                            color: 'text.primary',
                            fontWeight: 'normal',
                            '& .MuiChip-label': {
                              padding: '2px 8px',
                            },
                            borderRadius: '4px',
                            height: '24px',
                          }}
                          variant="outlined"
                        />
                      ))}
                    </TableCell>
                    <TableCell>{renderUserActions(user)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <TablePagination
        component="div"
        count={filteredUsers.length}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
