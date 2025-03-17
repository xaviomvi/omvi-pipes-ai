import { Router, Response, NextFunction } from 'express';
import { Container } from 'inversify';

import passport from 'passport';
import session from 'express-session';
import { attachContainerMiddleware } from '../middlewares/attachContainer.middleware';
import { AuthSessionRequest } from '../middlewares/types';
import { AuthConfig } from '../config/config';
import { refreshTokenJwtGenerator } from '../../../libs/utils/createJwt';
import { IamService } from '../services/iam.service';
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from '../../../libs/errors/http.errors';
import { SessionService } from '../services/session.service';
import { SamlController } from '../controller/saml.controller';
import { Logger } from '../../../libs/services/logger.service';
import { generateAuthToken } from '../utils/generateAuthToken';

export function createSamlRouter(container: Container) {
  const router = Router();

  const config = container.get<AuthConfig>('AuthConfig');
  const sessionService = container.get<SessionService>('SessionService');
  const iamService = container.get<IamService>('IamService');
  const samlController = container.get<SamlController>('SamlController');
  const logger = container.get<Logger>('Logger');
  router.use(attachContainerMiddleware(container));
  router.use(
    session({
      secret: config.cookieSecretKey!,
      resave: true,
      saveUninitialized: true,
      cookie: {
        maxAge: 60 * 60 * 1000, // 1 hour
        domain: 'localhost',
        secure: false, // Set to `true` if using HTTPS
        sameSite: 'lax',
      },
    }),
  );
  router.use(passport.initialize());
  router.use(passport.session());

  router.get(
    '/signIn',
    async (req: AuthSessionRequest, res: Response, next: NextFunction) => {
      try {
        await samlController.signInViaSAML(req, res, next);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    '/signIn/callback',
    passport.authenticate('saml', { failureRedirect: '/' }),
    async (req: AuthSessionRequest, res: Response, next: NextFunction) => {
      try {
        // logger.info(req?.user);
        const relayStateBase64 = req.body.RelayState || req.query.RelayState;
        const relayStateDecoded = relayStateBase64
          ? JSON.parse(Buffer.from(relayStateBase64, 'base64').toString('utf8'))
          : {};

        const orgId = relayStateDecoded.orgId;
        const sessionToken = relayStateDecoded.sessionToken;

        logger.info('Extracted orgId:', orgId);
        logger.info('Extracted Session Token:', sessionToken);
        if (!sessionToken) {
          throw new UnauthorizedError('Invalid Session token');
        }
        const method = 'samlSso';
        const session = await sessionService.getSession(sessionToken);
        if (!session) {
          throw new UnauthorizedError('Invalid Session');
        }
        req.sessionInfo = session;

        const currentStepConfig =
          req.sessionInfo.authConfig[req.sessionInfo.currentStep];
        logger.info(currentStepConfig, 'currentStepConfig');

        if (
          !currentStepConfig.allowedMethods.find((m: any) => m.type === method)
        ) {
          throw new BadRequestError(
            'Invalid authentication method for this step',
          );
        }

        // Todo: check if User Account exists and validate if user is not blocked
        if (!req.user) {
          throw new NotFoundError('User not found');
        }
        if (req.user) {
          const key = samlController.getSamlEmailKeyByOrgId(orgId);
          req.user.email = req.user[key];
          logger.info(req.user.email);

          logger.info('SAML callback email', req.user.email);
        }

        let userFindResult = await iamService.getUserByEmail(
          req.user.email,
          ' ',
        ); //handle this
        if (!userFindResult) {
          throw new NotFoundError('User not found');
        }
        const user = userFindResult.data;
        const userId = user._id;

        await sessionService.completeAuthentication(req.sessionInfo);
        const accessToken = await generateAuthToken(user, config.jwtPrivateKey);
        const refreshToken = refreshTokenJwtGenerator(
          userId,
          orgId,
          config.scopedJwtSecret,
        );
        if (!user.hasLoggedIn) {
          const userInfo = {
            ...user,
            hasLoggedIn: true,
          };
          iamService.updateUser(user._id, userInfo, accessToken);
          logger.info('user updated');
        }
        res.cookie('accessToken', accessToken, {
          // httpOnly: true,
          secure: true, // use true in production with HTTPS
          sameSite: 'none', // adjust as needed
          maxAge: 3600000, // 1 hour in milliseconds
        });
        res.cookie('refreshToken', refreshToken, {
          // httpOnly: true,
          secure: true, // Set to true in production (HTTPS)
          sameSite: 'none', // Adjust as needed
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
        });
        logger.info('completely authenticated');
        res
          .status(200)
          .redirect(`${config.frontendUrl}/auth/sign-in/samlSso/success`);
      } catch (error) {
        next(error);
      }

      // Todo: check if User Account exists and validate if user is not blocked
    },
  );
  return router;
}
