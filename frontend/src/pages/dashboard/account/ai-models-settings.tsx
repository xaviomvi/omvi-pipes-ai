import { Helmet } from 'react-helmet-async';

import { Box } from '@mui/material';

import { CONFIG } from 'src/config-global';

import Sidebar from 'src/sections/accountdetails/Sidebar';
import AiModelsSettings from 'src/sections/accountdetails/account-settings/ai-models/ai-models-settings';

// ----------------------------------------------------------------------

const metadata = { title: `AI Model Settings  - ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <Helmet>
        <title> {metadata.title}</title>
      </Helmet>
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden', zIndex: 0 }}>
        <Sidebar />
        <AiModelsSettings/>
      </Box>
    </>
  );
}
