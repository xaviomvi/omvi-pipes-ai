import React, { useRef, useState, useEffect } from 'react';

import {
  Step,
  Alert,
  Button,
  Dialog,
  Stepper,
  useTheme,
  StepLabel,
  Typography,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';

import axios from 'src/utils/axios';

import { useAuthContext } from 'src/auth/hooks';

import LlmConfigStep from './llm-config';
import SmtpConfigStep from './smtp-config';
import {
  storageTypes,
} from './types';
import StorageConfigStep from './storage-config';
import ConnectorConfigStep from './connector-config';

import type {
  LlmFormValues,
  SmtpFormValues,
  StorageFormValues,
  AzureLlmFormValues,
  OpenAILlmFormValues,
  ConnectorFormValues} from './types';

// Updated steps to include Storage
const steps: string[] = ['LLM', 'Storage', 'Connector', 'SMTP'];

// API base URLs
const API_BASE_URL = '/api/v1/configurationManager';
const ORG_API_BASE_URL = '/api/v1/org';

interface ConfigurationStepperProps {
  open: boolean;
  onClose: () => void;
}

const ConfigurationStepper: React.FC<ConfigurationStepperProps> = ({ open, onClose }) => {
  const theme = useTheme();
  const { user } = useAuthContext();
  const accountType = user?.accountType || 'individual';

  const [activeStep, setActiveStep] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<string>('');
  const [submissionSuccess, setSubmissionSuccess] = useState<boolean>(false);

  // Use a ref to track if onboarding status has been updated
  // This prevents redundant API calls
  const statusUpdated = useRef<boolean>(false);

  // Track which steps are being skipped
  const [skipSteps, setSkipSteps] = useState<{
    llm: boolean; // This will always be false now (required)
    storage: boolean; // Add storage step
    connector: boolean;
    smtp: boolean;
  }>({
    llm: false,
    storage: false,
    connector: false,
    smtp: false,
  });

  // State to hold form values from each step
  const [llmValues, setLlmValues] = useState<LlmFormValues | null>(null);
  const [storageValues, setStorageValues] = useState<StorageFormValues | null>(null);
  const [connectorValues, setConnectorValues] = useState<ConnectorFormValues | null>(null);
  const [smtpValues, setSmtpValues] = useState<SmtpFormValues | null>(null);
  const [serviceCredentialsFile, setServiceCredentialsFile] = useState<File | null>(null);

  // Reset state when dialog is opened
  useEffect(() => {
    if (open) {
      setActiveStep(0);
      setSubmissionSuccess(false);
      setSubmissionError('');
      // Reset the statusUpdated flag when dialog opens
      statusUpdated.current = false;
      // Reset skip states
      setSkipSteps({
        llm: false,
        storage: false,
        connector: false,
        smtp: false,
      });
    }
  }, [open]);

  // Function to update onboarding status via API, only if not already updated
  // This function should ONLY be called when explicitly needed via button clicks
  const updateOnboardingStatus = async (status: 'configured' | 'skipped'): Promise<void> => {
    if (statusUpdated.current) {
      console.log('Onboarding status already updated, skipping API call');
      return;
    }

    try {
      await axios.put(`${ORG_API_BASE_URL}/onboarding-status`, { status });
      console.log(`Onboarding status updated to: ${status}`);
      statusUpdated.current = true;
    } catch (error) {
      console.error('Failed to update onboarding status:', error);
      throw error;
    }
  };

  // Intercept the close action - ONLY update status if explicitly canceling via button
  const handleCloseWithStatus = async () => {
    try {
      setIsSubmitting(true);
      // Only update status to 'skipped' when explicitly clicking Cancel
      await updateOnboardingStatus('skipped');
    } catch (error) {
      console.error('Error updating onboarding status:', error);
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  // This is called when the user clicks the X or clicks outside the dialog
  // We should NOT update the status in this case
  const handleCloseNoStatus = () => {
    // Just close without updating status
    onClose();
  };

  const handleSkipStep = (step: 'storage' | 'connector' | 'smtp'): void => {
    // Cannot skip LLM step anymore
    setSkipSteps((prev) => ({ ...prev, [step]: true }));

    // If skipping storage, set default local storage values
    if (step === 'storage') {
      const defaultLocalStorage: StorageFormValues = {
        storageType: storageTypes.LOCAL,
        mountName: '',
        baseUrl: '',
      };
      setStorageValues(defaultLocalStorage);
      console.log('Storage step skipped, defaulting to local storage');
    }

    // If this is the last step, we need to submit the configs after skipping
    if (step === 'smtp' && activeStep === 3) {
      // Final step was skipped, so submit all configurations
      submitAllConfigurations();
    } else {
      // Move to the next step when skipping a non-final step
      // Using setTimeout to ensure state is updated before handleNext runs
      setTimeout(() => {
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
      }, 0);
    }
  };

  const handleNext = async (): Promise<void> => {
    // For LLM step, verify we have values before continuing
    if (activeStep === 0) {
      if (!llmValues) {
        // Try to submit the LLM form first
        const llmFormSubmitted = await submitLlmForm();
        if (!llmFormSubmitted) {
          setSubmissionError('LLM configuration is required before proceeding.');
          return;
        }
      }
      // Successfully have LLM values, go to next step
      setActiveStep(1);
      return;
    }

    // For Storage step
    if (activeStep === 1) {
      // If already marked as skipped, just go to the next step
      if (skipSteps.storage) {
        setActiveStep(2);
        return;
      }

      // Otherwise, try to submit the form or skip
      if (!storageValues) {
        const storageFormSubmitted = await submitStorageForm();
        if (!storageFormSubmitted) {
          // Storage is not required, so skip if invalid
          handleSkipStep('storage');
          return;
        }
      }
      setActiveStep(2);
      return;
    }

    // For Connector step
    if (activeStep === 2) {
      // If already marked as skipped, just go to the next step
      if (skipSteps.connector) {
        setActiveStep(3);
        return;
      }

      // Otherwise, try to submit the form or skip
      if (!connectorValues) {
        const connectorFormSubmitted = await submitConnectorForm();
        if (!connectorFormSubmitted) {
          handleSkipStep('connector');
          return;
        }
      }
      setActiveStep(3);
    }
  };

  const handleBack = (): void => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleLlmSubmit = (data: LlmFormValues): void => {
    setLlmValues(data);
    setSkipSteps((prev) => ({ ...prev, llm: false })); // Ensure it's marked as not skipped

    // Give time for state to update before moving to next step
    setTimeout(() => {
      // If this is the last step (shouldn't happen normally, but just in case)
      if (activeStep === steps.length - 1) {
        submitAllConfigurations();
      } else {
        handleNext();
      }
    }, 0);
  };

  // Handle storage step submission
  const handleStorageSubmit = (data: StorageFormValues): void => {
    setStorageValues(data);
    setSkipSteps((prev) => ({ ...prev, storage: false })); // Ensure it's marked as not skipped

    // Give time for state to update before moving to next step
    setTimeout(() => {
      // If this is the last step (shouldn't happen normally, but just in case)
      if (activeStep === steps.length - 1) {
        submitAllConfigurations();
      } else {
        handleNext();
      }
    }, 0);
  };

  const handleConnectorSubmit = (data: ConnectorFormValues, file: File | null): void => {
    setConnectorValues(data);
    setServiceCredentialsFile(file);
    setSkipSteps((prev) => ({ ...prev, connector: false })); // Ensure it's marked as not skipped

    // Give time for state to update before moving to next step
    setTimeout(() => {
      // If this is the last step (shouldn't happen normally, but just in case)
      if (activeStep === steps.length - 1) {
        submitAllConfigurations();
      } else {
        handleNext();
      }
    }, 0);
  };

  const handleSmtpSubmit = (data: SmtpFormValues): void => {
    setSmtpValues(data);
    setSkipSteps((prev) => ({ ...prev, smtp: false })); // Ensure it's marked as not skipped

    // When the last step is completed, submit all configurations
    // Give time for state to update before submitting
    setTimeout(() => {
      submitAllConfigurations(data);
    }, 0);
  };

  // Submit LLM form programmatically
  const submitLlmForm = async (): Promise<boolean> => {
    // Method 1: Use the window method if available
    if (typeof (window as any).submitLlmForm === 'function') {
      const result = (window as any).submitLlmForm();
      // Wait for state to update
      await new Promise((resolve) => setTimeout(resolve, 100));
      return result || !!llmValues;
    }

    // Method 2: Find and click the "Continue" button in the LLM form
    const llmContinueButton = document.querySelector('#llm-config-form button[type="submit"]');

    if (llmContinueButton) {
      (llmContinueButton as HTMLButtonElement).click();
      // We need to wait a small amount of time for the form submission to complete
      // and update the llmValues state
      await new Promise((resolve) => setTimeout(resolve, 100));
      return !!llmValues;
    }

    // If we already have values, we're good
    if (llmValues) {
      return true;
    }

    return false;
  };

  // Submit Storage form programmatically
  const submitStorageForm = async (): Promise<boolean> => {
    // Method 1: Use the window method if available
    if (typeof (window as any).submitStorageForm === 'function') {
      const result = (window as any).submitStorageForm();
      // Wait for state to update
      await new Promise((resolve) => setTimeout(resolve, 100));
      return result || !!storageValues;
    }

    // Method 2: Find and click the "Continue" button in the storage form
    const storageSubmitButton = document.querySelector(
      '#storage-config-form button[type="submit"]'
    );

    if (storageSubmitButton) {
      (storageSubmitButton as HTMLButtonElement).click();
      await new Promise((resolve) => setTimeout(resolve, 100));
      return !!storageValues;
    }

    // If we already have values, we're good
    if (storageValues) {
      return true;
    }

    return false;
  };

  // Submit Connector form programmatically
  const submitConnectorForm = async (): Promise<boolean> => {
    // Method 1: Use the window method if available
    if (typeof (window as any).submitConnectorForm === 'function') {
      const result = (window as any).submitConnectorForm();
      // Wait for state to update
      await new Promise((resolve) => setTimeout(resolve, 100));
      return result || !!connectorValues;
    }

    // Method 2: Find and click the "Continue" button in the connector form
    const connectorContinueButton = document.querySelector(
      '#connector-config-form button[type="submit"]'
    );

    if (connectorContinueButton) {
      (connectorContinueButton as HTMLButtonElement).click();
      await new Promise((resolve) => setTimeout(resolve, 100));
      return !!connectorValues;
    }

    // If we already have values, we're good
    if (connectorValues) {
      return true;
    }

    return false;
  };

  // Submit all configurations at once
  const submitAllConfigurations = async (smtpData?: SmtpFormValues): Promise<void> => {
    try {
      setIsSubmitting(true);
      setSubmissionError('');
      setSubmissionSuccess(false);

      console.log('Submitting configurations...');
      console.log('LLM Values:', llmValues); // LLM is now required
      console.log('Storage Values:', storageValues);
      console.log('Connector Skipped:', skipSteps.connector, 'Connector Values:', connectorValues);
      console.log('SMTP Skipped:', skipSteps.smtp, 'SMTP Values:', smtpValues || smtpData);

      // Make sure we have LLM values (required)
      if (!llmValues) {
        // Try to submit the LLM form
        const llmFormSubmitted = await submitLlmForm();
        if (!llmFormSubmitted) {
          setSubmissionError(
            'LLM configuration is required. Please complete the LLM configuration.'
          );
          setIsSubmitting(false);
          return;
        }
      }

      // If storage is skipped and no storage values, set default local storage
      if (skipSteps.storage && !storageValues) {
        const defaultLocalStorage: StorageFormValues = {
          storageType: storageTypes.LOCAL,
          mountName: '',
          baseUrl: '',
        };
        setStorageValues(defaultLocalStorage);
      }

      const apiCalls = [];

      // Prepare LLM config API call (always required)
      // Prepare LLM config API call (always required)
      const llmConfig = {
        llm: [
          {
            name: llmValues!.modelType === 'openai' ? 'OpenAI' : 'Azure OpenAI',
            configuration:
              llmValues!.modelType === 'openai'
                ? {
                    // OpenAI configuration
                    clientId: (llmValues as OpenAILlmFormValues).clientId,
                    apiKey: llmValues!.apiKey,
                    model: llmValues!.model,
                  }
                : {
                    // Azure OpenAI configuration
                    endpoint: (llmValues as AzureLlmFormValues).endpoint,
                    apiKey: llmValues!.apiKey,
                    deploymentName: (llmValues as AzureLlmFormValues).deploymentName,
                    model: llmValues!.model,
                  },
          },
        ],
        // Include other model types with empty arrays to match API format
        ocr: [],
        embedding: [],
        slm: [],
        reasoning: [],
        multiModal: [],
      };

      console.log('Adding LLM API call with config:', llmConfig);
      apiCalls.push(axios.post(`${API_BASE_URL}/aiModelsConfig`, llmConfig));

      // Prepare Storage config API call - we'll always have storage values now
      // (either user-entered or default local)
      if (storageValues) {
        // Prepare the payload based on storage type
        let storageConfig: any;

        switch (storageValues.storageType) {
          case storageTypes.S3:
            storageConfig = {
              storageType: storageValues.storageType,
              s3AccessKeyId: storageValues.s3AccessKeyId,
              s3SecretAccessKey: storageValues.s3SecretAccessKey,
              s3Region: storageValues.s3Region,
              s3BucketName: storageValues.s3BucketName,
            };
            break;
          case storageTypes.AZURE_BLOB:
            storageConfig = {
              storageType: storageValues.storageType,
              endpointProtocol: storageValues.endpointProtocol || 'https',
              accountName: storageValues.accountName,
              accountKey: storageValues.accountKey,
              endpointSuffix: storageValues.endpointSuffix || 'core.windows.net',
              containerName: storageValues.containerName,
            };
            break;
          default:
            // Local storage
            storageConfig = {
              storageType: storageTypes.LOCAL,
              mountName: storageValues.mountName || '',
              baseUrl: storageValues.baseUrl || '',
            };
        }

        console.log('Adding Storage API call with config:', storageConfig);
        apiCalls.push(
          axios.post(`${API_BASE_URL}/storageConfig`, storageConfig, {
            headers: {
              'Content-Type': 'application/json',
            },
          })
        );
      }

      // Prepare Google Workspace config API call if not skipped and has values
      if (!skipSteps.connector && connectorValues) {
        if (accountType === 'business') {
          // Business account with file upload
          if (serviceCredentialsFile) {
            const formData = new FormData();
            formData.append('file', serviceCredentialsFile);

            if (connectorValues.googleWorkspace?.serviceCredentials) {
              // If we have parsed data from the file, include it
              const serviceAccount = {
                clientId: connectorValues.googleWorkspace.clientId,
                clientEmail: connectorValues.googleWorkspace.clientEmail,
                privateKey: connectorValues.googleWorkspace.privateKey,
                projectId: connectorValues.googleWorkspace.projectId,
              };

              formData.append('serviceAccount', JSON.stringify(serviceAccount));
            }

            console.log('Adding Google Workspace API call with file for business account');
            apiCalls.push(
              axios.post(`${API_BASE_URL}/googleWorkspaceConfig`, formData, {
                headers: {
                  'Content-Type': 'multipart/form-data',
                },
              })
            );
          }
        } else if (
          connectorValues.googleWorkspace?.clientId &&
          connectorValues.googleWorkspace?.clientSecret &&
          connectorValues.googleWorkspace?.redirectUri
        ) {
          // Individual account with manual entry or file upload (that populated form fields)
          const payload = {
            clientId: connectorValues.googleWorkspace.clientId,
            clientSecret: connectorValues.googleWorkspace.clientSecret,
            redirectUri: connectorValues.googleWorkspace.redirectUri,
          };

          console.log('Adding Google Workspace OAuth config API call for individual account');
          apiCalls.push(
            axios.post(`${API_BASE_URL}/connectors/googleWorkspaceOauthConfig`, payload, {
              headers: {
                'Content-Type': 'application/json',
              },
            })
          );
        }
      }

      // Prepare SMTP config API call if not skipped and has values
      // Either use the provided smtpData or the stored smtpValues
      const finalSmtpData = smtpData || smtpValues;
      if (!skipSteps.smtp && finalSmtpData) {
        const smtpConfig = {
          host: finalSmtpData.host,
          port: Number(finalSmtpData.port),
          username: finalSmtpData.username || undefined,
          password: finalSmtpData.password || undefined,
          fromEmail: finalSmtpData.fromEmail,
        };

        console.log('Adding SMTP API call with config:', smtpConfig);
        apiCalls.push(axios.post(`${API_BASE_URL}/smtpConfig`, smtpConfig));
      }

      // Execute all API calls in parallel
      console.log(`Executing ${apiCalls.length} API calls...`);
      if (apiCalls.length > 0) {
        await Promise.all(apiCalls);
        console.log('All API calls completed successfully');

        // Update onboarding status to 'configured' - explicitly calling after successful submission
        await updateOnboardingStatus('configured');

        setSubmissionSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        // Should not happen anymore since LLM is required
        console.log('No API calls to make - all steps skipped or incomplete');
        setSubmissionError('No configurations were set. Please configure at least one service.');
      }
    } catch (error: any) {
      console.error('Error submitting configuration:', error);
      setSubmissionError(
        error.response?.data?.message || 'An error occurred while saving configurations'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler for skipping the entire configuration
  const handleSkipConfiguration = async (): Promise<void> => {
    try {
      setIsSubmitting(true);

      // Update onboarding status to 'skipped' - explicitly calling when user clicks Skip Configuration
      await updateOnboardingStatus('skipped');

      setSubmissionSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Error skipping configuration:', error);
      setSubmissionError('Failed to skip the configuration process. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = (step: number): React.ReactNode => {
    switch (step) {
      case 0:
        return (
          <LlmConfigStep
            onSubmit={handleLlmSubmit}
            onSkip={() => {}} // LLM can no longer be skipped
            initialValues={llmValues}
          />
        );
      case 1:
        return (
          <StorageConfigStep
            onSubmit={handleStorageSubmit}
            onSkip={() => handleSkipStep('storage')}
            initialValues={storageValues}
          />
        );
      case 2:
        return (
          <ConnectorConfigStep
            onSubmit={handleConnectorSubmit}
            onSkip={() => handleSkipStep('connector')}
            initialValues={connectorValues}
            initialFile={serviceCredentialsFile}
          />
        );
      case 3:
        return (
          <SmtpConfigStep
            onSubmit={handleSmtpSubmit}
            onSkip={() => handleSkipStep('smtp')}
            isSubmitting={isSubmitting}
            initialValues={smtpValues}
          />
        );
      default:
        return null;
    }
  };

  const renderFooterButtons = () => {
    if (submissionSuccess) {
      return null; // No buttons needed when submission is successful
    }

    // Determine if the Continue/Complete Setup button should be enabled
    const primaryButtonEnabled = () => {
      // If submitting, always disable
      if (isSubmitting) return false;

      // For LLM step (first step) - always enable to allow validation on click
      if (activeStep === 0) {
        return true;
      }

      // For other steps, LLM must be configured (which it should be if we got here)
      return true;
    };

    return (
      <>
        {/* Show "Skip Configuration" on the last step, and Cancel only in steps after LLM config */}
        {activeStep === 3 ? (
          <Button
            onClick={handleSkipConfiguration}
            disabled={isSubmitting}
            sx={{ mr: 1 }}
            color="inherit"
          >
            Skip Configuration
          </Button>
        ) : (
          // Only show Cancel button after the first step (LLM configuration)
          activeStep > 0 && (
            <Button onClick={handleCloseWithStatus} disabled={isSubmitting} sx={{ mr: 1 }}>
              Cancel
            </Button>
          )
        )}

        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={isSubmitting} sx={{ mr: 1 }}>
            Back
          </Button>
        )}

        {/* Show Skip button for all steps except LLM */}
        {activeStep > 0 && activeStep < steps.length && (
          <Button
            color="inherit"
            onClick={() => {
              switch (activeStep) {
                case 1:
                  handleSkipStep('storage');
                  break;
                case 2:
                  handleSkipStep('connector');
                  break;
                case 3:
                  handleSkipStep('smtp');
                  break;
                default:
                  break;
              }
            }}
            disabled={isSubmitting}
            sx={{ mr: 1 }}
          >
            Skip
          </Button>
        )}

        {/* Primary action button */}
        <Button
          variant="contained"
          color="primary"
          onClick={async () => {
            switch (activeStep) {
              case 0: {
                // LLM
                const llmSuccess = await submitLlmForm();
                if (!llmSuccess) {
                  setSubmissionError('LLM configuration is required.');
                }
                break;
              }
              case 1: {
                // Storage
                const storageSuccess = await submitStorageForm();
                if (!storageSuccess) {
                  // If form validation fails, skip this step
                  handleSkipStep('storage');
                }
                break;
              }
              case 2: {
                // Connector
                const connectorSuccess = await submitConnectorForm();
                if (!connectorSuccess) {
                  // If form validation fails, skip this step
                  handleSkipStep('connector');
                }
                break;
              }
              case 3: {
                // SMTP
                handleManualSubmit();
                break;
              }
              default: {
                break;
              }
            }
          }}
          disabled={!primaryButtonEnabled()}
          startIcon={isSubmitting ? <CircularProgress size={16} /> : null}
        >
          {isSubmitting
            ? 'Saving...'
            : activeStep === steps.length - 1
              ? 'Complete Setup'
              : 'Continue'}
        </Button>
      </>
    );
  };

  // Get the completion status for the stepper
  const getStepStatus = (stepIndex: number): 'completed' | 'active' | undefined => {
    if (activeStep === stepIndex) return 'active';

    // Mark steps as completed if either they're done or skipped
    if (stepIndex < activeStep) {
      switch (stepIndex) {
        case 0:
          return llmValues ? 'completed' : undefined; // LLM can't be skipped
        case 1:
          return skipSteps.storage || storageValues ? 'completed' : undefined;
        case 2:
          return skipSteps.connector || connectorValues ? 'completed' : undefined;
        default:
          return undefined;
      }
    }

    return undefined;
  };

  const handleManualSubmit = async () => {
    console.log('Manual submit button clicked');

    // Verify LLM is configured - required now
    if (!llmValues) {
      setSubmissionError('LLM configuration is required.');
      return;
    }

    // If we're on the last step (SMTP)
    if (activeStep === 3) {
      // If not skipping SMTP, try to submit the form
      if (!skipSteps.smtp) {
        try {
          if (typeof (window as any).submitSmtpForm === 'function') {
            console.log('Trying to submit SMTP form via window method');
            const isValid = (window as any).submitSmtpForm();

            // If form is invalid, skip this step since LLM is already configured
            if (!isValid) {
              console.log('SMTP form invalid, proceeding with LLM only');
              // Mark SMTP as skipped since we can't validate it
              setSkipSteps((prev) => ({ ...prev, smtp: true }));
              // Submit all configurations without SMTP
              await submitAllConfigurations();
            } else {
              // If SMTP form is valid, it already called onSubmit which will call submitAllConfigurations
              console.log('SMTP form valid, continuing with normal flow');
            }
          } else {
            // Fallback: No submitSmtpForm method, but we can proceed with LLM
            console.log('No submitSmtpForm method found, proceeding with LLM');
            setSkipSteps((prev) => ({ ...prev, smtp: true }));
            await submitAllConfigurations();
          }
        } catch (error) {
          console.error('Error submitting SMTP form:', error);
          // We can proceed without SMTP since LLM is configured
          setSkipSteps((prev) => ({ ...prev, smtp: true }));
          await submitAllConfigurations();
        }
      } else {
        // SMTP is already skipped, just submit with LLM
        console.log('SMTP already skipped, proceeding with LLM');
        await submitAllConfigurations();
      }
    } else {
      // For other cases, just submit all configurations
      console.log('Submitting all configurations directly');
      await submitAllConfigurations();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={(event, reason) => {
        // Only close if not clicking outside
        if (reason !== 'backdropClick') {
          handleCloseNoStatus();
        }
      }}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 1,
        },
      }}
      // Prevent closing by pressing escape for important configuration
      disableEscapeKeyDown
    >
      <DialogTitle sx={{ px: 3, pt: 2, pb: 2 }}>
        <Typography variant="h6">System Configuration</Typography>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pt: 2, pb: 1 }}>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
          {steps.map((label, index) => (
            <Step key={label} completed={getStepStatus(index) === 'completed'}>
              <StepLabel>
                {label}
                {/* No "Skipped" label for LLM anymore since it's required */}
                {skipSteps.storage && index === 1 && (
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                    (Skipped)
                  </Typography>
                )}
                {skipSteps.connector && index === 2 && (
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                    (Skipped)
                  </Typography>
                )}
                {skipSteps.smtp && index === 3 && (
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                    (Skipped)
                  </Typography>
                )}
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        {submissionSuccess ? (
          <Alert severity="success" sx={{ mt: 2 }}>
            Configuration saved successfully.
          </Alert>
        ) : (
          <>
            {submissionError && (
              <Alert severity="error" sx={{ mb: 3 }} onClose={() => setSubmissionError('')}>
                {submissionError}
              </Alert>
            )}
            {renderStepContent(activeStep)}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>{renderFooterButtons()}</DialogActions>
    </Dialog>
  );
};

export default ConfigurationStepper;
