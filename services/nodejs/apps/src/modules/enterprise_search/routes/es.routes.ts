import { Router } from 'express';
import { Container } from 'inversify';
import { AuthMiddleware } from '../../../libs/middlewares/auth.middleware';
import {
  addMessage,
  archiveConversation,
  createConversation,
  deleteConversationById,
  enterpriseSemanticSearch,
  getAllConversations,
  getConversationById,
  listAllArchivesConversation,
  regenerateAnswers,
  searchHistory,
  shareConversationById,
  unarchiveConversation,
  unshareConversationById,
  updateFeedback,
  updateTitle,
} from '../controller/es_controller';
import { ValidationMiddleware } from '../../../libs/middlewares/validation.middleware';
import {
  conversationParamsSchema,
  conversationIdParamsSchema,
  enterpriseSearchCreateSchema,
  enterpriseSearchDeleteSchema,
  enterpriseSearchGetSchema,
  enterpriseSearchUpdateSchema,
  enterpriseSearchSearchSchema,
  enterpriseSearchSearchHistorySchema,
} from '../validators/es_validators';
import { metricsMiddleware } from '../../../libs/middlewares/prometheus.middleware';
import { AppConfig } from '../../tokens_manager/config/config';

export function createConversationalRouter(container: Container): Router {
  const router = Router();
  const authMiddleware = container.get<AuthMiddleware>('AuthMiddleware');
  const appConfig = container.get<AppConfig>('AppConfig');
  /**
   * @route POST /api/v1/conversations
   * @desc Create a new conversation with initial query
   * @access Private
   * @body {
   *   query: string
   * }
   */
  router.post(
    '/create',
    authMiddleware.authenticate,
    metricsMiddleware(container),
    ValidationMiddleware.validate(enterpriseSearchCreateSchema),
    createConversation(appConfig),
  );

  /**
   * @route POST /api/v1/conversations/:conversationId/messages
   * @desc Add a new message to existing conversation
   * @access Private
   * @param {string} conversationId - Conversation ID
   * @body {
   *   query: string
   * }
   */
  router.post(
    '/:conversationId/messages',
    authMiddleware.authenticate,
    metricsMiddleware(container),
    ValidationMiddleware.validate(conversationIdParamsSchema),
    ValidationMiddleware.validate(enterpriseSearchUpdateSchema),
    addMessage(appConfig),
  );

  /**
   * @route GET /api/v1/conversations/
   * @desc Get all conversations for a userId
   * @access Private
   * @param {string} conversationId - Conversation ID
   */
  router.get(
    '/',
    authMiddleware.authenticate,
    metricsMiddleware(container),
    getAllConversations,
  );

  /**
   * @route GET /api/v1/conversations/:conversationId
   * @desc Get conversation by ID
   * @access Private
   * @param {string} conversationId - Conversation ID
   */
  router.get(
    '/:conversationId',
    authMiddleware.authenticate,
    metricsMiddleware(container),
    ValidationMiddleware.validate(conversationIdParamsSchema),
    ValidationMiddleware.validate(enterpriseSearchGetSchema),
    getConversationById,
  );

  /**
   * @route DELETE /api/v1/conversations/:conversationId
   * @desc Delete conversation by ID
   * @access Private
   * @param {string} conversationId - Conversation ID
   */
  router.delete(
    '/:conversationId',
    authMiddleware.authenticate,
    metricsMiddleware(container),
    ValidationMiddleware.validate(conversationIdParamsSchema),
    ValidationMiddleware.validate(enterpriseSearchDeleteSchema),
    deleteConversationById,
  );

  /**
   * @route POST /api/v1/conversations/:conversationId/share
   * @desc Share conversation by ID
   * @access Private
   * @param {string} conversationId - Conversation ID
   */
  router.post(
    '/:conversationId/share',
    authMiddleware.authenticate,
    metricsMiddleware(container),
    ValidationMiddleware.validate(conversationIdParamsSchema),
    ValidationMiddleware.validate(enterpriseSearchUpdateSchema),
    shareConversationById(appConfig),
  );

  /**
   * @route POST /api/v1/conversations/:conversationId/unshare
   * @desc Remove sharing access for specific users
   * @access Private
   * @param {string} conversationId - Conversation ID
   * @body {
   *   userIds: string[] - Array of user IDs to unshare with
   * }
   */
  router.post(
    '/:conversationId/unshare',
    authMiddleware.authenticate,
    metricsMiddleware(container),
    ValidationMiddleware.validate(conversationIdParamsSchema),
    ValidationMiddleware.validate(enterpriseSearchUpdateSchema),
    unshareConversationById,
  );

  /**
   * @route POST /api/v1/conversations/:conversationId/message/:messageId/regenerate
   * @desc Regenerate message by ID
   * @access Private
   * @param {string} conversationId - Conversation ID
   * @param {string} messageId - Message ID
   */
  router.post(
    '/:conversationId/message/:messageId/regenerate',
    authMiddleware.authenticate,
    metricsMiddleware(container),
    ValidationMiddleware.validate(conversationParamsSchema),
    ValidationMiddleware.validate(enterpriseSearchUpdateSchema),
    regenerateAnswers(appConfig),
  );

  /**
   * @route PATCH /api/v1/conversations/:conversationId/title
   * @desc Update title for a conversation
   * @access Private
   * @param {string} conversationId - Conversation ID
   */
  router.patch(
    '/:conversationId/title',
    authMiddleware.authenticate,
    metricsMiddleware(container),
    ValidationMiddleware.validate(conversationIdParamsSchema),
    ValidationMiddleware.validate(enterpriseSearchUpdateSchema),
    updateTitle,
  );

  /**
   * @route POST /api/v1/conversations/:conversationId/message/:messageId/feedback
   * @desc Feedback message by ID
   * @access Private
   * @param {string} conversationId - Conversation ID
   * @param {string} messageId - Message ID
   */
  router.post(
    '/:conversationId/message/:messageId/feedback',
    authMiddleware.authenticate,
    metricsMiddleware(container),
    ValidationMiddleware.validate(conversationParamsSchema),
    ValidationMiddleware.validate(enterpriseSearchUpdateSchema),
    updateFeedback,
  );

  /**
   * @route PATCH /api/v1/conversations/:conversationId/
   * @desc Archive Conversation by Conversation ID
   * @access Private
   * @param {string} conversationId - Conversation ID
   */
  router.patch(
    '/:conversationId/archive',
    authMiddleware.authenticate,
    metricsMiddleware(container),
    ValidationMiddleware.validate(conversationIdParamsSchema),
    ValidationMiddleware.validate(enterpriseSearchUpdateSchema),
    archiveConversation,
  );

  /**
   * @route PATCH /api/v1/conversations/:conversationId/
   * @desc Archive Conversation by Conversation ID
   * @access Private
   * @param {string} conversationId - Conversation ID
   */
  router.patch(
    '/:conversationId/unarchive',
    authMiddleware.authenticate,
    metricsMiddleware(container),
    ValidationMiddleware.validate(conversationIdParamsSchema),
    ValidationMiddleware.validate(enterpriseSearchUpdateSchema),
    unarchiveConversation,
  );

  /**
   * @route PATCH /api/v1/conversations/:conversationId/
   * @desc Archive Conversation by Conversation ID
   * @access Private
   * @param {string} conversationId - Conversation ID
   */
  router.get(
    '/show/archives',
    authMiddleware.authenticate,
    metricsMiddleware(container),
    listAllArchivesConversation,
  );

  return router;
}

export function createSemanticSearchRouter(container: Container): Router {
  const router = Router();
  const authMiddleware = container.get<AuthMiddleware>('AuthMiddleware');
  const appConfig = container.get<AppConfig>('AppConfig');

  router.post(
    '/',
    authMiddleware.authenticate,
    metricsMiddleware(container),
    ValidationMiddleware.validate(enterpriseSearchSearchSchema),
    enterpriseSemanticSearch(appConfig),
  );

  router.get(
    '/',
    authMiddleware.authenticate,
    metricsMiddleware(container),
    ValidationMiddleware.validate(enterpriseSearchSearchHistorySchema),
    searchHistory,
  );

  return router;
}
