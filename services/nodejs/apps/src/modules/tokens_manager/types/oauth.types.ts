export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  additionalParams?: Record<string, string>;
}

export type TokenType =
  | 'enterprise_global'
  | 'enterprise_user'
  | 'individual_user';

export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  accountId?: string;
  tenantId?: string;
  expiresAt: Date;
  scope: string[];
  type: TokenType;
}
