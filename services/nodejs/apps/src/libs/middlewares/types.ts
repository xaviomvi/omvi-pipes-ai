import { Request } from 'express';

export interface AuthenticatedUserRequest extends Request {
  user?: Record<string, any>;
}

export interface ScopedTokenRequest extends Request {
  tokenPayload?: Record<string, any>;
}
