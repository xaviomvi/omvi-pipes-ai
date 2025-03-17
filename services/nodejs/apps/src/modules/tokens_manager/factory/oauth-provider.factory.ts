import { BaseOAuthProvider } from '../providers/base-oauth.provider';
import { GoogleDriveEnterpriseOAuthProvider } from '../providers/googledrive-enterprise.provider';
import { GoogleDriveOAuthProvider } from '../providers/googledrive-oauth.provider';
import { OneDriveEnterpriseOAuthProvider } from '../providers/onedrive-all-enterprise.provider';
import { OneDriveOAuthProvider } from '../providers/onedrive-oauth.provider';
import { OneDrivePersonalOAuthProvider } from '../providers/onedrive-personal-oauth.provider';
import { OAuthConfig } from '../types/oauth.types';

export class OAuthProviderFactory {
  private static providers = new Map<
    string,
    new (config: OAuthConfig) => BaseOAuthProvider
  >([
    ['googledrive-enterprise', GoogleDriveEnterpriseOAuthProvider],
    ['onedrive-enterprise', OneDriveEnterpriseOAuthProvider],
    ['googledrive', GoogleDriveOAuthProvider],
    ['onedrive', OneDriveOAuthProvider],
    ['onedrive-personal', OneDrivePersonalOAuthProvider],
  ]);

  static createProvider(type: string, config: OAuthConfig): BaseOAuthProvider {
    const Provider = this.providers.get(type);
    if (!Provider) {
      throw new Error(`Unsupported OAuth provider: ${type}`);
    }
    return new Provider(config);
  }

  static registerProvider(
    type: string,
    provider: new (config: OAuthConfig) => BaseOAuthProvider,
  ): void {
    this.providers.set(type, provider);
  }
}
