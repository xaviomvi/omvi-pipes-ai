// components/TabPanel.tsx
import { Box, Fade } from '@mui/material';

import type { TabPanelProps } from '../types/auth';

export const TabPanel = ({ children, value, index, ...other }: TabPanelProps) => (
  <Fade in={value === index} timeout={300}>
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`auth-tabpanel-${index}`}
      aria-labelledby={`auth-tab-${index}`}
      {...other}
    >
      {value === index && children}
    </Box>
  </Fade>
);