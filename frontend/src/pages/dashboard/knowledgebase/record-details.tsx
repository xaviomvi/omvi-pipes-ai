import { Helmet } from 'react-helmet-async';

import { Box } from '@mui/material';

import { CONFIG } from 'src/config-global';
import { UserProvider } from 'src/context/UserContext';
import { GroupsProvider } from 'src/context/GroupsContext';

import RecordDetails from 'src/sections/knowledgebase/RecordDetails';

// ----------------------------------------------------------------------

const metadata = { title: `Knowledge Base | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <Helmet>
        <title> {metadata.title}</title>
      </Helmet>

      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden', zIndex: 0 }}>
        <UserProvider>
          <GroupsProvider>
            <RecordDetails />
          </GroupsProvider>
        </UserProvider>
      </Box>
    </>
  );
}
