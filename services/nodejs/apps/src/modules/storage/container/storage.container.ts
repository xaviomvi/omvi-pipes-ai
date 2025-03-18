import { Container } from 'inversify';
import { Logger } from '../../../libs/services/logger.service';
import { MongoService } from '../../../libs/services/mongo.service';
import { KeyValueStoreService } from '../../../libs/services/keyValueStore.service';
import { ConfigurationManagerConfig } from '../../configuration_manager/config/config';
import { AuthTokenService } from '../../../libs/services/authtoken.service';
import { AuthMiddleware } from '../../../libs/middlewares/auth.middleware';
import { AppConfig } from '../../tokens_manager/config/config';
import { DefaultStorageConfig } from '../../tokens_manager/services/cm.service';

const loggerConfig = {
  service: 'Storage service',
};

export class StorageContainer {
  private static instance: Container;
  private static logger: Logger = Logger.getInstance(loggerConfig);

  static async initialize(
    configurationManagerConfig: ConfigurationManagerConfig,
    appConfig: AppConfig,
  ): Promise<Container> {
    const container = new Container();
    container
      .bind<ConfigurationManagerConfig>('ConfigurationManagerConfig')
      .toConstantValue(configurationManagerConfig);

    // Initialize and bind services
    await this.initializeServices(container, appConfig);

    this.instance = container;
    return container;
  }

  private static async initializeServices(
    container: Container,
    appConfig: AppConfig,
  ): Promise<void> {
    try {
      const mongoService = new MongoService(appConfig.mongo);
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
      this.logger.info('Storage services initialized successfully');

      const authTokenService = new AuthTokenService(
        appConfig.jwtSecret,
        appConfig.scopedJwtSecret,
      );
      const authMiddleware = new AuthMiddleware(
        Logger.getInstance(loggerConfig),
        authTokenService,
      );
      container
        .bind<AuthMiddleware>('AuthMiddleware')
        .toConstantValue(authMiddleware);
      const storageConfig = appConfig.storage;
      container
        .bind<DefaultStorageConfig>('StorageConfig')
        .toConstantValue(storageConfig);
    } catch (error) {
      this.logger.error('Failed to initialize storage services', {
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
