import { Helmet } from 'react-helmet-async';

import { Box } from '@mui/material';

import { CONFIG } from 'src/config-global';

import Sidebar from 'src/sections/accountdetails/Sidebar';
import GroupDetails from 'src/sections/accountdetails/user-and-groups/group-details';

// ----------------------------------------------------------------------
const drawerWidth = 40;
const metadata = { title: `Group Details | Dashboard - ${CONFIG.appName}` };

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
          <GroupDetails />
        </Box>
      </Box>
    </>
  );
}
