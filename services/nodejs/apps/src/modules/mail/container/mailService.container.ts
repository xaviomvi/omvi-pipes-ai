import { Container } from 'inversify';
import { loadMailConfig, MailConfig } from '../config/config';
import { MongoService } from '../../../libs/services/mongo.service';
import { Logger } from '../../../libs/services/logger.service';
import { MailController } from '../controller/mail.controller';
import { AuthTokenService } from '../../../libs/services/authtoken.service';
import { AuthMiddleware } from '../../../libs/middlewares/auth.middleware';

export class MailServiceContainer {
  private static instance: Container;
  static async initialize(): Promise<Container> {
    const container = new Container();
    const mailConfig: MailConfig = await loadMailConfig();
    container.bind<MailConfig>('MailConfig').toConstantValue(mailConfig);
    container.bind<Logger>('Logger').toConstantValue(new Logger());
    // Initialize and bind services
    await this.initializeServices(container);

    this.instance = container;
    return container;
  }

  private static async initializeServices(container: Container): Promise<void> {
    try {
      const config = container.get<MailConfig>('MailConfig');

      const mongoService = new MongoService();
      await mongoService.initialize();
      container
        .bind<MongoService>('MongoService')
        .toConstantValue(mongoService);

      const mailController = new MailController(
        config,
        container.get('Logger'),
      );
      container
        .bind<MailController>('MailController')
        .toConstantValue(mailController);
      const jwtSecret = config.jwtSecret;
      const scopedJwtSecret = config.scopedJwtSecret;
      const authTokenService = new AuthTokenService(jwtSecret, scopedJwtSecret);
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
      throw new Error('Mail Service container not initialized');
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
