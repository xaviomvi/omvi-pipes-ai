import { useRef, useState } from 'react';

import {
  Box,
  alpha,
  Dialog,
  Button,
  useTheme,
  IconButton,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';

import { Iconify } from 'src/components/iconify';

import RedisConfigForm from './components/redis-config-form';
import KafkaConfigForm from './components/kafka-config-form';
import QdrantConfigForm from './components/qdrant-config-form';
import MongoDBConfigForm from './components/mongodb-config-form';
import ArangoDBConfigForm from './components/arangodb-config-form';
import BackendNodejsConfigForm from './components/backend-nodejs-config-form';

import type { RedisConfigFormRef } from './components/redis-config-form';
import type { KafkaConfigFormRef } from './components/kafka-config-form';
import type { QdrantConfigFormRef } from './components/qdrant-config-form';
import type { MongoDBConfigFormRef } from './components/mongodb-config-form';
import type { ArangoDBConfigFormRef } from './components/arangodb-config-form';
import type {
  BackendNodejsConfigFormRef,
} from './components/backend-nodejs-config-form';

// Method configurations
interface ServiceConfigType {
  [key: string]: {
    icon: string;
    title: string;
    color: string;
  };
}

const SERVICE_CONFIG: ServiceConfigType = {
  redis: {
    icon: 'logos:redis',
    title: 'Redis',
    color: '#DC382D',
  },
  kafka: {
    icon: 'mdi:apache-kafka',
    title: 'Kafka',
    color: '#231F20',
  },
  mongoDb: {
    icon: 'simple-icons:mongodb',
    title: 'MongoDB',
    color: '#47A248',
  },
  arangoDb: {
    icon: 'simple-icons:arangodb',
    title: 'ArangoDB',
    color: '#D12C2F',
  },
  qdrant: {
    icon: 'carbon:chart-3d',
    title: 'Qdrant',
    color: '#FF9800',
  },

  backendNodejs: {
    icon: 'mdi:nodejs',
    title: 'NodeJs Url',
    color: '#FF9800',
  },
};

interface ConfigureServiceDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  serviceType: string | null;
}

// Create a type for any form ref that has a handleSave method
type AnyFormRef = {
  handleSave: () => Promise<any>;
};

