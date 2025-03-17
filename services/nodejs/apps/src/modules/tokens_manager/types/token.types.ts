import { TokenData, TokenType } from './oauth.types';

export interface StoredTokenData {
  uid: string;
  provider: string;
  tenantId: string;
  accountId: string;
  accessToken: string;
  accessTokenIv: string;
  accessTokenTag: string;
  refreshToken?: string;
  refreshTokenIv?: string;
  refreshTokenTag?: string;
  expiresAt: Date;
  scope: string[];
  tokenType: TokenType;
  createdAt: Date;
  updatedAt: Date;
}

export interface TokenMetadata {
  provider: string;
  tenantId: string;
  accountId: string;
}
