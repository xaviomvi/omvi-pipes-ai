import { paths } from 'src/routes/paths';

import axios from 'src/utils/axios';

import { CONFIG } from 'src/config-global';

import { STORAGE_KEY, SESSION_TOKEN_KEY, STORAGE_KEY_REFRESH } from './constant';

// ----------------------------------------------------------------------

export type sessionParams = {
  accessToken: string | null;
  refreshToken: string | null;
};

export function jwtDecode(token: string | null) {
  try {
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length < 2) {
      throw new Error('Invalid token!');
    }

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(base64));

    return decoded;
  } catch (error) {
    throw new Error('Error decoding jwt token',error);
  }
}

// ----------------------------------------------------------------------

export async function isValidToken(accessToken: string): Promise<boolean> {
  if (!accessToken) {
    return false;
  }

  try {
    const decoded = jwtDecode(accessToken);

    if (!decoded || !('exp' in decoded)) {
      return false;
    }

    const currentTime = Date.now() / 1000;

    if (decoded.exp < currentTime) {
      const refreshToken = localStorage.getItem(STORAGE_KEY_REFRESH);
      if (!refreshToken) return false;
      try {
        const res = await axios.post(
          `${CONFIG.authUrl}/api/v1/userAccount/refresh/token`,
          {},
          {
            headers: {
              Authorization: `Bearer ${refreshToken}`,
            },
          }
        );
        setSession(res.data.accessToken, refreshToken);
        return true;
      } catch (error) {
        return false;
      }
    }

    return true;
  } catch (error) {
    return false;
  }
}

// ----------------------------------------------------------------------

export function tokenExpired(exp: number): void {
  const currentTime = Date.now();
  const timeLeft = exp * 1000 - currentTime;
  const refreshTime = timeLeft - 2 * 60 * 1000;

  setTimeout(async () => {
    const refreshToken = localStorage.getItem(STORAGE_KEY_REFRESH);

    if (!refreshToken) {
      console.error('No refresh token found. Unable to refresh access token');
      alert('session expired please sign in again');
      localStorage.removeItem(STORAGE_KEY);
      window.location.href = paths.auth.jwt.signIn;
    }
    try {
      const res = await axios.post(
        `${CONFIG.authUrl}/api/v1/userAccount/refresh/token`,
        {},
        {
          headers: {
            Authorization: `Bearer ${refreshToken}`,
          },
        }
      );
      setSession(res.data.accessToken, refreshToken);
    } catch (error) {
      alert('session expired. PLease signin again');
      localStorage.removeItem(STORAGE_KEY);
      window.location.href = paths.auth.jwt.signIn;
      throw error;
    }
  }, refreshTime);
}

// ----------------------------------------------------------------------

export async function setSessionToken(sessionToken: string | null): Promise<void> {
  try {
    if (sessionToken) {
      sessionStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
      axios.defaults.headers.common['x-session-token'] = sessionToken;
    } else {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
      delete axios.defaults.headers.common['x-session-token'];
    }
  } catch (error) {
    throw new Error('Error setting session token');
  }
}

export async function setSession(
  accessToken: string | null,
  refreshToken: string | null
): Promise<void> {
  try {
    if (accessToken && refreshToken) {
      localStorage.setItem(STORAGE_KEY, accessToken);
      localStorage.setItem(STORAGE_KEY_REFRESH, refreshToken);

      axios.defaults.headers.common.Authorization = `Bearer ${accessToken}`;

      const decodedToken = jwtDecode(accessToken);

      if (decodedToken && 'exp' in decodedToken) {
        tokenExpired(decodedToken.exp);
      } else {
        throw new Error('Invalid access token!');
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY_REFRESH);
      delete axios.defaults.headers.common.Authorization;
    }
  } catch (error) {
    throw new Error('Error during set session');
  }
}
