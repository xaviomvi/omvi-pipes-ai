import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Container } from 'inversify';
import { ValidationMiddleware } from '../../../libs/middlewares/validation.middleware';
import { AuthMiddleware } from '../../../libs/middlewares/auth.middleware';
import { userAdminCheck } from '../middlewares/userAdminCheck';
import { UserGroupController } from '../controller/userGroups.controller';
import { AuthenticatedUserRequest } from '../../../libs/middlewares/types';

const UserGroupIdUrlParams = z.object({
  groupId: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid UserGroupId'),
});

const UserGroupIdValidationSchema = z.object({
  body: z.object({}),
  query: z.object({}),
  params: UserGroupIdUrlParams,
  headers: z.object({}),
});

const groupValidationSchema = z.object({
  body: z.object({
    type: z.string().min(1, 'type is required'),
    name: z.string().min(1, 'name is required'),
  }),
  query: z.object({}),
  params: z.object({}),
  headers: z.object({}),
});

export function createUserGroupRouter(container: Container) {
  const router = Router();
  const userGroupController = container.get<UserGroupController>(
    'UserGroupController',
  );
  const authMiddleware = container.get<AuthMiddleware>('AuthMiddleware');

  router.post(
    '/',
    authMiddleware.authenticate,
    ValidationMiddleware.validate(groupValidationSchema),
    userAdminCheck,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await userGroupController.createUserGroup(req, res);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    '/',
    authMiddleware.authenticate,
    userAdminCheck,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await userGroupController.getAllUserGroups(req, res);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    '/:groupId',
    authMiddleware.authenticate,
    ValidationMiddleware.validate(UserGroupIdValidationSchema),
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ) => {
      try {
        await userGroupController.getUserGroupById(req, res);
      } catch (error) {
        next(error);
      }
    },
  );

  router.put(
    '/:groupId',
    authMiddleware.authenticate,
    userAdminCheck,
    ValidationMiddleware.validate(UserGroupIdValidationSchema),
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ) => {
      try {
        await userGroupController.updateGroup(req, res);
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete(
    '/:groupId',
    authMiddleware.authenticate,
    userAdminCheck,
    ValidationMiddleware.validate(UserGroupIdValidationSchema),
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ) => {
      try {
        await userGroupController.deleteGroup(req, res);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    '/add-users',
    authMiddleware.authenticate,
    userAdminCheck,
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ) => {
      try {
        await userGroupController.addUsersToGroups(req, res);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    '/remove-users',
    authMiddleware.authenticate,
    userAdminCheck,
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ) => {
      try {
        await userGroupController.removeUsersFromGroups(req, res);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    '/:groupId/users',
    authMiddleware.authenticate,
    ValidationMiddleware.validate(UserGroupIdValidationSchema),
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ) => {
      try {
        await userGroupController.getUsersInGroup(req, res);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    '/users/:userId',
    authMiddleware.authenticate,
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ) => {
      try {
        await userGroupController.getGroupsForUser(req, res);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    '/stats/list',
    authMiddleware.authenticate,
    async (
      req: AuthenticatedUserRequest,
      res: Response,
      next: NextFunction,
    ) => {
      try {
        await userGroupController.getGroupStatistics(req, res);
      } catch (error) {
        next(error);
      }
    },
  );

  // Health check endpoint
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
