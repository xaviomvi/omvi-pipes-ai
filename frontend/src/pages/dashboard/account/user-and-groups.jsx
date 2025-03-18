import { Helmet } from 'react-helmet-async';

import { Box } from '@mui/material';

import { CONFIG } from 'src/config-global';

import Sidebar from 'src/sections/accountdetails/Sidebar';
import UsersAndGroups from 'src/sections/accountdetails/user-and-groups/users-and-groups';

// ----------------------------------------------------------------------
const drawerWidth = 0
const metadata = { title: `Users and groups | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <Helmet>
        <title> {metadata.title}</title>
      </Helmet>
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden', zIndex: 0 }}>
        <Sidebar />
        <Box
            sx={{
            // flexGrow: 1,
            width: { sm: `calc(100% - ${drawerWidth}px)` },
            ml: { sm: `${drawerWidth}px` },
            overflow: 'auto',
          }}
        >
          <UsersAndGroups />
        </Box>
      </Box>
    </>
  );
}