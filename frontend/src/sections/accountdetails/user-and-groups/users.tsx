import { Icon } from '@iconify/react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import React, { useRef, useState, useEffect } from 'react';
 
import {
  Box,
  Chip,
  Menu,
  Table,
  Paper,
  Alert,
  Avatar,
  Button,
  Dialog,
  Popover,
  TableRow,
  Snackbar,
  MenuItem,
  TableBody,
  TableCell,
  TableHead,
  TextField,
  Typography,
  IconButton,
  DialogTitle,
  Autocomplete,
  DialogContent,
  DialogActions,
  TableContainer,
  TablePagination,
  CircularProgress,
} from '@mui/material';

import { usePermissions } from '../context/permission-context';
import { updateInvitesCount } from '../../../store/userAndGroupsSlice';
import {
  allGroups,
  removeUser,
  inviteUsers,
  addUsersToGroups,
  getUserIdFromToken,
  getAllUsersWithGroups,
} from '../context/utils';

import type { SnackbarState } from '../types/organization-data';
import type { AppUser, GroupUser, AppUserGroup, AddUserModalProps } from '../types/group-details';

interface AddUsersToGroupsModalProps {
  open: boolean;
  onClose: () => void;
  onUsersAdded: () => void;
  allUsers: GroupUser[] | null;
  groups: AppUserGroup[];
}

