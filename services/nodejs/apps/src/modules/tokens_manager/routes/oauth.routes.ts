import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { OAuthService } from '../services/oauth.service';
import { Container } from 'inversify';
import { ValidationError } from '../../../libs/errors/validation.error';
import { ValidationMiddleware } from '../../../libs/middlewares/validation.middleware';
import { AuthMiddleware } from '../../../libs/middlewares/auth.middleware';

const Headers = z.object({
  'x-tenant-id': z.string().optional(),
});

const AuthUrlParams = z.object({
  sourceType: z.string(),
});

const FetchAuthUrlValidationSchema = z.object({
  body: z.object({}),
  query: z.object({}),
  params: AuthUrlParams,
  headers: z.object({}),
});

const CallbackParams = z.object({
  sourceType: z.string(),
});

const CallbackQuery = z.object({
  code: z.string(),
  state: z.string().optional(),
});

const CallbackValidationSchema = z.object({
  body: z.object({}),
  query: CallbackQuery,
  params: CallbackParams,
  headers: z.object({}),
});

const TokenRequest = z.object({
  sourceType: z.string(),
});

const RevokeValidationSchema = z.object({
  body: z.object({}),
  query: z.object({}),
  params: TokenRequest,
  headers: Headers,
});

export function createOAuthRouter(container: Container) {
  const router = Router();
  const oauthService = container.get<OAuthService>('OAuthService');

  // Todo: Apply Rate Limiter Middleware
  // Todo: Apply Validation Middleware
  // Routes

  router.get(
    '/auth-url/:sourceType',
    ValidationMiddleware.validate(FetchAuthUrlValidationSchema),
    AuthMiddleware.authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { sourceType } = req.params;

        const authUrl = await oauthService.getAuthUrl(sourceType);

        // Store state in session/cache if needed
        const state = Buffer.from(
          JSON.stringify({
            sourceType,
            timestamp: Date.now(),
          }),
        ).toString('base64');

        res.json({
          authUrl: `${authUrl}&state=${state}`,
          state,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    '/callback/:sourceType',
    ValidationMiddleware.validate(CallbackValidationSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { sourceType } = req.params;
        const { code, state } = req.query as { code: string; state?: string };

        // Decode and validate state
        let stateData: any;
        let tenantId: string = '';
        if (state) {
          stateData = JSON.parse(Buffer.from(state, 'base64').toString());
          tenantId = stateData.tenantId;
          const { timestamp } = stateData;
          // Validate state timestamp (e.g., expires after 1 hour)
          if (Date.now() - timestamp > 3600000) {
            //throw new ValidationError('Authorization request has expired');
          }
        }

        await oauthService.handleCallback(sourceType, code, tenantId);

        // Redirect to frontend success page
        res.redirect(`${process.env.FRONTEND_URL}/oauth/${sourceType}/success`);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    '/revoke/:sourceType',
    // rateLimiter,
    ValidationMiddleware.validate(RevokeValidationSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = req.headers['x-tenant-id'] as string;
        const { sourceType } = req.params;

        //await oauthService.revokeToken(sourceType, tenantId);
        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    },
  );

  // Health check endpoint
  router.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
