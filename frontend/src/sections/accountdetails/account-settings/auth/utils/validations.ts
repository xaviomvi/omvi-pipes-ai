// Define the authentication method type
export type AuthMethodType = 'password' | 'otp' | 'google' | 'microsoft' | 'azureAd' | 'samlSso';

// Define the structure for an authentication method
export interface AuthMethod {
  type: string;
  enabled: boolean;
}

// Define the configuration structure for an authentication method
export interface AuthMethodConfig {
  icon: string;
  title: string;
  description: string;
  color: string;
  configurable: boolean;
  requiresSmtp: boolean;
}

/**
 * Validates that only one authentication method is selected
 * @param {AuthMethod[]} enabledMethods - Array of enabled authentication methods
 * @returns {boolean} - True if validation passes, false otherwise
 */
export const validateSingleMethodSelection = (enabledMethods: AuthMethod[]): boolean =>
  enabledMethods.filter((method) => method.enabled).length === 1;

/**
 * Validates that OTP authentication can only be enabled if SMTP is configured
 * @param {AuthMethod[]} enabledMethods - Array of enabled authentication methods
 * @param {boolean} smtpConfigured - Whether SMTP is configured
 * @returns {boolean} - True if validation passes, false otherwise
 */
export const validateOtpConfiguration = (
  enabledMethods: AuthMethod[],
  smtpConfigured: boolean
): boolean => {
  // Check if OTP is enabled
  const isOtpEnabled = enabledMethods.some((method) => method.type === 'otp' && method.enabled);

  // If OTP is enabled, SMTP must be configured
  if (isOtpEnabled && !smtpConfigured) {
    return false;
  }

  return true;
};

/**
 * Gets the display name for an authentication method type
 * @param {AuthMethodType} type - The authentication method type
 * @returns {string} - The display name
 */
export const getMethodDisplayName = (type: AuthMethodType): string => {
  const methodNames: Record<AuthMethodType, string> = {
    password: 'Password',
    otp: 'One-Time Password',
    google: 'Google',
    microsoft: 'Microsoft',
    azureAd: 'Azure AD',
    samlSso: 'SAML SSO',
  };

  return methodNames[type] || type;
};

/**
 * Gets configuration details for an authentication method
 * @param {AuthMethodType} type - The authentication method type
 * @returns {AuthMethodConfig} - Configuration details
 */
export const getMethodConfig = (type: AuthMethodType): AuthMethodConfig => {
  const configs: Record<AuthMethodType, AuthMethodConfig> = {
    otp: {
      icon: 'mdi:cellphone-message',
      title: 'One-Time Password',
      description: 'Send a verification code via email',
      color: '#4A6CF7',
      configurable: false,
      requiresSmtp: true,
    },
    password: {
      icon: 'mdi:form-textbox-password',
      title: 'Password',
      description: 'Traditional email and password authentication',
      color: '#1E293B',
      configurable: false,
      requiresSmtp: false,
    },
    google: {
      icon: 'mdi:google',
      title: 'Google',
      description: 'Allow users to sign in with Google accounts',
      color: '#EA4335',
      configurable: true,
      requiresSmtp: false,
    },
    microsoft: {
      icon: 'mdi:microsoft',
      title: 'Microsoft',
      description: 'Allow users to sign in with Microsoft accounts',
      color: '#00A4EF',
      configurable: true,
      requiresSmtp: false,
    },
    azureAd: {
      icon: 'mdi:microsoft-azure',
      title: 'Azure AD',
      description: 'Enterprise authentication via Azure Active Directory',
      color: '#0078D4',
      configurable: true,
      requiresSmtp: false,
    },
    samlSso: {
      icon: 'mdi:shield-account',
      title: 'SAML SSO',
      description: 'Single Sign-On with SAML protocol',
      color: '#FF6B00',
      configurable: true,
      requiresSmtp: false,
    },
  };

  return (
    configs[type] || {
      icon: '',
      title: type,
      description: '',
      color: '#000000',
      configurable: false,
      requiresSmtp: false,
    }
  );
};
