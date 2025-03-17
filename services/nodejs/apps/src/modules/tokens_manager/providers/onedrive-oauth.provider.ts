import { ConfidentialClientApplication } from '@azure/msal-node';
import { OAuthConfig, TokenData } from '../types/oauth.types';
import { BaseOAuthProvider } from './base-oauth.provider';
import { Logger } from '../../../libs/services/logger.service';

const logger = Logger.getInstance({
  service: 'OneDrive OAuth Provider',
});

export class OneDriveOAuthProvider extends BaseOAuthProvider {
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

  extractRefreshToken(): string {
    const tokenCache = this.client.getTokenCache().serialize();
    const refreshTokenInfo = JSON.parse(tokenCache).RefreshToken;

    return refreshTokenInfo[Object.keys(refreshTokenInfo)[0]].secret;
  }

  async handleCallback(code: string): Promise<TokenData> {
    const result = await this.client.acquireTokenByCode({
      code,
      scopes: this.config.scopes,
      redirectUri: this.config.redirectUri,
    });

    if (!result) {
      throw new Error('Failed to acquire token');
    }
    logger.info('result', result);

    return {
      accessToken: result.accessToken,
      refreshToken: this.extractRefreshToken(),
      expiresAt: result.expiresOn!,
      scope: result.scopes,
      accountId: result.account?.username,
      type: 'enterprise_user',
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenData> {
    const result = await this.client.acquireTokenByRefreshToken({
      refreshToken,
      scopes: this.config.scopes,
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
      type: 'enterprise_user',
    };
  }

  // Refetch refresh token
}
