import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

import List from '@mui/material/List';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import ListItem from '@mui/material/ListItem';
import Collapse from '@mui/material/Collapse';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';

import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

const drawerWidth = 240;

export default function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { user } = useAuthContext();

  // Determine account type
  const isBusiness = user?.accountType === 'business' || user?.accountType === 'organization';

  // Base URL for routing depends on account type
  const baseUrl = isBusiness ? '/account/company-settings' : '/account/individual';

  // Check if current path is any settings path
  const isSettingsPath = pathname.includes(`${baseUrl}/settings/`);

  // Set settings open by default if we're on a settings page
  useEffect(() => {
    if (isSettingsPath) {
      setSettingsOpen(true);
    }
  }, [isSettingsPath]);

  // Toggle settings submenu
  const handleToggleSettings = () => {
    setSettingsOpen(!settingsOpen);
  };

  // Settings submenu items - common for both account types
  const commonSettingsOptions = [
    {
      name: 'Authentication',
      icon: 'mdi:shield-lock',
      path: `${baseUrl}/settings/authentication`,
    },
    {
      name: 'Connectors',
      icon: 'mdi:link-variant',
      path: `${baseUrl}/settings/connector`,
    },
    {
      name: 'Services',
      icon: 'mdi:account-service-outline',
      path: `${baseUrl}/settings/services`,
    },
  ];

  // Business-specific settings options
  const businessSettingsOptions = [
    ...commonSettingsOptions,
    {
      name: 'Crawling',
      icon: 'mdi:spider-web',
      path: `${baseUrl}/settings/crawling`,
    },
    {
      name: 'Integrations',
      icon: 'mdi:connection',
      path: `${baseUrl}/settings/integrations`,
    },
  ];

  // Use the appropriate settings options based on account type
  const settingsOptions = isBusiness ? businessSettingsOptions : commonSettingsOptions;

  return (
    <Drawer
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
        },
      }}
      variant="permanent"
      anchor="left"
    >
      {/* Show Business section only for business accounts */}
      {isBusiness && (
        <>
          <List sx={{ mt: 10 }}>
            <ListItem>
              <ListItemText primary="COMPANY" />
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => navigate(`${baseUrl}/profile`)}
                selected={pathname === `${baseUrl}/profile`}
              >
                <ListItemIcon>
                  <Iconify icon="mdi:office-building" width="24" height="24" />
                </ListItemIcon>
                <ListItemText primary="Profile" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => navigate(`${baseUrl}/users`)}
                selected={pathname === `${baseUrl}/users`}
              >
                <ListItemIcon>
                  <Iconify icon="mdi:account-group" width="24" height="24" />
                </ListItemIcon>
                <ListItemText primary="Users & Groups" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                onClick={handleToggleSettings}
                selected={isSettingsPath || settingsOpen}
              >
                <ListItemIcon>
                  <Iconify icon="mdi:cog" width="24" height="24" />
                </ListItemIcon>
                <ListItemText primary="Settings" />
                <Iconify
                  icon={settingsOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'}
                  width="20"
                  height="20"
                />
              </ListItemButton>
            </ListItem>
            <Collapse in={settingsOpen} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {settingsOptions.map((option) => (
                  <ListItemButton
                    key={option.name}
                    sx={{ pl: 4 }}
                    onClick={() => navigate(option.path)}
                    selected={pathname === option.path}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Iconify icon={option.icon} width="20" height="20" />
                    </ListItemIcon>
                    <ListItemText
                      primary={option.name}
                      primaryTypographyProps={{ fontSize: '0.9rem' }}
                    />
                  </ListItemButton>
                ))}
              </List>
            </Collapse>
          </List>
          <Divider />
        </>
      )}

      {/* Personal section - for both account types */}
      <List sx={{ mt: isBusiness ? 0 : 10 }}>
        <ListItem>
          <ListItemText primary="PERSONAL" />
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton
            onClick={() =>
              navigate(isBusiness ? `${baseUrl}/personal-profile` : `${baseUrl}/profile`)
            }
            selected={
              pathname === (isBusiness ? `${baseUrl}/personal-profile` : `${baseUrl}/profile`)
            }
          >
            <ListItemIcon>
              <Iconify icon="mdi:account" width="24" height="24" />
            </ListItemIcon>
            <ListItemText primary="Profile" />
          </ListItemButton>
        </ListItem>

        {/* For individual accounts, show settings in the personal section */}
        {!isBusiness && (
          <>
            <ListItem disablePadding>
              <ListItemButton
                onClick={handleToggleSettings}
                selected={isSettingsPath || settingsOpen}
              >
                <ListItemIcon>
                  <Iconify icon="mdi:cog" width="24" height="24" />
                </ListItemIcon>
                <ListItemText primary="Settings" />
                <Iconify
                  icon={settingsOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'}
                  width="20"
                  height="20"
                />
              </ListItemButton>
            </ListItem>
            <Collapse in={settingsOpen} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {settingsOptions.map((option) => (
                  <ListItemButton
                    key={option.name}
                    sx={{ pl: 4 }}
                    onClick={() => navigate(option.path)}
                    selected={pathname === option.path}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Iconify icon={option.icon} width="20" height="20" />
                    </ListItemIcon>
                    <ListItemText
                      primary={option.name}
                      primaryTypographyProps={{ fontSize: '0.9rem' }}
                    />
                  </ListItemButton>
                ))}
              </List>
            </Collapse>
          </>
        )}
      </List>
    </Drawer>
  );
}
