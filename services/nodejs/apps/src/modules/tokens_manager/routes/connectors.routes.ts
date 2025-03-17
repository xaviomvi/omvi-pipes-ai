import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from '../../../libs/errors/http.errors';

import { AuthMiddleware } from '../../../libs/middlewares/auth.middleware';
import { AuthenticatedUserRequest } from '../../../libs/middlewares/types';
import axios from 'axios';
import {
  ConfigurationManagerCommandOptions,
  ConfigurationManagerServiceCommand,
} from '../../../libs/commands/configuration_manager/cm.service.command';
import { HttpMethod } from '../../../libs/enums/http-methods.enum';
import { ValidationMiddleware } from '../../../libs/middlewares/validation.middleware';
import { FileProcessorFactory } from '../../../libs/middlewares/file_processor/fp.factory';
import { FileProcessingType } from '../../../libs/middlewares/file_processor/fp.constant';
import { ConnectorsConfig } from '../../configuration_manager/schema/connectors.schema';
import { Logger } from '../../../libs/services/logger.service';
import { Container } from 'inversify';
import {
  EntitiesEventProducer,
  EventType,
  Event,
  AppDisabledEvent,
  AppEnabledEvent,
} from '../../user_management/services/entity_events.service';
import { GoogleWorkspaceApp } from '../types/connector.types';

const CONNECTORS = [{ key: 'googleWorkspace', name: 'Google Workspace' }];
const logger = Logger.getInstance({
  service: 'Connectors Routes',
});

const oAuthConfigSchema = z.object({
  // Direct fields (when provided directly in the request body)
  clientId: z
    .string()
    .min(1, 'Client ID cannot be empty')
    .max(255, 'Client ID exceeds maximum length of 255 characters'),
  clientSecret: z
    .string()
    .min(1, 'Client Secret cannot be empty')
    .max(255, 'Client Secret exceeds maximum length of 255 characters'),
  redirectUri: z
    .string()
    .min(1, 'Redirect URI cannot be empty')
    .max(2048, 'Redirect URI exceeds maximum length of 2048 characters')
    .url('Redirect URI must be a valid URL'),
});

