import { Icon } from '@iconify/react';
import React, { useRef, useState, useEffect } from 'react';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';

import {
  Box,
  Menu,
  Table,
  Paper,
  Alert,
  Button,
  Avatar,
  Dialog,
  Switch,
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
  Link as MuiLink,
  FormControlLabel,
  CircularProgress,
} from '@mui/material';

import { Iconify } from 'src/components/iconify';

import { usePermissions } from '../context/permission-context';
import {
  removeUser,
  fetchAllUsers,
  addUsersToGroups,
  fetchGroupDetails,
  getUserIdFromToken,
  getPermissionSchema,
  getAllUsersWithGroups,
  updateGroupPermissions,
  getGroupPermissionsById,
} from '../context/utils';

import type { PermissionSchema } from '../types/permissions';
import type { SnackbarState } from '../types/organization-data';
import type {
  AppUser,
  GroupUser,
  AppUserGroup,
  GroupPermissions,
  EditGroupModalProps,
  AddUsersToGroupsModalProps,
} from '../types/group-details';

export default function GroupDetails() {
  const navigate = useNavigate();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [group, setGroup] = useState<AppUserGroup | null>(null);
  const [groupUsers, setGroupUsers] = useState<AppUser[]>([]);
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(5);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isAddUsersModalOpen, setIsAddUsersModalOpen] = useState<boolean>(false);
  const [newUsers, setNewUsers] = useState<GroupUser[] | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);
  const [snackbarState, setSnackbarState] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });
  const { isAdmin } = usePermissions();

  const location = useLocation();

  const pathSegments = location?.pathname?.split('/') || [];

  const groupId = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : null;

  const handleSnackbarClose = (): void => {
    setSnackbarState({ ...snackbarState, open: false });
  };

  const filterGroupUsers = (users: AppUser[], groupUserIds: string[]): AppUser[] =>
    users.filter((user: AppUser) => groupUserIds.includes(user._id));

  useEffect(() => {
    const fetchData = async () => {
      try {
        const orgId = await getUserIdFromToken();
        setUserId(orgId);
        const groupData = await fetchGroupDetails(groupId);
        const allUsers = await fetchAllUsers();

        const loggedInUsers = allUsers.filter((user) => user?.isEmailVerified === true);
        const filteredUsers = filterGroupUsers(loggedInUsers, groupData.users);
        const response = await getAllUsersWithGroups();
        setNewUsers(response);
        setGroup(groupData);
        setGroupUsers(filteredUsers);
      } catch (error) {
        console.error('Error fetching data:', error);
        setSnackbarState({
          open: true,
          message: error.errorMessage,
          severity: 'error',
        });
      }
    };

    fetchData();
  }, [groupId]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, user: AppUser) => {
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
    if (selectedUser) {
      handleDeleteUser(selectedUser._id);
    }
    setIsConfirmDialogOpen(false);
  };

  const handleChangePage = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent> | null,
    newPage: number
  ) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleEditGroup = () => {
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
  };
  const handleAddUsers = () => {
    setIsAddUsersModalOpen(true);
  };

  const handleCloseAddUsers = () => {
    setIsAddUsersModalOpen(false);
  };

  const handlePopoverOpen = (event: React.MouseEvent<HTMLElement>, user: AppUser) => {
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
    // const updatedUsers = await getAllUsersWithGroups();
    // set(updatedUsers);
  };

  const handleDeleteUser = async (deleteUserId: string) => {
    try {
      await removeUser(deleteUserId);

      setGroupUsers((prevGroupUsers) => prevGroupUsers.filter((user) => user._id !== deleteUserId));
      setSnackbarState({
        open: true,
        message: 'User removed successfully',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error removing user:', error);
      setSnackbarState({
        open: true,
        message: error.errorMessage,
        severity: 'error',
      });
    }
  };

  const open = Boolean(anchorEl);

  if (!group) return <CircularProgress color="primary" sx={{ mt: 3, ml: 3 }} />;

  return (
    <Box sx={{ p: 3 }}>
      <Typography
        variant="h5"
        gutterBottom
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
      >
        <MuiLink
          component={RouterLink}
          to={-1 as any}
          sx={{ textDecoration: 'none', color: '#909190', cursor: 'pointer' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.textDecoration = 'underline';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.textDecoration = 'none';
          }}
        >
          Groups
        </MuiLink>
        <Iconify icon="weui:arrow-filled" /> {group.name}
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          {groupUsers.length} User{groupUsers.length !== 1 && 's'}
        </Typography>
        <Box>
          <Button variant="outlined" sx={{ mr: 2 }} onClick={handleAddUsers}>
            Add Users
          </Button>
          <Button variant="contained" color="primary" onClick={handleEditGroup}>
            Edit Group
          </Button>
        </Box>
      </Box>
      <Typography variant="body1" sx={{ mb: 3 }}>
        {group.description}
      </Typography>

      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="users table">
          <TableHead>
            <TableRow>
              <TableCell>USER</TableCell>
              <TableCell align="right">ACTIONS</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {groupUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((user) => (
              <TableRow key={user._id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                <TableCell component="th" scope="row">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar
                      sx={{ mr: 2, bgcolor: 'primary.main' }}
                      onMouseEnter={(e) => handlePopoverOpen(e, user)}
                      onMouseLeave={handlePopoverClose}
                    >
                      {user.fullName[0]}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle1">{user.fullName}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {user.email}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <IconButton onClick={(e) => handleMenuOpen(e, user)}>
                    <Icon icon="mdi:dots-vertical" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={groupUsers.length}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />

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
        {selectedUser && (
          <Box sx={{ p: 2, maxWidth: 300 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Avatar sx={{ mr: 2, bgcolor: 'primary.main', width: 56, height: 56 }}>
                {selectedUser.fullName[0]}
              </Avatar>
              <Box>
                <Typography variant="h6">{selectedUser.fullName}</Typography>
                {/* <Typography variant="body2" color="text.secondary">
                  Active {selectedUser.lastActive}
                </Typography> */}
              </Box>
            </Box>
            {/* <Typography variant="body2" paragraph>
              {selectedUser.jobTitle}
            </Typography> */}
            <Typography variant="body2" paragraph>
              {selectedUser.email}
            </Typography>
            <Button
              variant="outlined"
              onClick={() => {
                if (selectedUser._id === userId) {
                  navigate('/account/company-settings/personal-profile');
                } else {
                  navigate(`/account/company-settings/user-profile/${selectedUser._id}`);
                }
              }}
            >
              Edit profile
            </Button>
          </Box>
        )}
      </Popover>

      <AddUsersToGroupsModal
        open={isAddUsersModalOpen}
        onClose={handleCloseAddUsers}
        onUsersAdded={handleUsersAdded}
        allUsers={newUsers}
        group={groupId}
      />

      <EditGroupModal
        open={isEditModalOpen}
        onClose={handleCloseEditModal}
        groupId={groupId}
        groupName={group.name}
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
          onClick={handleRemoveUser}
          disabled={!isAdmin}
          sx={{
            '&.Mui-disabled': {
              cursor: 'not-allowed',
              pointerEvents: 'auto',
            },
          }}
        >
          Remove User
        </MenuItem>
      </Menu>

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
    </Box>
  );
}

function EditGroupModal({ open, onClose, groupId, groupName }: EditGroupModalProps) {
  const [permissionSchema, setPermissionSchema] = useState<PermissionSchema[]>([]);
  const [groupPermissions, setGroupPermissions] = useState<GroupPermissions>({});
  const [snackbarState, setSnackbarState] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });
  const handleSnackbarClose = () => {
    setSnackbarState({ ...snackbarState, open: false });
  };

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const schema = await getPermissionSchema();
        const group = await getGroupPermissionsById(groupId);
        setPermissionSchema(schema);
        setGroupPermissions(group.permissions);
      } catch (error) {
        console.error('Error fetching permissions:', error);
        setSnackbarState({
          open: true,
          message: error.errorMessage,
          severity: 'error',
        });
      }
    };

    if (open) {
      fetchPermissions();
    }
  }, [open, groupId]);

  const handlePermissionChange = (flag: string) => {
    setGroupPermissions((prev) => ({
      ...prev,
      [flag]: !prev[flag],
    }));
  };

  const handleSave = async () => {
    try {
      const updatedPermissions = { permissions: groupPermissions };
      await updateGroupPermissions(groupId, updatedPermissions);
      setSnackbarState({
        open: true,
        message: 'Permissions updated successfully',
        severity: 'success',
      });
      onClose();
    } catch (error) {
      console.error('Error updating permissions:', error);
      setSnackbarState({
        open: true,
        message: error.errorMessage,
        severity: 'error',
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit {groupName}</DialogTitle>
      <DialogContent>
        <Typography variant="h6" gutterBottom>
          GENERAL PERMISSIONS
        </Typography>
        {permissionSchema.map((permission) => (
          <Box key={permission.flag} sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={groupPermissions[permission.flag] || false}
                  onChange={() => handlePermissionChange(permission.flag)}
                />
              }
              label={permission.fieldName}
            />
            <Typography variant="body2" color="text.secondary">
              {permission.description}
            </Typography>
          </Box>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          Save Changes
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
  group,
}: AddUsersToGroupsModalProps) {
  const [selectedUsers, setSelectedUsers] = useState<GroupUser[]>([]);
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
      if (!group) {
        throw new Error('Group ID is required');
      }
      const userIds = selectedUsers
        .filter((user) => user.iamUser !== null)
        .map((user) => user.iamUser!._id);

      await addUsersToGroups({ userIds, groupIds: [group] });
      setSnackbarState({
        open: true,
        message: 'Users added to groups successfully',
        severity: 'success',
      });
      onUsersAdded();
      onClose();
    } catch (error) {
      console.error('Error adding users to groups:', error);
      setSnackbarState({
        open: true,
        message: error.errorMessage,
        severity: 'error',
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Users to Groups</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {allUsers ? (
            <Autocomplete<GroupUser, true>
              multiple
              options={allUsers.filter((user) => user.iamUser?.isEmailVerified)}
              getOptionLabel={(option: GroupUser) => option.iamUser?.fullName ?? 'Unknown User'}
              renderInput={(params) => <TextField {...params} label="Select Users" />}
              onChange={(_event, newValue: GroupUser[]) => setSelectedUsers(newValue)}
              sx={{ mb: 2 }}
            />
          ) : (
            <CircularProgress />
          )}
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
