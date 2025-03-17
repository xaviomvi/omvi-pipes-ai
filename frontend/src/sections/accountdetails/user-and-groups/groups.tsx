import { z as zod } from 'zod';
import { Icon } from '@iconify/react';
import { useForm } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  Box,
  Menu,
  Table,
  Paper,
  Alert,
  Button,
  Avatar,
  Dialog,
  TableRow,
  Snackbar,
  MenuItem,
  TextField,
  TableBody,
  TableCell,
  TableHead,
  Typography,
  IconButton,
  DialogTitle,
  DialogContent,
  DialogActions,
  TableContainer,
  TablePagination,
  CircularProgress,
} from '@mui/material';

import { Form, Field } from 'src/components/hook-form';

import { usePermissions } from '../context/permission-context';
import { allGroups, createGroup, deleteGroup } from '../context/utils';
import { decrementGroupCount, incrementGroupCount } from '../../../store/userAndGroupsSlice';

import type { AppUserGroup, SnackbarState } from '../types/group-details';

const CreateGroupSchema = zod.object({
  name: zod.string().min(1, { message: 'Group name is required!' }),
  type: zod.string().default('custom'),
});

type CreateGroupFormData = zod.infer<typeof CreateGroupSchema>;

export default function Groups() {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [groups, setGroups] = useState<AppUserGroup[]>([]);
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(5);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedGroup, setSelectedGroup] = useState<AppUserGroup | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);
  const [snackbarState, setSnackbarState] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();
  const handleSnackbarClose = () => {
    setSnackbarState({ ...snackbarState, open: false });
  };

  const methods = useForm<CreateGroupFormData>({
    resolver: zodResolver(CreateGroupSchema),
    defaultValues: {
      name: '',
      type: 'custom',
    },
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
    reset,
  } = methods;

  useEffect(() => {
    const loadGroups = async () => {
      setLoading(true);
      try {
        const data = await allGroups();
        setGroups(data);
      } catch (error) {
        console.error('Error loading groups:', error);
        setSnackbarState({
          open: true,
          message: error.errorMessage || 'Error loading groups',
          severity: 'error',
        });
      } finally {
        setLoading(false);
      }
    };

    loadGroups();
  }, []);

  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleChangePage = (event :React.MouseEvent<HTMLButtonElement> | null, newPage: number) : void => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) : void => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCreateGroup = () : void => {
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () : void => {
    setIsCreateModalOpen(false);
    reset();
    setErrorMsg('');
  };

  const handleDeleteGroup = async (groupId : string) : Promise<void>  => {
    try {
      await deleteGroup(groupId);
      setGroups((prevGroups) => prevGroups.filter((group) => group._id !== groupId));
      dispatch(decrementGroupCount());
      setSnackbarState({ open: true, message: 'Group deleted successfully', severity: 'success' });
    } catch (error) {
      console.error('Error deleting group:', error);
      setSnackbarState({ open: true, message: error.errorMessage, severity: 'error' });
    }
  };

  const onSubmit = async (data : CreateGroupFormData) : Promise<void>  => {
    try {
      await createGroup(data);
      const updatedGroups = await allGroups();
      setGroups(updatedGroups);
      dispatch(incrementGroupCount());
      handleCloseCreateModal();
      setSnackbarState({ open: true, message: 'Group created successfully', severity: 'success' });
    } catch (error) {
      console.error('Error creating group:', error);
      setSnackbarState({ open: true, message: error.errorMessage, severity: 'error' });
    }
  };

  const handleMenuOpen = (event : React.MouseEvent<HTMLElement>, group : AppUserGroup) : void=> {
    setMenuAnchorEl(event.currentTarget);
    setSelectedGroup(group);
  };

  const handleMenuClose = () : void => {
    setMenuAnchorEl(null);
  };

  const handleRemoveGroup = () : void => {
    if (selectedGroup) {
      setIsConfirmDialogOpen(true);
    }
    handleMenuClose();
  };

  const handleConfirmRemoveGroup = () : void => {
    if (selectedGroup) {
      handleDeleteGroup(selectedGroup._id);
    }
    setIsConfirmDialogOpen(false);
  };

  const handleViewGroup = () : void => {
    if (selectedGroup) {
      navigate(`/account/company-settings/groups/${selectedGroup._id}`);
    }
    handleMenuClose();
  };

  const renderCreateGroupForm = (
    <Box gap={0.5} display="flex" flexDirection="column" sx={{ pt: 2, width: 400 }}>
      <Field.Text name="name" label="Group name" InputLabelProps={{ shrink: true }} />
    </Box>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <TextField
          placeholder="Search by group name"
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
            startIcon={<Icon icon="mdi:plus" />}
            onClick={handleCreateGroup}
          >
            Create Group
          </Button>
        </Box>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" sx={{ height: 300 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650, mt: 3 }} aria-label="groups table">
            <TableHead>
              <TableRow>
                <TableCell>GROUP</TableCell>
                <TableCell>USERS</TableCell>
                <TableCell align="right" sx={{ pr: 5 }}>
                  ACTIONS
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredGroups
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((group) => (
                  <TableRow key={group._id}>
                    <TableCell component="th" scope="row">
                      <Box
                        sx={{
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        onClick={() => {
                          navigate(`/account/company-settings/groups/${group._id}`);
                        }}
                      >
                        <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                          <Icon icon="mdi:account-group" />
                        </Avatar>
                        <Typography>{group.name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{group.users.length}</TableCell>

                    <TableCell align="right">
                      <IconButton onClick={(e) => handleMenuOpen(e, group)}>
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
        count={filteredGroups.length}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />

      <Dialog open={isCreateModalOpen} onClose={handleCloseCreateModal}>
        <DialogTitle>Create New Group</DialogTitle>
        <Form methods={methods} onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            {!!errorMsg && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {errorMsg}
              </Alert>
            )}
            {renderCreateGroupForm}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseCreateModal}>Cancel</Button>
            <Button type="submit" variant="contained" color="primary" disabled={isSubmitting}>
              Save
            </Button>
          </DialogActions>
        </Form>
      </Dialog>

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
        <MenuItem onClick={handleViewGroup}>View Group</MenuItem>
        <MenuItem
          onClick={handleRemoveGroup}
          disabled={!isAdmin}
          sx={{
            '&.Mui-disabled': {
              cursor: 'not-allowed',
              pointerEvents: 'auto',
            },
          }}
        >
          Remove Group
        </MenuItem>
      </Menu>

      <Dialog
        open={isConfirmDialogOpen}
        onClose={() => setIsConfirmDialogOpen(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">Confirm Group Removal</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to remove the Group ?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsConfirmDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmRemoveGroup} autoFocus>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarState.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
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
