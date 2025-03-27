import { Container } from 'inversify';
import { Logger } from '../../../libs/services/logger.service';
import { MailService } from '../services/mail.service';
import { OrgController } from '../controller/org.controller';
import { UserController } from '../controller/users.controller';
import { ConfigurationManagerConfig } from '../../configuration_manager/config/config';
import { KeyValueStoreService } from '../../../libs/services/keyValueStore.service';
import { UserGroupController } from '../controller/userGroups.controller';
import { EntitiesEventProducer } from '../services/entity_events.service';
import { AuthTokenService } from '../../../libs/services/authtoken.service';
import { AuthMiddleware } from '../../../libs/middlewares/auth.middleware';
import { AppConfig } from '../../tokens_manager/config/config';

export class UserManagerContainer {
  private static instance: Container;

  static async initialize(
    configurationManagerConfig: ConfigurationManagerConfig,
    appConfig: AppConfig,
  ): Promise<Container> {
    const container = new Container();

    container.bind<Logger>('Logger').toConstantValue(new Logger());

    container
      .bind<ConfigurationManagerConfig>('ConfigurationManagerConfig')
      .toConstantValue(configurationManagerConfig);
    container.bind<AppConfig>('AppConfig').toConstantValue(appConfig);

    await this.initializeServices(container, appConfig);
    this.instance = container;
    return container;
  }
  private static async initializeServices(
    container: Container,
    appConfig: AppConfig,
  ): Promise<void> {
    try {
      const mailService = new MailService(appConfig, container.get('Logger'));
      container.bind<MailService>('MailService').toConstantValue(mailService);

      const keyValueStoreService = KeyValueStoreService.getInstance(
        container.get<ConfigurationManagerConfig>('ConfigurationManagerConfig'),
      );

      await keyValueStoreService.connect();
      container
        .bind<KeyValueStoreService>('KeyValueStoreService')
        .toConstantValue(keyValueStoreService);

      const entityEventsService = new EntitiesEventProducer(
        appConfig.kafka,
        container.get('Logger'),
      );
      container
        .bind<EntitiesEventProducer>('EntitiesEventProducer')
        .toConstantValue(entityEventsService);

      const orgController = new OrgController(
        appConfig,
        mailService,
        container.get('Logger'),
        entityEventsService,
      );
      container
        .bind<OrgController>('OrgController')
        .toConstantValue(orgController);

      const userController = new UserController(
        appConfig,
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

      const authTokenService = new AuthTokenService(
        appConfig.jwtSecret,
        appConfig.scopedJwtSecret,
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
