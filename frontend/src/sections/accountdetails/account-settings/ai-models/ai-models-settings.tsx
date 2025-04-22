import { useState, useEffect } from 'react';
import robotIcon from '@iconify-icons/mdi/robot';
import settingsIcon from '@iconify-icons/eva/settings-2-outline';

import { alpha, useTheme } from '@mui/material/styles';
import {
  Box,
  Grid,
  Link,
  Paper,
  Alert,
  Snackbar,
  Container,
  Typography,
  IconButton,
} from '@mui/material';

import axios from 'src/utils/axios';

import { Iconify } from 'src/components/iconify';

import ConfigureModelDialog from './components/configure-model-dialog';
import { MODEL_TYPE_NAMES, MODEL_TYPE_ICONS, MODEL_TYPE_DESCRIPTIONS } from './utils/types';
// AI model types
const AI_MODEL_TYPES = ['llm'];

// Define the save result interface
interface SaveResult {
  success: boolean;
  warning?: string;
  error?: string;
}

// AiModel interface
interface AiModel {
  type: string;
  enabled: boolean;
  configurations: ModelConfig[];
}

// Model configuration interface
interface ModelConfig {
  name: string;
  configuration: Record<string, any>;
}

const AiModelsSettings = () => {
  const theme = useTheme();
  const [aiModels, setAiModels] = useState<AiModel[]>([]);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Notification states
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState(
    'AI model configuration updated successfully'
  );

  // Fetch AI models configuration
  useEffect(() => {
    fetchAiModelsConfig();
  }, []);

  const fetchAiModelsConfig = async () => {
    setIsLoading(true);
    try {
      // API call to get current AI models configuration
      const response = await axios.get('/api/v1/configurationManager/aiModelsConfig');
      const { data } = response;

      // Create a structured list of model types and their configurations
      const modelsList = AI_MODEL_TYPES.map((type) => {
        const configs = data[type] || [];
        return {
          type,
          enabled: configs.length > 0,
          configurations: configs,
        };
      });

      setAiModels(modelsList);
    } catch (err) {
      setError('Failed to load AI models configuration');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle closing of different snackbars
  const handleCloseSuccess = () => {
    setSuccess(false);
  };

  const handleCloseError = () => {
    setError(null);
  };

  const handleCloseWarning = () => {
    setWarning(null);
  };

  // Handle model selection
  const handleConfigureModel = (modelType: string) => {
    setCurrentModel(modelType);
    setConfigDialogOpen(true);
  };

  // Handle save configuration
  const handleSaveConfiguration = async (result?: SaveResult) => {
    if (result) {
      if (result.warning) {
        setWarning(result.warning);
      }

      if (result.error) {
        setError(result.error);
        // Keep dialog open if there's an error
        return;
      }

      if (result.success) {
        // Only show success if there was no error
        setSuccessMessage(
          `${currentModel ? getModelTitle(currentModel) : 'AI model'} configuration updated successfully`
        );
        setSuccess(true);

        // Refresh models after successful configuration
        fetchAiModelsConfig();
      }
    } else {
      // Legacy support - if no result object is provided, assume success
      setSuccessMessage(
        `${currentModel ? getModelTitle(currentModel) : 'AI model'} configuration updated successfully`
      );
      setSuccess(true);

      // Refresh models after successful configuration
      fetchAiModelsConfig();
    }

    setConfigDialogOpen(false);
    setCurrentModel(null);
  };

  // Helper to get model title for success message
  const getModelTitle = (modelType: string): string =>
    MODEL_TYPE_NAMES[modelType] || modelType.toUpperCase();

  // Get appropriate color for model type
  const getModelColor = (modelType: string): string => {
    const colors: Record<string, string> = {
      llm: '#4CAF50', // Green
      ocr: '#2196F3', // Blue
      embedding: '#9C27B0', // Purple
      slm: '#FF9800', // Orange
      reasoning: '#E91E63', // Pink
      multiModal: '#673AB7', // Deep Purple
    };

    return colors[modelType] || theme.palette.primary.main;
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
          mt: 4,
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
              AI Models
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 500 }}>
              Configure AI models to enable intelligent features in your application
            </Typography>
          </Box>
        </Box>

        {/* AI Models Grid */}
        <Grid container spacing={2} mb={4}>
          {aiModels.map((model) => {
            const displayName = MODEL_TYPE_NAMES[model.type] || model.type.toUpperCase();
            const description =
              MODEL_TYPE_DESCRIPTIONS[model.type] || 'AI model for advanced capabilities';
            const icon = MODEL_TYPE_ICONS[model.type] || robotIcon;
            const color = getModelColor(model.type);
            const configCount = model.configurations.length;

            return (
              <Grid item xs={12} key={model.type}>
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
                      borderColor: alpha(color, 0.3),
                    },
                  }}
                >
                  {/* Model info */}
                  <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mr: 2,
                        bgcolor: alpha(color, 0.1),
                        color,
                        borderRadius: 1.5,
                      }}
                    >
                      <Iconify icon={icon} width={26} height={26} />
                    </Box>

                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {displayName}
                        {model.enabled && (
                          <Box
                            component="span"
                            sx={{
                              ml: 1,
                              px: 1,
                              py: 0.25,
                              borderRadius: 1,
                              fontSize: '0.75rem',
                              bgcolor: alpha(theme.palette.success.main, 0.1),
                              color: theme.palette.success.main,
                            }}
                          >
                            Enabled
                          </Box>
                        )}
                        {configCount > 0 && (
                          <Box
                            component="span"
                            sx={{
                              ml: 1,
                              px: 1,
                              py: 0.25,
                              borderRadius: 1,
                              fontSize: '0.75rem',
                              bgcolor: alpha(theme.palette.info.main, 0.1),
                              color: theme.palette.info.main,
                            }}
                          >
                            {configCount} config{configCount !== 1 ? 's' : ''}
                          </Box>
                        )}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {description}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Settings icon */}
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConfigureModel(model.type);
                    }}
                    sx={{
                      mr: 1,
                      color: theme.palette.text.secondary,
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                        color: theme.palette.primary.main,
                      },
                    }}
                    aria-label={`Configure ${displayName}`}
                  >
                    <Iconify icon={settingsIcon} width={20} height={20} />
                  </IconButton>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      </Paper>

      {/* Configure Model Dialog */}
      <ConfigureModelDialog
        open={configDialogOpen}
        onClose={() => setConfigDialogOpen(false)}
        onSave={handleSaveConfiguration}
        modelType={currentModel}
      />

      {/* Success snackbar */}
      <Snackbar
        open={success}
        autoHideDuration={5000}
        onClose={handleCloseSuccess}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{ mt: 6 }}
      >
        <Alert
          onClose={handleCloseSuccess}
          severity="success"
          variant="filled"
          sx={{
            width: '100%',
            boxShadow: '0px 3px 8px rgba(0, 0, 0, 0.12)',
          }}
        >
          {successMessage}
        </Alert>
      </Snackbar>

      {/* Error snackbar */}
      <Snackbar
        open={!!error}
        autoHideDuration={5000}
        onClose={handleCloseError}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{ mt: error && warning ? 22 : 14 }}
      >
        <Alert
          onClose={handleCloseError}
          severity="error"
          variant="filled"
          sx={{
            width: '100%',
            boxShadow: '0px 3px 8px rgba(0, 0, 0, 0.12)',
          }}
        >
          {error}
        </Alert>
      </Snackbar>

      {/* Warning snackbar */}
      <Snackbar
        open={!!warning}
        autoHideDuration={5000}
        onClose={handleCloseWarning}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{ mt: 14 }}
      >
        <Alert
          onClose={handleCloseWarning}
          severity="warning"
          variant="filled"
          sx={{
            width: '80%',
            boxShadow: '0px 3px 8px rgba(0, 0, 0, 0.12)',
            backgroundColor: theme.palette.warning.main,
            color: theme.palette.warning.contrastText,
          }}
        >
          {warning}
        </Alert>
      </Snackbar>
      <Alert variant="outlined" severity="info" sx={{ my: 3 }}>
        Refer to{' '}
        <Link href="https://docs.pipeshub.com/ai-models/overview" target="_blank" rel="noopener">
          the documentation
        </Link>{' '}
        for more information.
      </Alert>
    </Container>
  );
};

export default AiModelsSettings;
