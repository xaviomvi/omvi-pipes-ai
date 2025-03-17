import { ConfidentialClientApplication } from '@azure/msal-node';
import { OAuthConfig, TokenData } from '../types/oauth.types';
import { BaseOAuthProvider } from './base-oauth.provider';

// or OneDrive Enterprise , Refresh token are not needed
export class OneDriveEnterpriseOAuthProvider extends BaseOAuthProvider {
  private client: ConfidentialClientApplication;

  constructor(config: OAuthConfig) {
    super(config);
    this.client = new ConfidentialClientApplication({
      auth: {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        authority: `https://login.microsoftonline.com/${config.additionalParams?.tenantId || 'common'}`,
      },
    });
  }

  async getAuthUrl(): Promise<string> {
    return this.client.getAuthCodeUrl({
      scopes: this.config.scopes,
      redirectUri: this.config.redirectUri,
    });
  }

  async handleCallback(code: string): Promise<TokenData> {
    return this.getNewToken();
  }

  async refreshToken(refreshToken: string): Promise<TokenData> {
    return this.getNewToken();
  }

  private async getNewToken(): Promise<TokenData> {
    const result = await this.client.acquireTokenByClientCredential({
      scopes: this.config.scopes,
    });

    if (!result) {
      throw new Error('Failed to acquire token');
    }

    return {
      accessToken: result.accessToken,
      expiresAt: result.expiresOn!,
      scope: result.scopes,
      type: 'enterprise_global',
    };
  }
}
