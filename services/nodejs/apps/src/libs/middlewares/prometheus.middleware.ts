import { Request, Response, NextFunction } from 'express';
import { Container } from 'inversify';
import { PrometheusService } from '../services/prometheus/prometheus.service';
import { AuthenticatedUserRequest } from './types';
import { Logger } from '../services/logger.service';

const logger = Logger.getInstance({
  service: 'Prometheus Middleware',
});
/**
 * Create metrics middleware for Express
 */
export function metricsMiddleware(container: Container) {
  const prometheusService = container.get(PrometheusService);

  return (req: AuthenticatedUserRequest, res: Response, next: NextFunction) => {
    // Extract user information from request
    const userId = req.user?.userId || 'anonymous';
    const orgId = req.user?.orgId || 'unknown';
    const email = req.user?.email || 'unknown';
    // Track route usage
    prometheusService.recordRouteUsage(req.originalUrl, userId, orgId, email);

    // Count API call
    prometheusService.incrementApiCall(req.method, req.originalUrl, userId, orgId, email);

    res.on('finish', () => {
      // Additional activity tracking based on response
      if (res.statusCode >= 400) {
        logMetricForUnexpectedError(req, res, prometheusService, userId, orgId);
      }
    });

    next();
  };
}

function logMetricForUnexpectedError(
  req: Request,
  res: Response,
  prometheusService: PrometheusService,
  userId: string,
  orgId: string,
) {
  switch (res.statusCode) {
    case 400:
      prometheusService.recordUserActivity(userId, 'bad_request', orgId);
      break;
    case 401:
      prometheusService.recordUserActivity(userId, 'unauthorized', orgId);
      break;
    case 403:
      prometheusService.recordUserActivity(userId, 'forbidden', orgId);
      break;
    case 404:
      prometheusService.recordUserActivity(userId, 'not_found', orgId);
      break;
    case 409:
      prometheusService.recordUserActivity(userId, 'conflict', orgId);
      break;
    case 422:
      prometheusService.recordUserActivity(userId, 'validation_error', orgId);
      break;
    case 429:
      prometheusService.recordUserActivity(userId, 'rate_limited', orgId);
      break;
    case 500:
      prometheusService.recordUserActivity(userId, 'server_error', orgId);
      break;
    case 502:
      prometheusService.recordUserActivity(userId, 'bad_gateway', orgId);
      break;
    case 503:
      prometheusService.recordUserActivity(
        userId,
        'service_unavailable',
        orgId,
      );
      break;
    case 504:
      prometheusService.recordUserActivity(userId, 'gateway_timeout', orgId);
      break;
  }

  // Log the error for debugging purposes
  logger.warn(
    `Request error: ${res.statusCode} ${req.method} ${req.path} (User: ${userId}, Org: ${orgId})`,
  );
}
