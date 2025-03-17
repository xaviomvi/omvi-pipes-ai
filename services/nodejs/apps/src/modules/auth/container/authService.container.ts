import { Container } from 'inversify';
import { Logger } from '../../../libs/services/logger.service';
import { AuthConfig, loadAuthConfig } from '../config/config';
import { MongoService } from '../../../libs/services/mongo.service';
import { RedisService } from '../../../libs/services/redis.service';
import { IamService } from '../services/iam.service';
import { MailService } from '../services/mail.service';
import { SessionService } from '../services/session.service';
import { SamlController } from '../controller/saml.controller';
import { UserAccountController } from '../controller/userAccount.controller';
import { ConfigurationManagerService } from '../services/cm.service';
import { ConfigurationManagerConfig } from '../../configuration_manager/config/config';
import { KeyValueStoreService } from '../../../libs/services/keyValueStore.service';
import { AuthTokenService } from '../../../libs/services/authtoken.service';
import { AuthMiddleware } from '../../../libs/middlewares/auth.middleware';
export class AuthServiceContainer {
  private static instance: Container;

  static async initialize(
    configurationManagerConfig: ConfigurationManagerConfig,
  ): Promise<Container> {
    const container = new Container();
    const config: AuthConfig = await loadAuthConfig();
    container.bind<AuthConfig>('AuthConfig').toConstantValue(config);
    container.bind<Logger>('Logger').toConstantValue(new Logger());
    container
      .bind<ConfigurationManagerConfig>('ConfigurationManagerConfig')
      .toConstantValue(configurationManagerConfig);
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
      const logger = container.get<Logger>('Logger');
      // Initialize Redis
      const config = container.get<AuthConfig>('AuthConfig');
      const redisService = new RedisService(
        config.redis,
        container.get('Logger'),
      );
      container
        .bind<RedisService>('RedisService')
        .toConstantValue(redisService);
      const keyValueStoreService = KeyValueStoreService.getInstance(
        container.get<ConfigurationManagerConfig>('ConfigurationManagerConfig'),
      );

      await keyValueStoreService.connect();
      container
        .bind<KeyValueStoreService>('KeyValueStoreService')
        .toConstantValue(keyValueStoreService);
      const jwtSecret = config.jwtPrivateKey;
      const scopedJwtSecret = config.scopedJwtSecret;
      const authTokenService = new AuthTokenService(jwtSecret, scopedJwtSecret);
      const authMiddleware = new AuthMiddleware(logger, authTokenService);
      container
        .bind<AuthMiddleware>('AuthMiddleware')
        .toConstantValue(authMiddleware);
      const iamService = new IamService(config, logger);
      container.bind<IamService>('IamService').toConstantValue(iamService);
      const mailService = new MailService(config, logger);
      container.bind<MailService>('MailService').toConstantValue(mailService);
      const sessionService = new SessionService(redisService);
      container
        .bind<SessionService>('SessionService')
        .toConstantValue(sessionService);

      const configurationService = new ConfigurationManagerService();
      container
        .bind<ConfigurationManagerService>('ConfigurationManagerService')
        .toConstantValue(configurationService);

      const samlController = new SamlController(iamService, config, logger);
      container
        .bind<SamlController>('SamlController')
        .toConstantValue(samlController);

      const userAccountController = new UserAccountController(
        config,
        iamService,
        mailService,
        sessionService,
        configurationService,
        logger,
      );
      container
        .bind<UserAccountController>('UserAccountController')
        .toConstantValue(userAccountController);
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
