import type { AxiosRequestConfig } from 'axios';

import axios from 'axios';

import { CONFIG } from 'src/config-global';

// ----------------------------------------------------------------------

// Error types for better classification
export enum ErrorType {
  SERVER_ERROR = 'SERVER_ERROR', // 5xx errors
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR', // 401, 403 errors
  VALIDATION_ERROR = 'VALIDATION_ERROR', // 400 errors with validation issues
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR', // 404 errors
  NETWORK_ERROR = 'NETWORK_ERROR', // Connection issues
  TIMEOUT_ERROR = 'TIMEOUT_ERROR', // Request timeout
  UNKNOWN_ERROR = 'UNKNOWN_ERROR', // Fallback for other errors
}

// Standardized error response
export interface ProcessedError {
  type: ErrorType;
  message: string;
  statusCode?: number;
  details?: Record<string, any>;
  retry?: boolean; // Flag indicating if this error can be retried
}

// Create axios instance with config
const axiosInstance = axios.create({ baseURL: CONFIG.backendUrl });

// Enhanced error handling in interceptor
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Default error structure

    const processedError: ProcessedError = {
      type: ErrorType.UNKNOWN_ERROR,
      message:
        error?.response?.data?.error?.message || 'Something went wrong. Please try again later.',
      retry: false,
    };

    // Axios error with response from server
    if (axios.isAxiosError(error)) {
      // Connection or timeout errors (no response)
      if (!error.response) {
        if (error.code === 'ECONNABORTED') {
          processedError.type = ErrorType.TIMEOUT_ERROR;
          processedError.message = 'Request timed out. Please try again.';
          processedError.retry = true;
        } else if (error.message && error.message.includes('Network Error')) {
          processedError.type = ErrorType.NETWORK_ERROR;
          processedError.message =
            'Unable to connect to server. Please check your internet connection.';
          processedError.retry = true;
        }
      }
      // Server responded with an error status
      else if (error.response) {
        processedError.statusCode = error.response.status;

        // Set message and details from response if available
        if (error.response.data) {
          if (typeof error.response.data === 'string') {
            processedError.message = error.response.data;
          } else if (error.response.data.message) {
            processedError.message = error.response.data.message;
            processedError.details = error.response.data;
          }
        }

        // Categorize by status code
        if (error.response.status >= 500) {
          processedError.type = ErrorType.SERVER_ERROR;
          processedError.message =
            processedError.message || 'The server encountered an error. Please try again later.';
          processedError.retry = true;
        } else if (error.response.status === 401 || error.response.status === 403) {
          processedError.type = ErrorType.AUTHENTICATION_ERROR;
          processedError.message =
            processedError.message || 'Authentication failed. Please sign in again.';
        } else if (error.response.status === 404) {
          processedError.type = ErrorType.NOT_FOUND_ERROR;
          processedError.message =
            processedError.message || 'The requested resource was not found.';
        } else if (error.response.status === 400) {
          processedError.type = ErrorType.VALIDATION_ERROR;
          processedError.message =
            processedError.message || 'Invalid input data. Please check and try again.';
        }
      }
    }
    // Handle non-axios errors
    else if (error instanceof Error) {
      processedError.message = error.message;
    }

    return Promise.reject(processedError);
  }
);

export default axiosInstance;

// ----------------------------------------------------------------------

export const fetcher = async (args: string | [string, AxiosRequestConfig]) => {
  try {
    const [url, config] = Array.isArray(args) ? args : [args];
    const res = await axiosInstance.get(url, { ...config });
    return res.data;
  } catch (error) {
    console.error('Failed to fetch:', error);
    throw error;
  }
};

// ----------------------------------------------------------------------

export const endpoints = {
  chat: '/api/chat',
  kanban: '/api/kanban',
  calendar: '/api/calendar',
  auth: {
    me: '/api/auth/me',
    signIn: '/api/auth/sign-in',
    signUp: '/api/auth/sign-up',
  },
  mail: {
    list: '/api/mail/list',
    details: '/api/mail/details',
    labels: '/api/mail/labels',
  },
  post: {
    list: '/api/post/list',
    details: '/api/post/details',
    latest: '/api/post/latest',
    search: '/api/post/search',
  },
  product: {
    list: '/api/product/list',
    details: '/api/product/details',
    search: '/api/product/search',
  },
};

// Helper function to wrap API calls with error handling
export async function withErrorHandling<T>(
  apiCall: () => Promise<T>,
  errorCallback?: (error: ProcessedError) => void
): Promise<T> {
  try {
    return await apiCall();
  } catch (error) {
    // Error is already processed by our interceptor
    if (errorCallback && (error as ProcessedError).type) {
      errorCallback(error as ProcessedError);
    }
    throw error;
  }
}
