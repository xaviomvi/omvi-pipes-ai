import { OAuth2Client } from 'google-auth-library';
import { OAuthConfig, TokenData } from '../types/oauth.types';
import { BaseOAuthProvider } from './base-oauth.provider';

export class GoogleDriveEnterpriseOAuthProvider extends BaseOAuthProvider {
  private client: OAuth2Client;

  constructor(config: OAuthConfig) {
    super(config);
    this.client = new OAuth2Client({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    });
  }

  async getAuthUrl(): Promise<string> {
    return this.client.generateAuthUrl({
      access_type: 'offline',
      scope: this.config.scopes,
      ...this.config.additionalParams,
    });
  }

  async handleCallback(code: string): Promise<TokenData> {
    const { tokens } = await this.client.getToken(code);

    return {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!,
      expiresAt: new Date(tokens.expiry_date!),
      scope: tokens.scope!.split(' '),
      accountId: tokens.id_token || '',
      type: 'enterprise_user',
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenData> {
    this.client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await this.client.refreshAccessToken();

    return {
      accessToken: credentials.access_token!,
      refreshToken: credentials.refresh_token || refreshToken,
      expiresAt: new Date(credentials.expiry_date!),
      scope: credentials.scope!.split(' '),
      accountId: credentials.id_token || '',
      type: 'enterprise_user',
    };
  }
}