const oAuthValidationSchema = z.object({
  body: oAuthConfigSchema,
  query: z.object({
    service: z.enum(['googleWorkspace']), // Enum validation
  }),
  params: z.object({}),
  headers: z.object({}),
});
const ServiceValidationSchema = z.object({
  body: z.object({}),
  query: z.object({
    service: z.enum(['googleWorkspace']), // Enum validation
  }),
  params: z.object({}),
  headers: z.object({}),
});
export function createConnectorRouter(container: Container) {
  const router = Router();
  const eventService = container.get<EntitiesEventProducer>(
    'EntitiesEventProducer',
  );
  const authMiddleware = container.get<AuthMiddleware>('AuthMiddleware');

  router.get(
    '/credentials',
    authMiddleware.authenticate,
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ) => {
      try {
        const { service } = req.query;
        if (service === 'googleWorkspace') {
          const configurationManagerCommandOptions: ConfigurationManagerCommandOptions =
            {
              uri: 'http://localhost:3000/api/v1/configurationManager/connectors/googleWorkspaceCredentials',
              method: HttpMethod.GET,
              headers: req.headers as Record<string, string>,
            };

          const cmCommand = new ConfigurationManagerServiceCommand(
            configurationManagerCommandOptions,
          );
          const response = await cmCommand.execute();
          if (response.statusCode !== 200) {
            throw new InternalServerError(
              'Error updating access token',
              response?.data,
            );
          } else {
            if (response.data.client_id) {
              res.status(200).json({ isConfigured: true });
            } else {
              res.status(200).json({ isConfigured: false });
            }
          }
        } else {
          res.status(404).json({ message: 'this service is not allowed' });
        }
      } catch (err) {
        next(err);
      }
    },
  );
  router.post(
    '/credentials',
    authMiddleware.authenticate,
    ...FileProcessorFactory.createJSONUploadProcessor({
      fieldName: 'googleWorkspaceCredentials',
      allowedMimeTypes: ['application/json'],
      maxFilesAllowed: 1,
      isMultipleFilesAllowed: false,
      processingType: FileProcessingType.JSON,
      maxFileSize: 1024 * 1024 * 5,
      strictFileUpload: false,
    }).getMiddleware,
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ) => {
      try {
        const { service } = req.query;
        if (service === 'googleWorkspace') {
          const configurationManagerCommandOptions: ConfigurationManagerCommandOptions =
            {
              uri: 'http://localhost:3000/api/v1/configurationManager/connectors/googleWorkspaceCredentials',
              method: HttpMethod.POST,
              headers: { Authorization: req.headers.authorization as string },
              body: req.body,
            };
          const cmCommand = new ConfigurationManagerServiceCommand(
            configurationManagerCommandOptions,
          );
          const response = await cmCommand.execute();
          if (response.statusCode !== 200) {
            throw new InternalServerError(
              'Error updating access token',
              response?.data,
            );
          } else {
            res.status(200).json({ isConfigured: true });
          }
        } else {
          throw new NotFoundError('this service is not allowed');
        }
      } catch (err) {
        next(err);
      }
    },
  );
  router.get(
    '/credentials/download',
    authMiddleware.authenticate,
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ) => {
      try {
        const { service } = req.query;
        if (service === 'googleWorkspace') {
          const configurationManagerCommandOptions: ConfigurationManagerCommandOptions =
            {
              uri: 'http://localhost:3000/api/v1/configurationManager/connectors/googleWorkspaceCredentials',
              method: HttpMethod.GET,
              headers: req.headers as Record<string, string>,
            };

          const cmCommand = new ConfigurationManagerServiceCommand(
            configurationManagerCommandOptions,
          );
          const response = await cmCommand.execute();
          if (response.statusCode !== 200) {
            throw new InternalServerError(
              'Error updating access token',
              response?.data,
            );
          } else {
            if (!response.data.client_id) {
              throw new NotFoundError('No file found for credentials');
            }
            res.setHeader('Content-Type', 'application/json');
            res.setHeader(
              'Content-Disposition',
              'attachment; filename="credentials.json"',
            );

            // Send JSON response as a downloadable file
            res.status(200).send(JSON.stringify(response.data, null, 2));
          }
        } else {
          throw new NotFoundError('this service is not allowed');
        }
      } catch (err) {
        next(err);
      }
    },
  );
  router.get(
    '/status',
    authMiddleware.authenticate,
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ) => {
      try {
        if (!req.user) {
          throw new NotFoundError('User not Found');
        }
        const orgId = req.user.orgId; // Get orgId from query params

        const connectors = await ConnectorsConfig.find({ orgId }).select(
          'name isEnabled',
        );

        // Transform the result into an array with { key, isEnabled }
        const statuses = CONNECTORS.map(({ key, name }) => {
          const connector = connectors.find((c) => c.name === name);
          return { key, isEnabled: connector ? connector.isEnabled : false };
        });
        logger.info('statuses', statuses);

        res.status(200).json(statuses);
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/config',
    authMiddleware.authenticate,
    ValidationMiddleware.validate(ServiceValidationSchema),
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ) => {
      try {
        const { service } = req.query;
        let configurationManagerCommandOptions: ConfigurationManagerCommandOptions;
        if (service === 'googleWorkspace') {
          configurationManagerCommandOptions = {
            uri: `http://localhost:3000/api/v1/configurationManager/connectors/googleWorkspaceOauthConfig`,
            method: HttpMethod.GET,
            headers: req.headers as Record<string, string>,
          };
          const getConfigCommand = new ConfigurationManagerServiceCommand(
            configurationManagerCommandOptions,
          );
          let response = await getConfigCommand.execute();

          if (response.statusCode !== 200) {
            throw new InternalServerError(
              'Error getting config',
              response?.data,
            );
          }
          const configData = response.data;
          if (!configData.clientId) {
            throw new NotFoundError('Client Id is missing');
          }
          if (!configData.redirectUri) {
            throw new NotFoundError('Redirect Uri is missing');
          }
          if (!configData.clientSecret) {
            throw new NotFoundError('Client Secret is missing');
          }

          res.status(200).json({
            googleClientId: configData.clientId,
            googleRedirectUri: configData.redirectUri,
            googleClientSecret: configData.clientSecret,
          });
        } else {
          throw new NotFoundError('this service is not allowed');
        }
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/config',
    authMiddleware.authenticate,
    ValidationMiddleware.validate(oAuthValidationSchema),
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ) => {
      try {
        const { service } = req.query;
        let configurationManagerCommandOptions: ConfigurationManagerCommandOptions;
        if (service === 'googleWorkspace') {
          configurationManagerCommandOptions = {
            uri: `http://localhost:3000/api/v1/configurationManager/connectors/googleWorkspaceOauthConfig`,
            method: HttpMethod.POST,
            headers: req.headers as Record<string, string>,
            body: req.body,
          };
          const setConfigCommand = new ConfigurationManagerServiceCommand(
            configurationManagerCommandOptions,
          );
          let response = await setConfigCommand.execute();

          if (response.statusCode !== 200) {
            throw new InternalServerError(
              'Error setting config',
              response?.data,
            );
          }
          res.status(200).json({
            message: 'config successfully updated',
          });
        } else {
          throw new NotFoundError('this service is not allowed');
        }
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/disable',
    authMiddleware.authenticate,
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ) => {
      try {
        if (!req.user) {
          throw new NotFoundError('User not found');
        }
        const { service } = req.query;
        const connectorData = CONNECTORS.find((c) => c.key === service);
        if (!connectorData) {
          throw new NotFoundError('Invalid service name');
        }

        let connector = await ConnectorsConfig.findOne({
          name: connectorData.name,
        });
        await eventService.start();
        if (connector) {
          connector.isEnabled = false;
          connector.lastUpdatedBy = req.user.userId;

          const event: Event = {
            eventType: EventType.AppDisabledEvent,
            timestamp: Date.now(),
            payload: {
              orgId: req.user.orgId,
              appGroup: connector.name,
              appGroupId: connector._id,
              apps: [
                GoogleWorkspaceApp.Drive,
                GoogleWorkspaceApp.Gmail,
                GoogleWorkspaceApp.Calendar,
              ],
            } as AppDisabledEvent,
          };

          await eventService.publishEvent(event);
          await eventService.stop();
          await connector.save();

          res.status(200).json({
            message: `Connector ${service} is now disabled`,
            connector,
          });
        } else {
          throw new NotFoundError('Connector not found');
        }
      } catch (err) {
        try {
          await eventService.stop();
        } catch (error) {
          next(error);
        }
        next(err);
      }
    },
  );
  router.post(
    '/enable',
    authMiddleware.authenticate,
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ) => {
      try {
        if (!req.user) {
          throw new NotFoundError('User not found');
        }
        const { service } = req.query;
        const connectorData = CONNECTORS.find((c) => c.key === service);
        if (!connectorData) {
          throw new NotFoundError('Invalid service name');
        }

        let connector = await ConnectorsConfig.findOne({
          name: connectorData.name,
        });
        await eventService.start();
        let event: Event;

        if (connector) {
          connector.isEnabled = true;
          connector.lastUpdatedBy = req.user.userId;
          event = {
            eventType: EventType.AppEnabledEvent,
            timestamp: Date.now(),
            payload: {
              orgId: req.user.orgId,
              appGroup: connector.name,
              appGroupId: connector._id,
              apps: [
                GoogleWorkspaceApp.Drive,
                GoogleWorkspaceApp.Gmail,
                GoogleWorkspaceApp.Calendar,
              ],
              syncAction: 'immediate',
            } as AppEnabledEvent,
          };
          await eventService.publishEvent(event);
          await connector.save();
          await eventService.stop();
          res.status(200).json({
            message: `Connector ${service} is now enabled`,
            connector,
          });
        } else {
          connector = new ConnectorsConfig({
            orgId: req.user.orgId,
            name: connectorData.name,
            lastUpdatedBy: req.user.userId,
            isEnabled: true,
          });

          await connector.save();
          connector = await ConnectorsConfig.findOne({
            name: connectorData.name,
          });
          if (!connector) {
            throw new InternalServerError('Error in creating connector');
          }
          event = {
            eventType: EventType.AppEnabledEvent,
            timestamp: Date.now(),
            payload: {
              orgId: req.user.orgId,
              appGroup: connector.name,
              appGroupId: connector._id,
              apps: [
                GoogleWorkspaceApp.Drive,
                GoogleWorkspaceApp.Gmail,
                GoogleWorkspaceApp.Calendar,
              ],
              syncAction: 'immediate',
            } as AppEnabledEvent,
          };
          await eventService.publishEvent(event);
          await eventService.stop();
          res.status(201).json({
            message: `Connector ${connectorData.name} created and enabled`,
            connector,
          });
        }
      } catch (err) {
        try {
          await eventService.stop();
        } catch (error) {
          next(error);
        }
        next(err);
      }
    },
  );
  router.post(
    '/getTokenFromCode',
    authMiddleware.authenticate,
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ) => {
      try {
        if (!req.user) {
          throw new NotFoundError('User not found');
        }
        let configurationManagerCommandOptions: ConfigurationManagerCommandOptions =
          {
            uri: `http://localhost:3000/api/v1/configurationManager/connectors/googleWorkspaceOauthConfig`,
            method: HttpMethod.GET,
            headers: req.headers as Record<string, string>,
          };
        const getConfigCommand = new ConfigurationManagerServiceCommand(
          configurationManagerCommandOptions,
        );
        let response = await getConfigCommand.execute();

        if (response.statusCode !== 200) {
          throw new InternalServerError('Error getting config', response?.data);
        }
        const configData = response.data;
        if (!configData.clientId) {
          throw new NotFoundError('Client Id is missing');
        }
        if (!configData.clientSecret) {
          throw new NotFoundError('Client Secret is missing');
        }
        if (!configData.redirectUri) {
          throw new NotFoundError('Redirect Uri is missing');
        }
        let googleResponse = await axios.post(
          'https://oauth2.googleapis.com/token',
          {
            code: req.body.tempCode,
            client_id: configData.clientId,
            client_secret: configData.clientSecret,
            redirect_uri: configData.redirectUri,
            grant_type: 'authorization_code',
          },
        );
        if (googleResponse.status !== 200) {
          throw new BadRequestError('Error getting code');
        }
        const data = googleResponse.data;
        configurationManagerCommandOptions = {
          uri: 'http://localhost:3000/api/v1/configurationManager/connectors/googleWorkspaceCredentials',
          method: HttpMethod.POST,
          headers: req.headers as Record<string, string>,
          body: {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
          },
        };

        const cmCommand = new ConfigurationManagerServiceCommand(
          configurationManagerCommandOptions,
        );
        response = await cmCommand.execute();
        if (response.statusCode !== 200) {
          throw new InternalServerError(
            'Error updating access token',
            response?.data,
          );
        }
        const connectorData = CONNECTORS.find(
          (c) => c.key === 'googleWorkspace',
        );
        if (!connectorData) {
          throw new NotFoundError(
            'Google Workspace connector not found in config',
          );
        }

        let connector = await ConnectorsConfig.findOne({
          name: connectorData.name,
        });

        await eventService.start();
        let event: Event;

        if (connector) {
          connector.isEnabled = true;
          connector.lastUpdatedBy = req.user.userId;
          event = {
            eventType: EventType.AppEnabledEvent,
            timestamp: Date.now(),
            payload: {
              orgId: req.user.orgId,
              appGroup: connector.name,
              appGroupId: connector._id,
              apps: [
                GoogleWorkspaceApp.Drive,
                GoogleWorkspaceApp.Gmail,
                GoogleWorkspaceApp.Calendar,
              ],
              syncAction: 'immediate',
            } as AppEnabledEvent,
          };
          await eventService.publishEvent(event);
          await eventService.stop();
          await connector.save();
          res.status(200).json({
            message: `Connector is now enabled`,
            connector,
          });
        } else {
          connector = new ConnectorsConfig({
            orgId: req.user.orgId,
            name: connectorData.name,
            lastUpdatedBy: req.user.userId,
            isEnabled: true,
          });

          await connector.save();
          connector = await ConnectorsConfig.findOne({
            name: connectorData.name,
          });
          if (!connector) {
            throw new InternalServerError('Error in creating connector');
          }
          event = {
            eventType: EventType.AppEnabledEvent,
            timestamp: Date.now(),
            payload: {
              orgId: req.user.orgId,
              appGroup: connector.name,
              appGroupId: connector._id,
              apps: [
                GoogleWorkspaceApp.Drive,
                GoogleWorkspaceApp.Gmail,
                GoogleWorkspaceApp.Calendar,
              ],
              syncAction: 'immediate',
            } as AppEnabledEvent,
          };
          await eventService.publishEvent(event);
          await eventService.stop();
          res.status(201).json({
            message: `Connector ${connectorData.name} created and enabled`,
            connector,
          });
        }
      } catch (err) {
        next(err);
      }
      // Check if connector exists in MongoDB
    },
  );
  router.post(
    '/refreshIndividualConnectorToken',
    authMiddleware.authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
      const getRefreshTokenCommand: ConfigurationManagerCommandOptions = {
        uri: 'http://localhost:3000/api/v1/configurationManager/connectors/googleWorkspaceCredentials',
        method: HttpMethod.GET,
        headers: req.headers as Record<string, string>,
      };
      const refreshTokenCommand = new ConfigurationManagerServiceCommand(
        getRefreshTokenCommand,
      );

      const refreshTokenCommandResponse = await refreshTokenCommand.execute();
      if (refreshTokenCommandResponse.statusCode !== 200) {
        throw new InternalServerError(
          'Error getting refresh token from etcd',
          refreshTokenCommandResponse?.data,
        );
      }
      try {
        let configurationManagerCommandOptions: ConfigurationManagerCommandOptions =
          {
            uri: `http://localhost:3000/api/v1/configurationManager/connectors/googleWorkspaceOauthConfig`,
            method: HttpMethod.GET,
            headers: req.headers as Record<string, string>,
          };
        const getConfigCommand = new ConfigurationManagerServiceCommand(
          configurationManagerCommandOptions,
        );
        let response = await getConfigCommand.execute();

        if (response.statusCode !== 200) {
          throw new InternalServerError('Error getting config', response?.data);
        }
        const configData = response.data;
        if (!configData.clientId) {
          throw new NotFoundError('Client Id is missing');
        }
        if (!configData.clientSecret) {
          throw new NotFoundError('Client Secret is missing');
        }
        if (!configData.redirectUri) {
          throw new NotFoundError('Redirect Uri is missing');
        }

        const { data } = await axios.post(
          'https://oauth2.googleapis.com/token',
          {
            refresh_token: refreshTokenCommandResponse?.data.refresh_token,
            client_id: configData.clientId,
            client_secret: configData.clientSecret,
            grant_type: 'refresh_token',
          },
        );

        const updateAcessTokenCommand: ConfigurationManagerCommandOptions = {
          uri: 'http://localhost:3000/api/v1/configurationManager/connectors/googleWorkspaceCredentials',
          method: HttpMethod.POST,
          headers: req.headers as Record<string, string>,
          body: {
            userType: 'individual',
            access_token: data.access_token,
            refresh_token: refreshTokenCommandResponse?.data.refresh_token,
          },
        };
        const accessTokenCommand = new ConfigurationManagerServiceCommand(
          updateAcessTokenCommand,
        );

        const accessTokenCommandResponse = await accessTokenCommand.execute();
        if (accessTokenCommandResponse.statusCode !== 200) {
          throw new InternalServerError(
            'Error updating access token',
            accessTokenCommandResponse?.data,
          );
        }
        res.status(200).json({ message: 'accesstoken updated Successfully' });
      } catch (err) {
        logger.error('Error refreshing individual connector token', err);
        next(err);
      }
    },
  );
  return router;
}
