import { Helmet } from 'react-helmet-async';
import { useState, useEffect, useCallback } from 'react';

import axios from 'src/utils/axios';

import { UserProvider } from 'src/context/UserContext';

import { ChatBotView } from 'src/sections/qna/view';

import { AuthProvider } from 'src/auth/context/jwt';

import ConfigurationStepper from '../configuration-stepper/configuration-stepper';

// ----------------------------------------------------------------------

const metadata = { title: `Ask Me Anything` };

export default function Page() {
  const [configDialog, setConfigDialog] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [onboardingStatus, setOnboardingStatus] = useState<string | null>(null);

  // Function to fetch onboarding status - using useCallback to prevent recreating on every render
  const fetchOnboardingStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`/api/v1/org/onboarding-status`);
      const { status } = response.data;

      if (!status) {
        throw new Error('No status found in the response');
      }

      // Store the status in state
      setOnboardingStatus(status);

      // Only show the configuration dialog if status is notConfigured
      if (status === 'notConfigured') {
        setConfigDialog(true);
      } else {
        setConfigDialog(false);
      }

      return status;
    } catch (error) {
      console.error('Error while fetching the onboarding status:', error);
      // If there's an error, we might want to default to showing the configuration
      // dialog to ensure the user can set up the system
      setConfigDialog(true);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle closing the configuration dialog
  const handleClose = useCallback(() => {
    // Just close the dialog - status updates are handled inside the ConfigurationStepper
    // via explicit button actions now
    setConfigDialog(false);

    // Refetch the status to make sure we have the latest status
    // This is important since the ConfigurationStepper may have updated it
    fetchOnboardingStatus();
  }, [fetchOnboardingStatus]);

  const handleOpen = useCallback(() => {
    setConfigDialog(true);
  }, []);

  useEffect(() => {
    // Fetch onboarding status when component mounts
    fetchOnboardingStatus();

    // Also set up an event listener for the beforeunload event
    // This will warn the user if they try to leave the page while configuration is open
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (configDialog) {
        // Standard way to show a confirmation dialog when leaving the page
        e.preventDefault();
        e.returnValue = ''; // Chrome requires returnValue to be set
        return ''; // This message is typically ignored by browsers for security reasons
      }
      return undefined; // Add a return here to satisfy the consistent-return rule
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Clean up event listener when component unmounts
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [fetchOnboardingStatus, configDialog]);

  return (
    <>
      <Helmet>
        <title> {metadata.title}</title>
      </Helmet>
      <AuthProvider>
        <UserProvider>
          <ConfigurationStepper open={configDialog} onClose={handleClose} />
          {!isLoading && <ChatBotView />}
        </UserProvider>
      </AuthProvider>
    </>
  );
}
