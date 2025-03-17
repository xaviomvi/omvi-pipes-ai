import { Container } from 'inversify';
import { AppConfig, loadAppConfig } from '../config/config';
import { MongoService } from '../../../libs/services/mongo.service';
import { EncryptionService } from '../../../libs/services/encryption.service';
import { TokenService } from '../services/token.service';
import { RedisService } from '../../../libs/services/redis.service';
import { Logger } from '../../../libs/services/logger.service';
import { OAuthService } from '../services/oauth.service';
import { TokenReferenceService } from '../services/token-reference.service';
import { TokenEventProducer } from '../services/token-event.producer';
import { ConfigurationManagerConfig } from '../../configuration_manager/config/config';
import { EntitiesEventProducer } from '../../user_management/services/entity_events.service';
import { AuthTokenService } from '../../../libs/services/authtoken.service';
import { AuthMiddleware } from '../../../libs/middlewares/auth.middleware';

const loggerConfig = {
  service: 'Token Manager',
};

export class TokenManagerContainer {
  private static instance: Container;
  private static logger: Logger = Logger.getInstance(loggerConfig);

  static async initialize(
    configurationManagerConfig: ConfigurationManagerConfig,
  ): Promise<Container> {
    const container = new Container();
    const config: AppConfig = await loadAppConfig();
    // Bind configuration
    container.bind<AppConfig>('Config').toConstantValue(config);

    // Bind logger
    container.bind<Logger>('Logger').toConstantValue(this.logger);
    container
      .bind<ConfigurationManagerConfig>('ConfigurationManagerConfig')
      .toConstantValue(configurationManagerConfig);
    // Initialize and bind services
    await this.initializeServices(container);

    this.instance = container;
    return container;
  }

  private static async initializeServices(container: Container): Promise<void> {
    try {
      const mongoService = new MongoService();
      await mongoService.initialize();
      container
        .bind<MongoService>('MongoService')
        .toConstantValue(mongoService);

      // Initialize Redis
      const config = container.get<AppConfig>('Config');
      const redisService = new RedisService(
        config.redis,
        container.get('Logger'),
      );
      container
        .bind<RedisService>('RedisService')
        .toConstantValue(redisService);

      // Initialize Encryption Service
      const encryptionService = new EncryptionService(config.encryption.key);
      container
        .bind<EncryptionService>('EncryptionService')
        .toConstantValue(encryptionService);

      // Initialize Kafka Service
      const tokenEventProducer = new TokenEventProducer(
        config.kafka,
        container.get('Logger'),
      );
      await tokenEventProducer.start();
      container
        .bind<TokenEventProducer>('KafkaService')
        .toConstantValue(tokenEventProducer);

      // Initialize Token Service
      const tokenService = new TokenService(container.get('EncryptionService'));
      container
        .bind<TokenService>('TokenService')
        .toConstantValue(tokenService);

      const tokenReferenceService = new TokenReferenceService();

      container
        .bind<TokenReferenceService>('TokenReferenceService')
        .toConstantValue(tokenReferenceService);

      // Initialize OAuth Service
      const oauthService = new OAuthService(
        container.get('TokenService'),
        container.get('TokenReferenceService'),
        container.get('KafkaService'),
        container.get('Logger'),
      );

      container
        .bind<OAuthService>('OAuthService')
        .toConstantValue(oauthService);

      const kafkaConfig = {
        clientId: config.kafka.clientId,
        brokers: config.kafka.brokers,
        groupId: config.kafka.groupId,
      };

      const entityEventsService = new EntitiesEventProducer(
        kafkaConfig,
        container.get('Logger'),
      );
      container
        .bind<EntitiesEventProducer>('EntitiesEventProducer')
        .toConstantValue(entityEventsService);
      const jwtSecret = config.jwtSecret;
      const scopedJwtSecret = config.scopedJwtSecret;
      const authTokenService = new AuthTokenService(
        jwtSecret || ' ',
        scopedJwtSecret || ' ',
      );
      const authMiddleware = new AuthMiddleware(
        container.get('Logger'),
        authTokenService,
      );
      container
        .bind<AuthMiddleware>('AuthMiddleware')
        .toConstantValue(authMiddleware);
    } catch (error) {
      const logger = container.get<Logger>('Logger');
      logger.error('Failed to initialize services', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  static getInstance(): Container {
    if (!this.instance) {
      throw new Error('Service container not initialized');
    }
    return this.instance;
  }

  static async dispose(): Promise<void> {
    if (this.instance) {
      const services = this.instance.getAll<any>('Service');
      for (const service of services) {
        if (typeof service.disconnect === 'function') {
          await service.disconnect();
        }
      }
      this.instance = null!;
    }
  }
}
