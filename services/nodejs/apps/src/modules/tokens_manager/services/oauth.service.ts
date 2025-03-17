import { inject, injectable } from 'inversify';
import { BaseOAuthProvider } from '../providers/base-oauth.provider';
import { TokenData } from '../types/oauth.types';
import { TokenReferenceService } from './token-reference.service';
import { TokenService } from './token.service';
import { StoredTokenData, TokenMetadata } from '../types/token.types';
import { Logger } from '../../../libs/services/logger.service';
import { ServiceType, TokenEventType } from '../schema/token-reference.schema';
import { TokenEventProducer } from './token-event.producer';

const logger = Logger.getInstance({
  service: 'OAuth Service',
});

@injectable()
export class OAuthService {
  private providers: Map<string, BaseOAuthProvider> = new Map();
  constructor(
    @inject('TokenService') private tokenStore: TokenService,
    @inject('TokenReferenceService')
    private tokenReferenceService: TokenReferenceService,
    @inject('KafkaService') private kafka: TokenEventProducer,
    @inject('Logger') private logger: Logger,
  ) {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Initialize Google provider
    // this.providers.set(
    //   'googledrive',
    //   OAuthProviderFactory.createProvider('googledrive', {
    //     clientId: process.env.GOOGLE_CLIENT_ID!,
    //     clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    //     redirectUri: process.env.GOOGLE_REDIRECT_URI!,
    //     scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    //   }),
    // );
    
    // Initialize OneDrive provider
    /*
    this.providers.set(
      'onedrive',
      OAuthProviderFactory.createProvider('onedrive', {
        clientId: process.env.AZURE_CLIENT_ID!,
        clientSecret: process.env.AZURE_CLIENT_SECRET!,
        redirectUri: process.env.AZURE_REDIRECT_URI!,
        scopes: ['Files.Read.All', 'offline_access'],
        additionalParams: {
          tenantId: process.env.AZURE_TENANT_ID!,
        },
      }),
    );
    this.providers.set(
      'onedrive-personal',
      OAuthProviderFactory.createProvider('onedrive-personal', {
        clientId: process.env.PERSONAL_AZURE_CLIENT_ID!,
        clientSecret: process.env.PERSONAL_AZURE_CLIENT_SECRET!,
        redirectUri: process.env.PERSONAL_AZURE_REDIRECT_URI!,
        scopes: ['Files.Read.All'],
      }),
    );
    */
  }
  async getAuthUrl(sourceType: string): Promise<string> {
    const provider = this.providers.get(sourceType);
    if (!provider) {
      throw new Error(`Unsupported source type: ${sourceType}`);
    }
    return provider.getAuthUrl();
  }

  async handleCallback(
    sourceType: string,
    code: string,
    tenantId: string,
  ): Promise<void> {
    const provider = this.providers.get(sourceType);
    if (!provider) {
      throw new Error(`Unsupported source type: ${sourceType}`);
    }

    const tokenData = await provider.handleCallback(code);
    await this.storeAndNotify(tenantId, sourceType, tokenData);
  }

  async refreshToken(
    sourceType: string,
    refreshToken: string,
    tenantId: string,
  ): Promise<TokenData> {
    const provider = this.providers.get(sourceType);
    if (!provider) {
      throw new Error(`Unsupported source type: ${sourceType}`);
    }

    const tokenData = await provider.refreshToken(refreshToken);
    await this.storeAndNotify(tenantId, sourceType, tokenData);

    return tokenData;
  }

  private async handleNewToken(
    accountId: string,
    serviceType: ServiceType,
    tokenStoreId: string,
    expiresAt: Date,
    metadata: Record<string, any>,
  ): Promise<void> {
    const tokenReference =
      await this.tokenReferenceService.createTokenReference({
        accountId,
        serviceType,
        tokenStoreId,
        expiresAt,
        metadata,
      });

    this.logger.debug('Successfully stored token and published event', {
      accountId,
      serviceType,
    });

    await this.kafka.publishTokenEvent({
      eventId: '',
      eventType: TokenEventType.TOKEN_CREATED,
      tokenReferenceId: tokenReference.tokenId,
      timestamp: Date.now(),
      serviceType: tokenReference.serviceType,
      accountId: tokenReference.accountId,
    });
  }

  private async storeAndNotify(
    tenantId: string,
    sourceType: string,
    tokenData: TokenData,
  ): Promise<void> {
    try {
      // Store token
      const accountId: string = tokenData.accountId || '';
      const metadata: TokenMetadata = {
        tenantId,
        provider: sourceType,
        accountId,
      };

      const storedTokenData: StoredTokenData = await this.tokenStore.storeToken(
        tokenData,
        metadata,
      );
      const serviceType: ServiceType = ServiceType.ONEDRIVE;
      logger.info('storedTokenData', storedTokenData);
      this.handleNewToken(
        accountId,
        serviceType,
        storedTokenData.uid,
        storedTokenData.expiresAt,
        {},
      );
    } catch (error) {
      throw new Error(
        `Failed to store and notify token: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
