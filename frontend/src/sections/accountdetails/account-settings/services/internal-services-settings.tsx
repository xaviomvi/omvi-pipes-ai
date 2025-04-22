import { useState } from 'react';
import webCheckIcon from '@iconify-icons/mdi/web-check';
import linkVariantIcon from '@iconify-icons/mdi/link-variant';
import settingsIcon from '@iconify-icons/eva/settings-2-outline';

import { alpha, useTheme } from '@mui/material/styles';
import { Box, Grid, Link, Paper, Alert, Container, Typography, IconButton } from '@mui/material';

import { Iconify } from 'src/components/iconify';

import ConfigureServiceDialog from './configure-services-dialog';

// Service configuration list
const SERVICES_LIST = [
  {
    id: 'frontendPublicUrl',
    icon: webCheckIcon,
    title: 'Frontend Public DNS',
    description: 'Publicly accessible frontend service DNS',
    color: '#87CEEB',
  },
  {
    id: 'connectorPublicUrl',
    icon: linkVariantIcon,
    title: 'Connectors Public DNS',
    description: 'Publicly accessible connector service DNS',
    color: '#231F20',
  },
  // {
  //   id: 'backendNodejs',
  //   icon: 'mdi-nodejs',
  //   title: 'Backend-NodeJS',
  //   description: 'Backend-nodejs-services-url',
  //   color: '#DC382D',
  // },
];

const InternalServicesSettings = () => {
  const theme = useTheme();
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [currentService, setCurrentService] = useState<string | null>(null);
  // Handle service selecti
  const handleConfigureService = (serviceId: string) => {
    setCurrentService(serviceId);
    setConfigDialogOpen(true);
  };
  const handleSaveConfiguration = () => {
    // Display appropriate success message
    setConfigDialogOpen(false);
    setCurrentService(null);
  };

  return (
    <Container maxWidth="lg">
      <Paper
        sx={{
          overflow: 'hidden',
          position: 'relative',
          p: 3,
          borderRadius: 2,
          boxShadow: (themeShadow) => `0 2px 20px ${alpha(themeShadow.palette.grey[500], 0.15)}`,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        {/* Header section */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            mb: 4,
            gap: 2,
          }}
        >
          <Box>
            <Typography
              variant="h5"
              component="h1"
              sx={{
                fontWeight: 600,
                mb: 1,
                color: theme.palette.text.primary,
              }}
            >
              Internal Services
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 500 }}>
              Configure connections to internal services
            </Typography>
          </Box>
        </Box>

        {/* Services Grid */}
        <Grid container spacing={2} mb={4}>
          {SERVICES_LIST.map((service) => (
            <Grid item xs={12} key={service.id}>
              <Paper
                sx={{
                  p: 2.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 2,
                    borderColor: alpha(service.color, 0.3),
                  },
                }}
              >
                {/* Service info */}
                <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: 2,
                      bgcolor: alpha(service.color, 0.1),
                      color: service.color,
                      borderRadius: 1.5,
                    }}
                  >
                    <Iconify icon={service.icon} width={26} height={26} />
                  </Box>

                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {service.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {service.description}
                    </Typography>
                  </Box>
                </Box>

                {/* Settings icon */}
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleConfigureService(service.id);
                  }}
                  sx={{
                    mr: 1,
                    color: theme.palette.text.secondary,
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                      color: theme.palette.primary.main,
                    },
                  }}
                  aria-label={`Configure ${service.title}`}
                >
                  <Iconify icon={settingsIcon} width={20} height={20} />
                </IconButton>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Paper>
      <ConfigureServiceDialog
        open={configDialogOpen}
        onClose={() => setConfigDialogOpen(false)}
        onSave={handleSaveConfiguration}
        serviceType={currentService}
      />
      <Alert variant="outlined" severity="info" sx={{ my: 3 }}>
        Refer to{' '}
        <Link
          href="https://docs.pipeshub.com/services/internalServices"
          target="_blank"
          rel="noopener"
        >
          the documentation
        </Link>{' '}
        for more information.
      </Alert>
      {/* Success snackbar */}
    </Container>
  );
};

export default InternalServicesSettings;
