// types/auth.ts
import type { ReactNode } from 'react';

export type UserType = Record<string, any> | null;

export type AuthState = {
  user: UserType;
  loading: boolean;
};

export type AuthContextValue = {
  user: UserType;
  loading: boolean;
  authenticated: boolean;
  unauthenticated: boolean;
  checkUserSession?: () => Promise<void>;
};




export interface AuthResponse {
  currentStep: number;
  allowedMethods: AuthMethod[];
  message: string;
  authProviders: Record<string, any>;
}

export type AuthMethod = 
  | 'password' 
  | 'otp' 
  | 'samlSso' 
  | 'google' 
  | 'microsoft' 
  | 'azureAd';

export interface TabPanelProps {
  children?: ReactNode;
  value: number;
  index: number;
}

export interface AuthMethodConfig {
  icon: string;
  label: string;
  component: React.ComponentType<AuthComponentProps>;
}

export interface SocialConfig {
  icon: string;
  label: string;
  color: string;
}

export interface AuthComponentProps {
  email: string;
  onForgotPassword?: () => void;
}

export interface StyleConfig {
  [key: string]: any;
}