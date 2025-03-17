// token.service.ts
import { inject, injectable } from 'inversify';
import { EncryptionService } from '../../../libs/services/encryption.service';
import { TokenError } from '../../../libs/errors/token.errors';
import { v4 as uuidv4 } from 'uuid';
import { StoredTokenData, TokenMetadata } from '../types/token.types';
import { TokenDocument, TokenModel } from '../schema/token.schema';
import { TokenData } from '../types/oauth.types';
import { Logger } from '../../../libs/services/logger.service';

const logger = Logger.getInstance({
  service: 'Token Service',
});

@injectable()
export class TokenService {
  constructor(
    @inject(EncryptionService) private encryption: EncryptionService,
  ) {}

  async storeToken(
    tokenData: TokenData,
    metadata: TokenMetadata,
  ): Promise<StoredTokenData> {
    try {
      const encryptedAccess = this.encryption.encrypt(tokenData.accessToken);
      const encryptedRefresh = tokenData.refreshToken
        ? this.encryption.encrypt(tokenData.refreshToken)
        : null;
      const filter = {
        provider: metadata.provider,
        tenantId: metadata.tenantId,
        accountId: metadata.accountId,
      };

      const update = {
        accessToken: encryptedAccess.encryptedData,
        accessTokenIv: encryptedAccess.iv,
        accessTokenTag: encryptedAccess.tag,
        refreshToken: encryptedRefresh?.encryptedData,
        refreshTokenIv: encryptedRefresh?.iv,
        refreshTokenTag: encryptedRefresh?.tag,
        expiresAt: tokenData.expiresAt,
        updatedAt: new Date(),
        tokenType: tokenData.type,
      };

      const token = await TokenModel.findOneAndUpdate(filter, update, {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        defaults: {
          uid: uuidv4(),
        },
      });

      return token.toObject();
    } catch (error: any) {
      logger.error('Failed to store token', error);
      throw new TokenError('Failed to store token', {
        provider: metadata.provider,
        tenantId: metadata.tenantId,
        accountId: metadata.accountId,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getToken(
    provider: string,
    tenantId: string,
    accountId: string,
  ): Promise<TokenData> {
    try {
      const token = await TokenModel.findOne({
        provider,
        tenantId,
        accountId,
      });

      if (!token) {
        throw new TokenError('Token not found', {
          provider,
          tenantId,
          accountId,
        });
      }

      return {
        accessToken: this.encryption.decrypt(
          token.accessToken,
          token.accessTokenIv,
          token.accessTokenTag,
        ),
        refreshToken: this.encryption.decrypt(
          '', // Todo: Fix
          '',
          '',
          // token.refreshTokenIv,
          // token.refreshTokenTag,
        ),
        expiresAt: token.expiresAt,
        scope: token.scope,
        type: token.tokenType,
      };
    } catch (error) {
      if (error instanceof TokenError) {
        throw error;
      }
      throw new TokenError('Failed to retrieve token', {
        provider,
        tenantId,
        accountId,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deleteToken(
    provider: string,
    tenantId: string,
    accountId: string,
  ): Promise<void> {
    try {
      const result = await TokenModel.deleteOne({
        provider,
        tenantId,
        accountId,
      });

      if (result.deletedCount === 0) {
        throw new TokenError('Token not found', {
          provider,
          tenantId,
          accountId,
        });
      }
    } catch (error) {
      throw new TokenError('Failed to delete token', {
        provider,
        tenantId,
        accountId,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async isTokenExpired(
    provider: string,
    tenantId: string,
    accountId: string,
  ): Promise<boolean> {
    const token = await this.getToken(provider, tenantId, accountId);
    const now = new Date();
    return token.expiresAt <= now;
  }

  async getTokensByTenant(tenantId: string): Promise<StoredTokenData[]> {
    try {
      const tokens = await TokenModel.find({ tenantId });

      return tokens.map((token: TokenDocument) => ({
        ...token.toObject(),
        accessToken: this.encryption.decrypt(
          token.accessToken,
          token.accessTokenIv,
          token.accessTokenTag,
        ),
        refreshToken: this.encryption.decrypt('', '', ''),
      }));
    } catch (error) {
      throw new TokenError('Failed to retrieve tenant tokens', {
        tenantId,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
