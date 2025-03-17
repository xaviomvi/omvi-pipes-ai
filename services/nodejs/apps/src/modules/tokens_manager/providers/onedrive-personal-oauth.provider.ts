import { ConfidentialClientApplication } from '@azure/msal-node';
import { OAuthConfig, TokenData } from '../types/oauth.types';
import { BaseOAuthProvider } from './base-oauth.provider';

export class OneDrivePersonalOAuthProvider extends BaseOAuthProvider {
  private client: ConfidentialClientApplication;

  constructor(config: OAuthConfig) {
    super(config);
    this.client = new ConfidentialClientApplication({
      auth: {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        authority: 'https://login.microsoftonline.com/common', // Keep as 'common' for both personal and work accounts
      },
    });
  }

  async getAuthUrl(): Promise<string> {
    return this.client.getAuthCodeUrl({
      scopes: this.config.scopes || ['https://graph.microsoft.com/Files.Read'],
      redirectUri: this.config.redirectUri,
    });
  }

  async handleCallback(code: string): Promise<TokenData> {
    const result = await this.client.acquireTokenByCode({
      code,
      scopes: this.config.scopes || ['https://graph.microsoft.com/Files.Read'],
      redirectUri: this.config.redirectUri,
    });

    if (!result) {
      throw new Error('Failed to acquire token');
    }

    return {
      accessToken: result.accessToken,
      refreshToken: '', // Personal accounts may handle this field differently
      expiresAt: result.expiresOn!,
      scope: result.scopes,
      accountId: result.account?.username,
      type: 'individual_user',
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenData> {
    const result = await this.client.acquireTokenByRefreshToken({
      refreshToken,
      scopes: this.config.scopes || ['https://graph.microsoft.com/Files.Read'],
    });

    if (!result) {
      throw new Error('Failed to refresh token');
    }

    return {
      accessToken: result.accessToken,
      refreshToken,
      expiresAt: result.expiresOn!,
      scope: result.scopes,
      accountId: result.account?.username,
      type: 'individual_user',
    };
  }
}
