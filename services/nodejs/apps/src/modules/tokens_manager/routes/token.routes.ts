import { Router } from 'express';
import { Container } from 'inversify';
import { z } from 'zod';
import { Logger } from '../../../libs/services/logger.service';
// import { RateLimitMiddleware } from '../middleware/rate-limit.middleware';
import { TokenService } from '../services/token.service';
import { RedisService } from '../../../libs/services/redis.service';
import { ValidationMiddleware } from '../../../libs/middlewares/validation.middleware';
import { AuthMiddleware } from '../../../libs/middlewares/auth.middleware';

const TokenRequestSchema = z.object({
  params: z.object({
    provider: z.enum(['google', 'onedrive', 'confluence']),
  }),
  headers: z.object({
    'x-api-key': z.string(),
    'x-tenant-id': z.string().uuid(),
    'x-service-id': z.string().optional(),
  }),
});

export function createTokenRouter(container: Container): Router {
  const router = Router();
  const tokenService = container.get<TokenService>('TokenService');
  const redisService = container.get<RedisService>('RedisService');
  const logger = container.get<Logger>('Logger');
  //   const rateLimiter = container.get<RateLimitMiddleware>('RateLimitMiddleware');

  //   // Rate limiting configuration
  //   const tokenRateLimiter = rateLimiter.createLimiter({
  //     windowMs: 60 * 1000, // 1 minute
  //     max: 100, // 100 requests per minute
  //   });

  router.get(
    '/:provider',
    // tokenRateLimiter,
    ValidationMiddleware.validate(TokenRequestSchema),
    // AuthMiddleware.validateApiKey(),
    async (req, res, next) => {
      const { provider } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;
      const serviceId = req.headers['x-service-id'] as string;

      try {
        // Try to get token from cache first
        const cacheKey = `token:${provider}:${tenantId}`;
        let tokenReference = await redisService.get(cacheKey);

        if (!tokenReference) {
          logger.debug('Token not found in cache, fetching from database', {
            provider,
            tenantId,
            serviceId,
          });

          // Get token from database
          // tokenReference = await tokenService.getValidToken(provider, tenantId);

          // Cache the token reference
          await redisService.set(cacheKey, tokenReference, {
            ttl: 300, // 5 minutes cache
          });
        }

        // Log token access
        logger.info('Token accessed', {
          provider,
          tenantId,
          serviceId,
        });

        // Return token reference
        res.json({
          success: true,
          data: tokenReference,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // Invalidate token endpoint
  router.post(
    '/:provider/invalidate',
    // tokenRateLimiter,
    ValidationMiddleware.validate(TokenRequestSchema),
    // AuthMiddleware.validateApiKey(),
    async (req, res, next) => {
      const { provider } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;
      const serviceId = req.headers['x-service-id'] as string;

      try {
        // Delete from cache
        const cacheKey = `token:${provider}:${tenantId}`;
        await redisService.delete(cacheKey);

        // Mark token as invalid in database
        // await tokenService.invalidateToken(provider, tenantId);

        logger.info('Token invalidated', {
          provider,
          tenantId,
          serviceId,
        });

        res.json({
          success: true,
          message: 'Token invalidated successfully',
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // Refresh token endpoint
  router.post(
    '/:provider/refresh',
    // tokenRateLimiter,
    ValidationMiddleware.validate(TokenRequestSchema),
    // AuthMiddleware.validateApiKey(),
    async (req, res, next) => {
      const { provider } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;
      const serviceId = req.headers['x-service-id'] as string;

      try {
        // // Force token refresh
        // const newTokenReference = await tokenService.refreshToken(
        //   provider,
        //   tenantId,
        // );
        // // Update cache
        // const cacheKey = `token:${provider}:${tenantId}`;
        // await redisService.set(cacheKey, newTokenReference, {
        //   ttl: 300, // 5 minutes cache
        // });
        // logger.info('Token refreshed', {
        //   provider,
        //   tenantId,
        //   serviceId,
        //   tokenId: newTokenReference.id,
        // });
        // res.json({
        //   success: true,
        //   data: newTokenReference,
        // });
      } catch (error) {
        next(error);
      }
    },
  );

  // Get token status endpoint
  router.get(
    '/:provider/status',
    // tokenRateLimiter,
    ValidationMiddleware.validate(TokenRequestSchema),
    // AuthMiddleware.validateApiKey(),
    async (req, res, next) => {
      const { provider } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;
      const serviceId = req.headers['x-service-id'] as string;

      try {
        // const tokenStatus = await tokenService.getTokenStatus(
        //   provider,
        //   tenantId,
        // );
        // logger.debug('Token status requested', {
        //   provider,
        //   tenantId,
        //   serviceId,
        //   status: tokenStatus,
        // });
        // res.json({
        //   success: true,
        //   data: tokenStatus,
        // });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
