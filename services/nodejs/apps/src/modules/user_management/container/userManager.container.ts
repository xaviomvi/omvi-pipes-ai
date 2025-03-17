import { Container } from 'inversify';
import { Logger } from '../../../libs/services/logger.service';
import {
  loadUserManagementConfig,
  UserManagementConfig,
} from '../config/config';
import { MongoService } from '../../../libs/services/mongo.service';
import { MailService } from '../services/mail.service';
import { OrgController } from '../controller/org.controller';
import { UserController } from '../controller/users.controller';
import { ConfigurationManagerConfig } from '../../configuration_manager/config/config';
import { KeyValueStoreService } from '../../../libs/services/keyValueStore.service';
import { UserGroupController } from '../controller/userGroups.controller';
import { EntitiesEventProducer } from '../services/entity_events.service';
import { configPaths } from '../../configuration_manager/paths/paths';
import { EncryptionService } from '../../../libs/encryptor/encryptor';
import { AuthTokenService } from '../../../libs/services/authtoken.service';
import { AuthMiddleware } from '../../../libs/middlewares/auth.middleware';
import { configTypes } from '../../../libs/utils/config.utils';

export class UserManagerContainer {
  private static instance: Container;

  static async initialize(
    configurationManagerConfig: ConfigurationManagerConfig,
  ): Promise<Container> {
    const container = new Container();
    const config: UserManagementConfig = await loadUserManagementConfig();
    container
      .bind<UserManagementConfig>('UserManagementConfig')
      .toConstantValue(config);
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
      const config = container.get<UserManagementConfig>(
        'UserManagementConfig',
      );
      const mailService = new MailService(config, container.get('Logger'));
      container.bind<MailService>('MailService').toConstantValue(mailService);

      const keyValueStoreService = KeyValueStoreService.getInstance(
        container.get<ConfigurationManagerConfig>('ConfigurationManagerConfig'),
      );

      await keyValueStoreService.connect();
      container
        .bind<KeyValueStoreService>('KeyValueStoreService')
        .toConstantValue(keyValueStoreService);

      const configManagerConfig = container.get<ConfigurationManagerConfig>(
        'ConfigurationManagerConfig',
      );
      const encryptedKafkaConfig = await keyValueStoreService.get<string>(
        configPaths.broker.kafka,
      );

      const kafkaConfig = JSON.parse(
        EncryptionService.getInstance(
          configManagerConfig.algorithm,
          configManagerConfig.secretKey,
        ).decrypt(encryptedKafkaConfig),
      );

      const entityEventsService = new EntitiesEventProducer(
        kafkaConfig,
        container.get('Logger'),
      );
      container
        .bind<EntitiesEventProducer>('EntitiesEventProducer')
        .toConstantValue(entityEventsService);

      const orgController = new OrgController(
        config,
        mailService,
        container.get('Logger'),
        entityEventsService,
      );
      container
        .bind<OrgController>('OrgController')
        .toConstantValue(orgController);

      const userController = new UserController(
        config,
        mailService,
        container.get('Logger'),
        entityEventsService,
      );
      container
        .bind<UserController>('UserController')
        .toConstantValue(userController);

      const userGroupController = new UserGroupController();
      container
        .bind<UserGroupController>('UserGroupController')
        .toConstantValue(userGroupController);

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
