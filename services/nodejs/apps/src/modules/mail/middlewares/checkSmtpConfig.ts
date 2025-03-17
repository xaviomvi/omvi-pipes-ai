import { NextFunction, Response } from 'express';
import {
  BadRequestError,
  NotFoundError,
} from '../../../libs/errors/http.errors';

import { MailConfig } from '../config/config';
import { ContainerRequest } from '../../auth/middlewares/types';

export const smtpConfigChecker = (
  req: ContainerRequest,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const container = req.container;
    if (!container) {
      throw new NotFoundError('Mail container not found');
    }
    const config = container.get<MailConfig>('MailConfig');
    if (!config.smtp.username || !config.smtp.host || !config.smtp.fromEmail) {
      throw new BadRequestError('Smtp not configured properly');
    }
    next();
  } catch (error) {
    next(error);
  }
};
