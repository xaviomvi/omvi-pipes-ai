import { Response, NextFunction } from 'express';
import { AuthenticatedUserRequest } from './types';
import { InternalServerError, NotFoundError } from '../errors/http.errors';
import {
  ConfigurationManagerCommandOptions,
  ConfigurationManagerServiceCommand,
} from '../commands/configuration_manager/cm.service.command';
import { HttpMethod } from '../enums/http-methods.enum';

export const smtpConfigCheck = async (
  req: AuthenticatedUserRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    let configurationManagerCommandOptions: ConfigurationManagerCommandOptions =
      {
        uri: `http://localhost:3000/api/v1/configurationManager/smtpConfig`,
        method: HttpMethod.GET,
        headers: req.headers as Record<string, string>,
      };
    const getCredentialsCommand = new ConfigurationManagerServiceCommand(
      configurationManagerCommandOptions,
    );
    let response = await getCredentialsCommand.execute();
    if (response.statusCode !== 200) {
      throw new InternalServerError(
        'Error getting smtp config',
        response?.data,
      );
    }
    const credentialsData = response.data;
    if (!credentialsData) {
      throw new NotFoundError('Smtp Configuration not found');
    }
    if (!credentialsData.host) {
      throw new NotFoundError('Smtp Host is missing');
    }
    if (!credentialsData.username) {
      throw new NotFoundError('Smtp Username is missing');
    }
    if (!credentialsData.fromEmail) {
      throw new NotFoundError('Smtp From Email is missing');
    }
    next();
  } catch (error) {
    next(error);
  }
};
