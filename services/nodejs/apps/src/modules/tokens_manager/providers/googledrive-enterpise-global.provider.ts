import { GoogleAuth, JWT } from 'google-auth-library';
import { BaseOAuthProvider } from './base-oauth.provider';
import { OAuthConfig, TokenData } from '../types/oauth.types';
import { BadRequestError } from '../../../libs/errors/http.errors';

export class GoogleDriveEnterpriseGlobalProvider extends BaseOAuthProvider {
  private auth: JWT;

  constructor(config: OAuthConfig) {
    super(config);
    if (!config.additionalParams?.serviceAccountKey) {
      throw new BadRequestError(
        'Service account key is required for enterprise global configuration',
      );
    }

    const serviceAccountKey = JSON.parse(
      config.additionalParams.serviceAccountKey,
    );

    this.auth = new JWT({
      email: serviceAccountKey.client_email,
      key: serviceAccountKey.private_key,
      scopes: this.config.scopes,
      subject: config.additionalParams.adminEmail, // Admin email for impersonation
    });
  }

  // Not needed for service account
  async getAuthUrl(): Promise<string> {
    throw new Error(
      'Auth URL not applicable for service account authentication',
    );
  }

  // Not needed for service account
  async handleCallback(): Promise<TokenData> {
    throw new Error(
      'Callback not applicable for service account authentication',
    );
  }

  async getToken(): Promise<TokenData> {
    const credentials = await this.auth.authorize();

    return {
      accessToken: credentials.access_token!,
      expiresAt: new Date(
        Date.now() + (credentials.expiry_date || 3600) * 1000,
      ),
      scope: this.config.scopes,
      tenantId: this.config.additionalParams?.domain,
      type: 'enterprise_global',
    };
  }

  // Service account tokens are auto-refreshed by the client
  async refreshToken(): Promise<TokenData> {
    return this.getToken();
  }
}
