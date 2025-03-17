import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';

import { Box, Tab, Tabs, CircularProgress } from '@mui/material';

import Users from './users';
import Groups from './groups';
import Invites from './invites';
import { allGroups, getAllUsersWithGroups } from '../context/utils';
import { setCounts, setLoading } from '../../../store/userAndGroupsSlice';

import type { CountsState} from '../../../store/userAndGroupsSlice';
import type { GroupUser, AppUserGroup } from '../types/group-details';

interface RootState {
  counts: CountsState;
}

export default function UsersAndGroups() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tabValue, setTabValue] = useState<number>(0);

  const dispatch = useDispatch();
  const loading = useSelector((state: RootState) => state.counts.loading);
  const userCount = useSelector((state: RootState) => state.counts.usersCount);
  const groupCount = useSelector((state: RootState) => state.counts.groupsCount);
  const invitesCount = useSelector((state: RootState) => state.counts.invitesCount);

  useEffect(() => {
    const fetchCounts = async (): Promise<void> => {
      dispatch(setLoading(true));
      try {
        const response: GroupUser[] = await getAllUsersWithGroups();
        const groups: AppUserGroup[] = await allGroups();
        const loggedInUsers = response.filter((user) => user.iamUser?.isEmailVerified === true);
        const pendingUsers = response.filter((user) => !user.iamUser?.isEmailVerified);

        dispatch(
          setCounts({
            usersCount: loggedInUsers.length,
            groupsCount: groups.length,
            invitesCount: pendingUsers.length,
          })
        );
      } catch (error) {
        console.error('Error fetching counts:', error);
      } finally {
        dispatch(setLoading(false));
      }
    };

    fetchCounts();
  }, [dispatch]);

  useEffect(() => {
    if (location.pathname.includes('users')) {
      setTabValue(0);
    } else if (location.pathname.includes('groups')) {
      setTabValue(1);
    } else if (location.pathname.includes('invites')) {
      setTabValue(2);
    }
  }, [location.pathname]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    if (newValue === 0) {
      navigate('/account/company-settings/users');
    } else if (newValue === 1) {
      navigate('/account/company-settings/groups');
    } else if (newValue === 2) {
      navigate('/account/company-settings/invites');
    }
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        sx={{ height: 300 }}
        width="100%"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="users and groups tabs">
          <Tab label={`Users (${userCount})`} />
          <Tab label={`Groups (${groupCount})`} />
          <Tab label={`Invites (${invitesCount})`} />
        </Tabs>
        {tabValue === 0 && <Users />}
        {tabValue === 1 && <Groups />}
        {tabValue === 2 && <Invites />}
      </Box>
  );
}