const Users = () =>{
  const [users, setUsers] = useState<GroupUser[]>([]);
  const [groups, setGroups] = useState<AppUserGroup[]>([]);
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(5);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState<boolean>(false);
  const [isAddUsersToGroupsModalOpen, setIsAddUsersToGroupsModalOpen] = useState<boolean>(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedUser, setSelectedUser] = useState<GroupUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);
  const [snackbarState, setSnackbarState] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });

  const navigate = useNavigate();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dispatch = useDispatch();
  const { isAdmin } = usePermissions();

  const handleSnackbarClose = () => {
    setSnackbarState({ ...snackbarState, open: false });
  };

  useEffect(() => {
    const fetchUsersAndGroups = async () => {
      setLoading(true);
      try {
        const orgId = await getUserIdFromToken();
        setUserId(orgId);
        const response = await getAllUsersWithGroups();
        const groupsData = await allGroups();
        const loggedInUsers = response.filter((user) => user.iamUser?.isEmailVerified === true);
        setUsers(loggedInUsers);
        setGroups(groupsData);
      } catch (error) {
        console.error('Error fetching users and groups:', error);
        setSnackbarState({ open: true, message: error.errorMessage, severity: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchUsersAndGroups();
  }, []);

  const filteredUsers = users
    .filter((user) => user.iamUser?.fullName)
    .filter((user) => user.iamUser?.fullName.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleAddUser = () => {
    setIsAddUserModalOpen(true);
  };

  const handleCloseAddUserModal = () => {
    setIsAddUserModalOpen(false);
  };

  const handleAddUsersToGroups = () => {
    setIsAddUsersToGroupsModalOpen(true);
  };

  const handleCloseAddUsersToGroupsModal = () => {
    setIsAddUsersToGroupsModalOpen(false);
  };

  const handleDeleteUser = async (deleteUserId: string): Promise<void> => {
    try {
      await removeUser(deleteUserId);
      const updatedUsers = await getAllUsersWithGroups();

      const loggedInUsers = updatedUsers.filter((user) => user.iamUser?.isEmailVerified === true);
      setUsers(loggedInUsers);
      setSnackbarState({ open: true, message: 'User removed successfully', severity: 'success' });
    } catch (error) {
      console.error('Error removing user:', error);
      setSnackbarState({ open: true, message: error.errorMessage, severity: 'error' });
    }
  };

  const handlePopoverOpen = (event: React.MouseEvent<HTMLElement>, user: GroupUser): void => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setAnchorEl(event.currentTarget);
    setSelectedUser(user);
  };

  const handlePopoverClose = () => {
    timeoutRef.current = setTimeout(() => {
      setAnchorEl(null);
      setSelectedUser(null);
    }, 300);
  };

  const handleUsersAdded = async () => {
    try {
      const updatedUsers = await getAllUsersWithGroups();

      const loggedInUsers = updatedUsers.filter((user) => user.iamUser?.isEmailVerified === true);
      setUsers(loggedInUsers);
      setSnackbarState({
        open: true,
        message: 'Users added to groups successfully',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error updating users after addition to groups:', error);
      setSnackbarState({ open: true, message: error.errorMessage, severity: 'error' });
    }
  };
  const handleUsersInvited = async () => {
    try {
      const updatedUsers = await getAllUsersWithGroups();

      const loggedInUsers = updatedUsers.filter((user) => user.iamUser?.isEmailVerified === true);
      setUsers(loggedInUsers);
      setSnackbarState({
        open: true,
        message: 'Users invited successfully',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error updating users after addition to groups:', error);
      setSnackbarState({ open: true, message: error.errorMessage, severity: 'error' });
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, user: GroupUser) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedUser(user);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const handleRemoveUser = () => {
    if (selectedUser) {
      setIsConfirmDialogOpen(true);
    }
    handleMenuClose();
  };

  const handleConfirmRemoveUser = () => {
    if (selectedUser && selectedUser.iamUser) {
      handleDeleteUser(selectedUser.iamUser._id);
    }
    setIsConfirmDialogOpen(false);
  };

  const open = Boolean(anchorEl);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <TextField
          placeholder="Search by user name"
          variant="outlined"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: <Icon icon="mdi:magnify" style={{ marginRight: '8px' }} />,
          }}
          sx={{ width: '40%' }}
        />
        <Box>
          <Button
            variant="contained"
            color="primary"
            sx={{ mr: 2 }}
            onClick={handleAddUsersToGroups}
          >
            Add User to Group
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Icon icon="mdi:plus" />}
            onClick={handleAddUser}
          >
            Invite User
          </Button>
        </Box>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" sx={{ height: 300 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650, mt: 3 }} aria-label="users table">
            <TableHead>
              <TableRow>
                <TableCell>NAME</TableCell>
                <TableCell>GROUPS</TableCell>
                <TableCell>ACTIONS</TableCell>
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
                      {user.iamUser && (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar
                            sx={{ mr: 2, bgcolor: 'primary.main' }}
                            onMouseEnter={(e) => handlePopoverOpen(e, user)}
                            onMouseLeave={handlePopoverClose}
                          >
                            {user.iamUser.fullName
                              .split(' ')
                              .map((n) => n[0])
                              .join('')}
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle1">{user.iamUser.fullName}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {user.iamUser.email}
                            </Typography>
                          </Box>
                        </Box>
                      )}
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
                    <TableCell>
                      <IconButton onClick={(e) => handleMenuOpen(e, user)}>
                        <Icon icon="mdi:dots-vertical" />
                      </IconButton>
                    </TableCell>
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

      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem
          disabled={!isAdmin}
          sx={{
            '&.Mui-disabled': {
              cursor: 'not-allowed',
              pointerEvents: 'auto',
            },
          }}
          onClick={handleRemoveUser}
        >
          Remove User
        </MenuItem>
      </Menu>

      <Popover
        id="mouse-over-popover"
        sx={{ pointerEvents: 'none' }}
        open={open}
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        onClose={handlePopoverClose}
        disableRestoreFocus
        PaperProps={{
          onMouseEnter: () => {
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
            }
          },
          onMouseLeave: handlePopoverClose,
          sx: { pointerEvents: 'auto' },
        }}
      >
        {selectedUser && selectedUser.iamUser && (
          <Box sx={{ p: 2, maxWidth: 300 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Avatar sx={{ mr: 2, bgcolor: 'primary.main', width: 56, height: 56 }}>
                {selectedUser.iamUser &&
                  selectedUser.iamUser.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
              </Avatar>
              <Box>
                <Typography variant="h6">{selectedUser.iamUser.fullName}</Typography>
                {/* <Typography variant="body2" color="text.secondary">
                  Active {selectedUser.iamUser.lastActive}
                </Typography> */}
              </Box>
            </Box>
            {/* <Typography variant="body2" paragraph>
              {selectedUser.iamUser.jobTitle}
            </Typography> */}
            <Typography variant="body2" paragraph>
              {selectedUser.iamUser.email}
            </Typography>
            <Button
              variant="outlined"
              onClick={() => {
                if (selectedUser.iamUser) {
                  if (selectedUser.iamUser._id === userId) {
                    navigate('/account/company-settings/personal-profile');
                  } else {
                    navigate(`/account/company-settings/user-profile/${selectedUser.iamUser._id}`);
                  }
                }
              }}
            >
              Edit profile
            </Button>
          </Box>
        )}
      </Popover>

      <Dialog
        open={isConfirmDialogOpen}
        onClose={() => setIsConfirmDialogOpen(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">Confirm User Removal</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to remove the user ?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsConfirmDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmRemoveUser} autoFocus>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbarState.open} autoHideDuration={6000} onClose={handleSnackbarClose}>
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbarState.severity}
          sx={{ width: '100%' }}
        >
          {snackbarState.message}
        </Alert>
      </Snackbar>

      <AddUserModal
        open={isAddUserModalOpen}
        onClose={handleCloseAddUserModal}
        groups={groups}
        onUsersAdded={handleUsersInvited}
      />

      <AddUsersToGroupsModal
        open={isAddUsersToGroupsModalOpen}
        onClose={handleCloseAddUsersToGroupsModal}
        onUsersAdded={handleUsersAdded}
        allUsers={users}
        groups={groups}
      />
    </Box>
  );
}

function AddUserModal({ open, onClose, groups, onUsersAdded }: AddUserModalProps) {
  const [emails, setEmails] = useState<string>('');
  const [selectedGroups, setSelectedGroups] = useState<AppUserGroup[]>([]);
  const [snackbarState, setSnackbarState] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });
  const dispatch = useDispatch();

  const handleSnackbarClose = () => {
    setSnackbarState({ ...snackbarState, open: false });
  };

  const handleAddUsers = async (): Promise<void> => {
    try {
      const emailList = emails.split(',').map((email) => email.trim());

      const groupIds = selectedGroups.map((group) => group._id);
      await inviteUsers({ emails: emailList, groupIds });
      dispatch(updateInvitesCount(emailList.length));
      setSnackbarState({ open: true, message: 'Users added successfully', severity: 'success' });

      onUsersAdded();
      onClose();
    } catch (error) {
      console.error('Error inviting users:', error);
      setSnackbarState({ open: true, message: error.errorMessage, severity: 'error' });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Invite users to angewy</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label="Email addresses*"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="name0@angewy.com, name1@gmail.com, name2@hyderab..."
            multiline
            rows={2}
            sx={{ mb: 2 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Your team members will receive an email that grants them access to Pipeshub.
          </Typography>
          <Autocomplete
            multiple
            options={groups}
            getOptionLabel={(option) => option.name}
            renderInput={(params) => <TextField {...params} label="Add to groups" />}
            onChange={(event, newValue) => setSelectedGroups(newValue)}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            New users will inherit the permissions given to the selected groups.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleAddUsers} variant="contained" color="primary">
          Invite
        </Button>
      </DialogActions>
      <Snackbar open={snackbarState.open} autoHideDuration={6000} onClose={handleSnackbarClose}>
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbarState.severity}
          sx={{ width: '100%' }}
        >
          {snackbarState.message}
        </Alert>
      </Snackbar>
    </Dialog>
  );
}

function AddUsersToGroupsModal({
  open,
  onClose,
  onUsersAdded,
  allUsers,
  groups,
}: AddUsersToGroupsModalProps) {
  const [selectedUsers, setSelectedUsers] = useState<GroupUser[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<AppUserGroup[]>([]);
  const [snackbarState, setSnackbarState] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });

  const handleSnackbarClose = () => {
    setSnackbarState({ ...snackbarState, open: false });
  };

  const handleAddUsersToGroups = async () => {
    try {
      const userIds = selectedUsers
        .filter((user): user is GroupUser & { iamUser: AppUser } => user.iamUser !== null)
        .map((user) => user.iamUser._id);
      const groupIds = selectedGroups.map((group) => group._id);
      await addUsersToGroups({ userIds, groupIds });
      setSnackbarState({
        open: true,
        message: 'Users added to groups succesfully',
        severity: 'success',
      });

      onUsersAdded();
      onClose();
    } catch (error) {
      console.error('Error adding users to groups:', error);
      setSnackbarState({ open: true, message: error.errorMessage, severity: 'error' });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Users to Groups</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {allUsers && (
            <Autocomplete<GroupUser, true>
              multiple
              options={allUsers.filter((user) => Boolean(user.iamUser?.fullName))}
              getOptionLabel={(option) => {
                if (!option.iamUser) return 'Unknown User';
                return option.iamUser.fullName;
              }}
              renderInput={(params) => <TextField {...params} label="Select Users" />}
              onChange={(_event, newValue) => setSelectedUsers(newValue)}
              sx={{ mb: 2 }}
            />
          )}
          <Autocomplete
            multiple
            options={groups}
            getOptionLabel={(option) => option.name}
            renderInput={(params) => <TextField {...params} label="Select Groups" />}
            onChange={(event, newValue) => setSelectedGroups(newValue)}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleAddUsersToGroups} variant="contained" color="primary">
          Add Users to Groups
        </Button>
      </DialogActions>
      <Snackbar open={snackbarState.open} autoHideDuration={6000} onClose={handleSnackbarClose}>
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbarState.severity}
          sx={{ width: '100%' }}
        >
          {snackbarState.message}
        </Alert>
      </Snackbar>
    </Dialog>
  );
}

export default Users;
