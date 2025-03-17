import { z } from 'zod';
import { Logger } from '../../../libs/services/logger.service';
import { OAuthConfig, TokenData } from '../types/oauth.types';
import { InvalidTokenError } from '../../../libs/errors/oauth.errors';

export abstract class BaseOAuthProvider {
  protected logger: Logger;
  protected config: OAuthConfig;

  public get configuration(): OAuthConfig {
    return this.config;
  }

  // Validation schemas
  protected static ConfigSchema = z.object({
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    redirectUri: z.string().url(),
    scopes: z.array(z.string()).min(1),
    additionalParams: z.record(z.string()).optional(),
  });

  protected static TokenResponseSchema = z
    .object({
      accessToken: z.string(),
      type: z.enum(['enterprise_global', 'enterprise_user', 'individual_user']),
      refreshToken: z.string().optional(),
      accountId: z.string().optional(),
      tenantId: z.string().optional(),
      expiresAt: z.date(),
      scope: z.array(z.string()),
    })
    .refine(
      (data) => {
        // Validation rules based on type
        switch (data.type) {
          case 'enterprise_global':
            return !!data.tenantId && !data.accountId;
          case 'enterprise_user':
            return !!data.tenantId && !!data.accountId;
          case 'individual_user':
            return !!data.accountId && !data.tenantId;
        }
      },
      {
        message:
          'Invalid combination of tenantId and accountId for the specified type',
      },
    );

  constructor(config: OAuthConfig) {
    this.logger = Logger.getInstance();
    this.validateConfig(config);
    this.config = config;
  }

  protected validateConfig(config: OAuthConfig): void {
    try {
      BaseOAuthProvider.ConfigSchema.parse(config);
    } catch (error) {
      const message =
        error instanceof z.ZodError
          ? error.errors.map((e) => e.message).join(', ')
          : 'Invalid OAuth configuration';
      //throw new OAuthConfigError(message);
    }
  }

  protected validateTokenData(data: any): TokenData {
    try {
      return BaseOAuthProvider.TokenResponseSchema.parse(data);
    } catch (error) {
      const message =
        error instanceof z.ZodError
          ? error.errors.map((e) => e.message).join(', ')
          : 'Invalid token data';
      throw new InvalidTokenError(message);
    }
  }

  protected logAuthAttempt(
    sourceType: string,
    success: boolean,
    error?: Error,
  ): void {
    if (success) {
      this.logger.info(`Successful ${sourceType} OAuth attempt`, {
        sourceType,
        scopes: this.config.scopes,
      });
    } else {
      this.logger.error(`Failed ${sourceType} OAuth attempt`, {
        sourceType,
        error: error?.message,
        stack: error?.stack,
      });
    }
  }

  abstract getAuthUrl(): Promise<string>;
  abstract handleCallback(code: string): Promise<TokenData>;
  abstract refreshToken(refreshToken: string): Promise<TokenData>;
}
