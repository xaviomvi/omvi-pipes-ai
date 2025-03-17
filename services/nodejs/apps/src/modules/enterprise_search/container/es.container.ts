import { Container } from 'inversify';
import { Logger } from '../../../libs/services/logger.service';
import { AppConfig } from '../../tokens_manager/config/config';
import { MongoService } from '../../../libs/services/mongo.service';
import { ConfigurationManagerConfig } from '../../configuration_manager/config/config';
import { KeyValueStoreService } from '../../../libs/services/keyValueStore.service';
import { AuthTokenService } from '../../../libs/services/authtoken.service';
import { AuthMiddleware } from '../../../libs/middlewares/auth.middleware';
import { configTypes } from '../../../libs/utils/config.utils';

const loggerConfig = {
  service: 'Enterprise Search Service',
};

export class EnterpriseSearchAgentContainer {
  private static instance: Container;
  private static logger: Logger = Logger.getInstance(loggerConfig);

  static async initialize(
    appConfig: AppConfig,
    configurationManagerConfig: ConfigurationManagerConfig,
  ): Promise<Container> {
    const container = new Container();

    // Bind configuration
    container.bind<AppConfig>('AppConfig').toConstantValue(appConfig);
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
      // Initialize services
      const mongoService = new MongoService();
      await mongoService.initialize();
      container
        .bind<MongoService>('MongoService')
        .toConstantValue(mongoService);
      const keyValueStoreService = KeyValueStoreService.getInstance(
        container.get<ConfigurationManagerConfig>('ConfigurationManagerConfig'),
      );

      await keyValueStoreService.connect();
      container
        .bind<KeyValueStoreService>('KeyValueStoreService')
        .toConstantValue(keyValueStoreService);
      const jwtSecret = await keyValueStoreService.get<string>(
        configTypes.JWT_SECRET,
      );
      const scopedJwtSecret = await keyValueStoreService.get<string>(
        configTypes.SCOPED_JWT_SECRET,
      );
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
      this.logger.info(
        'Enterprise Search Agent services initialized successfully',
      );
    } catch (error) {
      this.logger.error(
        'Failed to initialize Enterprise Search Agent services',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      );
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
