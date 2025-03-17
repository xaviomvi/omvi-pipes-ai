import { Container } from 'inversify';
import { Logger } from '../../../libs/services/logger.service';
import { ConfigurationManagerConfig } from '../config/config';
import { KeyValueStoreService } from '../../../libs/services/keyValueStore.service';
import { configPaths } from '../paths/paths';
import { EncryptionService } from '../../../libs/encryptor/encryptor';
import { EntitiesEventProducer } from '../../user_management/services/entity_events.service';
import { AuthTokenService } from '../../../libs/services/authtoken.service';
import { AuthMiddleware } from '../../../libs/middlewares/auth.middleware';
import { configTypes } from '../../../libs/utils/config.utils';

const loggerConfig = {
  service: 'Configuration Manager Service',
};

export class ConfigurationManagerContainer {
  private static instance: Container;
  private static logger: Logger = Logger.getInstance(loggerConfig);

  static async initialize(
    configurationManagerConfig: ConfigurationManagerConfig,
  ): Promise<Container> {
    const container = new Container();

    // Bind configuration
    container
      .bind<ConfigurationManagerConfig>('ConfigurationManagerConfig')
      .toConstantValue(configurationManagerConfig);
    // Bind logger
    container.bind<Logger>('Logger').toConstantValue(this.logger);

    // Initialize and bind services
    await this.initializeServices(container);

    this.instance = container;
    return container;
  }

  private static async initializeServices(container: Container): Promise<void> {
    try {
      const configurationManagerConfig =
        container.get<ConfigurationManagerConfig>('ConfigurationManagerConfig');
      const keyValueStoreService = KeyValueStoreService.getInstance(
        configurationManagerConfig,
      );

      await keyValueStoreService.connect();
      container
        .bind<KeyValueStoreService>('KeyValueStoreService')
        .toConstantValue(keyValueStoreService);

      const encryptedKafkaConfig = await keyValueStoreService.get<string>(
        configPaths.broker.kafka,
      );

      const kafkaConfig = JSON.parse(
        EncryptionService.getInstance(
          configurationManagerConfig.algorithm,
          configurationManagerConfig.secretKey,
        ).decrypt(encryptedKafkaConfig),
      );

      const entityEventsService = new EntitiesEventProducer(
        kafkaConfig,
        container.get('Logger'),
      );
      container
        .bind<EntitiesEventProducer>('EntitiesEventProducer')
        .toConstantValue(entityEventsService);
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
        'Configuration Manager services initialized successfully',
      );
    } catch (error) {
      this.logger.error('Failed to initialize Configuration Manager services', {
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
