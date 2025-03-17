import React, { useState } from 'react';

import { Box } from '@mui/material';

// import MainView from '../MainView';

export function CompanySettings() {
  const [selectedView, setSelectedView] = useState('CompanyProfile');

  return (
    <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden', zIndex: 0 }}>
      {/* <Sidebar selectedView={selectedView} setSelectedView={setSelectedView} />
      {selectedView === 'CompanyProfile' && <CompanyProfile selectedView={selectedView} />}
      {selectedView === 'UsersAndGroups' && (
        <UsersAndGroups selectedView={selectedView} setSelectedView={setSelectedView} />
      )}
      {selectedView === 'PersonalProfile' && <PersonalProfile selectedView={selectedView} />}
      <MainView selectedView={selectedView} /> */}
    </Box>
  );
}