const ConfigureServiceDialog = ({
  open,
  onClose,
  onSave,
  serviceType,
}: ConfigureServiceDialogProps) => {
  const theme = useTheme();
  const [isValid, setIsValid] = useState(false);

  const kafkaConfigFormRef = useRef<KafkaConfigFormRef>(null);
  const redisConfigFormRef = useRef<RedisConfigFormRef>(null);
  const mongoDBConfigFormRef = useRef<MongoDBConfigFormRef>(null);
  const arangoDBConfigFormRef = useRef<ArangoDBConfigFormRef>(null);
  const qdrantConfigFormRef = useRef<QdrantConfigFormRef>(null);
  const backendNodejsConfigFormRef = useRef<BackendNodejsConfigFormRef>(null);

  // Get connector config if available
  const serviceConfig = serviceType ? SERVICE_CONFIG[serviceType] : null;

  // Form validation state
  const handleValidationChange = (valid: boolean) => {
    setIsValid(valid);
  };

  // Handle save button click - triggers the form's save method based on the active connector type
  const handleSaveClick = async () => {
    let currentRef: React.RefObject<AnyFormRef> | null = null;

    // Determine which form ref to use based on connector type
    switch (serviceType) {
      case 'kafka':
        currentRef = kafkaConfigFormRef;
        break;
      case 'redis':
        currentRef = redisConfigFormRef;
        break;
      case 'mongoDb':
        currentRef = mongoDBConfigFormRef;
        break;
      case 'arangoDb':
        currentRef = arangoDBConfigFormRef;
        break;
      case 'qdrant':
        currentRef = qdrantConfigFormRef;
        break;
      case 'backendNodejs':
        currentRef = backendNodejsConfigFormRef;
        break;
      default:
        currentRef = null;
    }

    // If we have a valid ref with handleSave method
    if (currentRef?.current?.handleSave) {
      const result = await currentRef.current.handleSave();
      // Don't call onSave if the result is explicitly false
      if (result !== false) {
        onSave();
      }
    }
  };

  // Handle successful save in forms
  const handleFormSaveSuccess = () => {
    onSave();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 1,
          boxShadow: '0 10px 35px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
        },
      }}
    >
      {serviceConfig && (
        <>
          <DialogTitle
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 2.5,
              pl: 3,
              color: theme.palette.text.primary,
              borderBottom: '1px solid',
              borderColor: theme.palette.divider,
              fontWeight: 500,
              fontSize: '1rem',
              m: 0,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: '6px',
                  bgcolor: alpha(serviceConfig.color, 0.1),
                  color: serviceConfig.color,
                }}
              >
                <Iconify icon={serviceConfig.icon} width={18} height={18} />
              </Box>
              Configure {serviceConfig.title} Integration
            </Box>

            <IconButton
              onClick={onClose}
              size="small"
              sx={{ color: theme.palette.text.secondary }}
              aria-label="close"
            >
              <Iconify icon="eva:close-outline" width={20} height={20} />
            </IconButton>
          </DialogTitle>

          <DialogContent
            sx={{
              p: 0,
              '&.MuiDialogContent-root': {
                pt: 3,
                px: 3,
                pb: 0,
              },
            }}
          >
            <Box>
              {serviceType === 'redis' && (
                <RedisConfigForm
                  onValidationChange={handleValidationChange}
                  onSaveSuccess={handleFormSaveSuccess}
                  ref={redisConfigFormRef}
                />
              )}
              {serviceType === 'kafka' && (
                <KafkaConfigForm
                  onValidationChange={handleValidationChange}
                  onSaveSuccess={handleFormSaveSuccess}
                  ref={kafkaConfigFormRef}
                />
              )}
              {serviceType === 'mongoDb' && (
                <MongoDBConfigForm
                  onValidationChange={handleValidationChange}
                  onSaveSuccess={handleFormSaveSuccess}
                  ref={mongoDBConfigFormRef}
                />
              )}
              {serviceType === 'arangoDb' && (
                <ArangoDBConfigForm
                  onValidationChange={handleValidationChange}
                  onSaveSuccess={handleFormSaveSuccess}
                  ref={arangoDBConfigFormRef}
                />
              )}
              {serviceType === 'qdrant' && (
                <QdrantConfigForm
                  onValidationChange={handleValidationChange}
                  onSaveSuccess={handleFormSaveSuccess}
                  ref={qdrantConfigFormRef}
                />
              )}
              {serviceType === 'backendNodejs' && (
                <BackendNodejsConfigForm
                  onValidationChange={handleValidationChange}
                  onSaveSuccess={handleFormSaveSuccess}
                  ref={backendNodejsConfigFormRef}
                />
              )}
            </Box>
          </DialogContent>

          <DialogActions
            sx={{
              p: 2.5,
              borderTop: '1px solid',
              borderColor: theme.palette.divider,
              bgcolor: alpha(theme.palette.background.default, 0.5),
            }}
          >
            <Button
              variant="text"
              onClick={onClose}
              sx={{
                color: theme.palette.text.secondary,
                fontWeight: 500,
                '&:hover': {
                  backgroundColor: alpha(theme.palette.divider, 0.8),
                },
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveClick}
              disabled={!isValid}
              sx={{
                bgcolor: theme.palette.primary.main,
                boxShadow: 'none',
                fontWeight: 500,
                '&:hover': {
                  bgcolor: theme.palette.primary.dark,
                  boxShadow: 'none',
                },
                px: 3,
              }}
            >
              Save
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};

export default ConfigureServiceDialog;
