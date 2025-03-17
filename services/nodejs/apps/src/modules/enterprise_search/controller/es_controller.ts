import { buildMessageSortOptions } from './../utils/utils';
import { Response, NextFunction } from 'express';
import mongoose, { ClientSession } from 'mongoose';
import { AuthenticatedUserRequest } from '../../../libs/middlewares/types';
import { Logger } from '../../../libs/services/logger.service';
import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from '../../../libs/errors/http.errors';
import {
  AICommandOptions,
  AIServiceCommand,
} from '../../../libs/commands/ai_service/ai.service.command';
import { HttpMethod } from '../../../libs/enums/http-methods.enum';
import { CitationModel } from '../citations/citations.schema';
import {
  AIServiceResponse,
  IAIResponse,
  IConversationDocument,
  IMessage,
  IMessageCitation,
  IMessageDocument,
} from '../types/es_interfaces';
import { IConversation } from '../types/es_interfaces';
import { EnterpriseSearchConversation } from '../schema/es_schema';
import { HTTP_STATUS } from '../../../libs/enums/http-status.enum';
import {
  addComputedFields,
  buildAIResponseMessage,
  buildFiltersMetadata,
  buildConversationResponse,
  buildFilter,
  buildMessageFilter,
  buildPaginationMetadata,
  buildSharedWithMeFilter,
  buildSortOptions,
  buildUserQueryMessage,
  formatPreviousConversations,
  getPaginationParams,
  sortMessages,
} from '../utils/utils';
import {
  ICitationDocument,
} from '../citations/citations.interface';
import { CONVERSATION_SOURCE } from '../constants/constants';
import { IAMServiceCommand } from '../../../libs/commands/iam/iam.service.command';

const logger = Logger.getInstance({ service: 'Enterprise Search Service' });
const rsAvailable = process.env.REPLICA_SET_AVAILABLE === 'true';
// Extract common operations into a helper function
export const createConversation = async (
  req: AuthenticatedUserRequest,
  res: Response,
  next: NextFunction,
) => {
  const requestId = req.context?.requestId;
  const startTime = Date.now();
  const userId = req.user?.userId;
  const orgId = req.user?.orgId;

  let session: ClientSession | null = null;
  let responseData: any;

  // Helper function that contains the common conversation operations.
  async function createConversationUtil(
    session?: ClientSession | null,
  ): Promise<any> {
    const aiCommandOptions: AICommandOptions = {
      uri: `${process.env.AI_BACKEND_URL}/api/v1/chatbot`,
      method: HttpMethod.POST,
      headers: req.headers as Record<string, string>,
      body: {
        query: req.body.query,
        // conversationSource: req.body.conversationSource,
        // conversationSourceRecordId: req.body.conversationSourceRecordId,
        previousConversations: req.body.previousConversations || [],
        recordIds: req.body.recordIds || [],
      },
    };

    logger.debug('Sending query to AI service', {
      requestId,
      query: req.body.query,
    });
    const aiServiceCommand = new AIServiceCommand(aiCommandOptions);
    const aiResponseData =
      (await aiServiceCommand.execute()) as AIServiceResponse<IAIResponse>;
    if (!aiResponseData?.data || aiResponseData.statusCode !== 200) {
      throw new InternalServerError(
        'Failed to get AI response',
        aiResponseData?.data,
      );
    }

    const citations = await Promise.all(
      aiResponseData.data?.citations?.map(async (citation: any) => {
        const newCitation = await CitationModel.createFromAIResponse(
          citation,
          orgId,
        );
        // Save with session if provided, otherwise save normally.
        return session ? newCitation.save({ session }) : newCitation.save();
      }) || [],
    );

    const messages = [
      buildUserQueryMessage(req.body.query),
      buildAIResponseMessage(
        aiResponseData,
        citations.map((citation: ICitationDocument) => ({
          citationId: (citation as mongoose.Document).id.toString(),
        })),
      ),
    ];

    const conversationData: Partial<IConversation> = {
      orgId,
      userId,
      initiator: userId,
      title: req.body.query.slice(0, 100),
      messages: messages as IMessageDocument[],
      lastActivityAt: new Date(),
      conversationSource: req.body.conversationSource,
    };

    if (req.body.conversationSourceRecordId) {
      conversationData.conversationSourceRecordId =
        req.body.conversationSourceRecordId;
    }

    const conversation = new EnterpriseSearchConversation(conversationData);
    // Save conversation, using the session if available.
    const savedConversation = session
      ? await conversation.save({ session })
      : await conversation.save();
    if (!savedConversation) {
      throw new InternalServerError('Failed to create conversation');
    }
    const plainConversation: IConversation = savedConversation.toObject();
    return {
      conversation: {
        _id: savedConversation._id,
        ...plainConversation,
        messages: plainConversation.messages.map((message) => ({
          ...message,
          citations: message.citations?.map((citation) => ({
            ...citation,
            citationData: citations.find(
              (c: ICitationDocument) =>
                (c as mongoose.Document).id.toString() ===
                citation.citationId?.toString(),
            ),
          })),
        })),
      },
    };
  }

  try {
    logger.debug('Creating new conversation', {
      requestId,
      userId,
      query: req.body.query,
      conversationSource: req.body.conversationSource,
      conversationSourceRecordId: req.body.conversationSourceRecordId,
      filters: {
        recordIds: req.body.recordIds,
        modules: req.body.modules,
        departments: req.body.departments,
        searchTags: req.body.searchTags,
        appSpecificRecordType: req.body.appSpecificRecordType,
      },
      timestamp: new Date().toISOString(),
    });

    if (rsAvailable) {
      // Start a session and run the operations inside a transaction.
      session = await mongoose.startSession();
      responseData = await session.withTransaction(() =>
        createConversationUtil(session),
      );
    } else {
      // Execute without session/transaction.
      responseData = await createConversationUtil();
    }

    logger.debug('Conversation created successfully', {
      requestId,
      conversationId: responseData.conversation._id,
      conversationSource: req.body.conversationSource,
      conversationSourceRecordId: req.body.conversationSourceRecordId,
      duration: Date.now() - startTime,
    });

    res.status(HTTP_STATUS.CREATED).json({
      ...responseData,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        conversationSource: req.body.conversationSource,
        conversationSourceRecordId: req.body.conversationSourceRecordId,
      },
    });
  } catch (error: any) {
    logger.error('Error creating conversation', {
      requestId,
      message: 'Error creating conversation',
      error: error.message,
      stack: error.stack,
      conversationSource: req.body.conversationSource,
      conversationSourceRecordId: req.body.conversationSourceRecordId,
      duration: Date.now() - startTime,
    });

    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
    next(error);
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

export const addMessage = async (
  req: AuthenticatedUserRequest,
  res: Response,
  next: NextFunction,
) => {
  const requestId = req.context?.requestId;
  const startTime = Date.now();
  let session: ClientSession | null = null;

  try {
    const userId = req.user?.userId;
    const orgId = req.user?.orgId;

    logger.debug('Adding message to conversation', {
      requestId,
      message: 'Adding message to conversation',
      conversationId: req.params.conversationId,
      query: req.body.query,
      filters: {
        recordIds: req.body.recordIds,
        modules: req.body.modules,
        departments: req.body.departments,
        searchTags: req.body.searchTags,
        appSpecificRecordType: req.body.appSpecificRecordType,
      },
      timestamp: new Date().toISOString(),
    });

    // Extract common operations into a helper function.
    async function performAddMessage(session?: ClientSession | null) {
      // Get existing conversation
      const conversation = await EnterpriseSearchConversation.findOne({
        _id: req.params.conversationId,
        orgId,
        userId,
        isDeleted: false,
      });

      if (!conversation) {
        throw new NotFoundError('Conversation not found');
      }

      // Format previous conversations for context
      const previousConversations = formatPreviousConversations(
        conversation.messages,
      );
      logger.debug('Previous conversations', {
        previousConversations,
      });

      logger.debug('Sending query to AI service', {
        requestId,
        payload: {
          query: req.body.query,
          previousConversations,
        },
      });

      const aiCommandOptions: AICommandOptions = {
        uri: `${process.env.AI_BACKEND_URL}/api/v1/chatbot`,
        method: HttpMethod.POST,
        headers: req.headers as Record<string, string>,
        body: {
          query: req.body.query,
          previousConversations: previousConversations,
          recordIds: req.body.recordIds || [],
        },
      };

      const aiServiceCommand = new AIServiceCommand(aiCommandOptions);
      const aiResponseData =
        (await aiServiceCommand.execute()) as AIServiceResponse<IAIResponse>;

      if (!aiResponseData?.data || aiResponseData.statusCode !== 200) {
        throw new InternalServerError(
          'Failed to get AI response',
          aiResponseData?.data,
        );
      }

      const citations: ICitationDocument[] = await Promise.all(
        aiResponseData.data?.citations?.map(async (citation: any) => {
          const newCitation = await CitationModel.createFromAIResponse(
            citation,
            orgId,
          );
          return session ? newCitation.save({ session }) : newCitation.save();
        }) || [],
      );

      const messages = [
        buildUserQueryMessage(req.body.query),
        buildAIResponseMessage(
          aiResponseData,
          citations.map((citation) => ({
            citationId: (citation as mongoose.Document).id.toString(),
          })),
        ),
      ];

      // Update conversation: push new messages and update lastActivityAt
      const updatedConversation =
        await EnterpriseSearchConversation.findByIdAndUpdate(
          req.params.conversationId,
          {
            $push: { messages: { $each: messages } },
            $set: { lastActivityAt: new Date() },
          },
          {
            new: true,
            session,
            runValidators: true,
          },
        );

      if (!updatedConversation) {
        throw new InternalServerError('Failed to update conversation');
      }

      // Return the updated conversation with new messages.
      const plainConversation = updatedConversation.toObject();
      return {
        conversation: {
          ...plainConversation,
          messages: messages.map((message) => ({
            ...message,
            citations:
              message.citations?.map((citation) => ({
                ...citation,
                citationData: citations.find(
                  (c) =>
                    (c as mongoose.Document).id.toString() ===
                    citation.citationId?.toString(),
                ),
              })) || [],
          })),
        },
        recordsUsed: citations.length, // or validated record count if needed
      };
    }

    let responseData;
    if (rsAvailable) {
      session = await mongoose.startSession();
      responseData = await session.withTransaction(() =>
        performAddMessage(session),
      );
    } else {
      responseData = await performAddMessage();
    }

    logger.debug('Message added successfully', {
      requestId,
      message: 'Message added successfully',
      conversationId: req.params.conversationId,
      duration: Date.now() - startTime,
    });

    res.status(HTTP_STATUS.OK).json({
      ...responseData,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        recordsUsed: responseData.recordsUsed,
      },
    });
  } catch (error: any) {
    logger.error('Error adding message', {
      requestId,
      message: 'Error adding message',
      conversationId: req.params.conversationId,
      error: error.message,
      stack: error.stack,
      duration: Date.now() - startTime,
    });

    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
    return next(error);
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

export const getAllConversations = async (
  req: AuthenticatedUserRequest,
  res: Response,
  next: NextFunction,
) => {
  const requestId = req.context?.requestId;
  const startTime = Date.now();
  try {
    const userId = req.user?.userId;
    const orgId = req.user?.orgId;
    const {
      conversationSource,
      conversationSourceRecordId,
      conversationId,
      conversationSourceConnectorIds,
      conversationSourceRecordType,
      conversationSourceConnectorTypes,
    } = req.query;
    logger.debug('Fetching conversations', {
      requestId,
      message: 'Fetching conversations',
      userId,
      conversationSource: req.query.conversationSource,
      conversationSourceRecordId: req.query.conversationSourceRecordId,
      conversationId: req.query.conversationId,
      conversationSourceConnectorIds: req.query.conversationSourceConnectorIds,
      conversationSourceRecordType: req.query.conversationSourceRecordType,
      conversationSourceConnectorTypes:
        req.query.conversationSourceConnectorTypes,
      query: req.query,
    });

    const { skip, limit, page } = getPaginationParams(req);
    const filter = buildFilter(
      req,
      orgId,
      userId,
      conversationId as string,
      conversationSource as string,
      conversationSourceRecordId as string,
      conversationSourceConnectorIds as string[],
      conversationSourceRecordType as string,
      conversationSourceConnectorTypes as string[],
    );
    const sortOptions = buildSortOptions(req);

    // sharedWith Me Conversation
    const sharedWithMeFilter = buildSharedWithMeFilter(req);

    // Execute query
    const [conversations, totalCount, sharedWithMeConversations] =
      await Promise.all([
        EnterpriseSearchConversation.find(filter)
          .sort(sortOptions as any)
          .skip(skip)
          .limit(limit)
          .select('-__v')
          .select('-messages')
          .lean()
          .exec(),
        EnterpriseSearchConversation.countDocuments(filter),
        EnterpriseSearchConversation.find(sharedWithMeFilter)
          .sort(sortOptions as any)
          .skip(skip)
          .limit(limit)
          .select('-__v')
          .select('-messages')
          .select('-sharedWith')
          .lean()
          .exec(),
      ]);

    const processedConversations = conversations.map((conversation: any) => {
      const conversationWithComputedFields = addComputedFields(
        conversation as IConversation,
        userId,
      );
      return {
        ...conversationWithComputedFields,
      };
    });
    const processedSharedWithMeConversations = sharedWithMeConversations.map(
      (sharedWithMeConversation) => {
        const conversationWithComputedFields = addComputedFields(
          sharedWithMeConversation as IConversation,
          userId,
        );
        return {
          ...conversationWithComputedFields,
        };
      },
    );

    // Build response metadata
    const response = {
      conversations: processedConversations,
      sharedWithMeConversations: processedSharedWithMeConversations,
      pagination: buildPaginationMetadata(totalCount, page, limit),
      filters: buildFiltersMetadata(filter, req.query),
      meta: {
        requestId,
        conversationSource,
        conversationSourceRecordId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      },
    };

    logger.debug('Successfully fetched conversations', {
      requestId,
      count: conversations.length,
      totalCount,
      conversationSource: req.query.conversationSource,
      conversationSourceRecordId: req.query.conversationSourceRecordId,
      duration: Date.now() - startTime,
    });

    res.status(200).json(response);
  } catch (error: any) {
    logger.error('Error fetching conversations', {
      requestId,
      message: 'Error fetching conversations',
      error: error.message,
      stack: error.stack,
      duration: Date.now() - startTime,
    });
    next(error);
  }
};

export const getConversationById = async (
  req: AuthenticatedUserRequest,
  res: Response,
  next: NextFunction,
) => {
  const requestId = req.context?.requestId;
  const startTime = Date.now();
  const { conversationId } = req.params;
  try {
    const { sortBy = 'createdAt', sortOrder = 'desc', ...query } = req.query;
    const userId = req.user?.userId;
    const orgId = req.user?.orgId;

    logger.debug('Fetching conversation by ID', {
      requestId,
      conversationId,
      userId,
      timestamp: new Date().toISOString(),
    });
    // Get pagination parameters
    const { page, limit } = getPaginationParams(req);

    // Build the base filter with access control
    const baseFilter = buildFilter(req, orgId, userId, conversationId);

    // Build message filter
    const messageFilter = buildMessageFilter(req);

    // Get sort options for messages
    const messageSortOptions = buildMessageSortOptions(
      sortBy as string,
      sortOrder as string,
    );

    const countResult = await EnterpriseSearchConversation.aggregate([
      { $match: baseFilter },
      { $project: { messageCount: { $size: '$messages' } } },
    ]);

    if (!countResult.length) {
      throw new NotFoundError('Conversation not found');
    }

    const totalMessages = countResult[0].messageCount;

    // Calculate skip and limit for backward pagination
    const skip = Math.max(0, totalMessages - page * limit);
    const effectiveLimit = Math.min(limit, totalMessages - skip);

    // Get conversation with paginated messages
    const conversationWithMessages: IConversationDocument | null =
      await EnterpriseSearchConversation.findOne(baseFilter)
        .select({
          messages: { $slice: [skip, effectiveLimit] },
          title: 1,
          initiator: 1,
          createdAt: 1,
          isShared: 1,
          sharedWith: 1,
        })
        .populate({
          path: 'messages.citations.citationId',
          model: 'citations',
          select: '-__v',
        });

    // Sort messages using existing helper
    const sortedMessages = sortMessages(
      conversationWithMessages?.messages || [],
      messageSortOptions as { field: keyof IMessage },
    );

    // Build conversation response using existing helper
    const conversationResponse = buildConversationResponse(
      conversationWithMessages as IConversationDocument,
      userId,
      {
        page,
        limit,
        skip,
        totalMessages,
        hasNextPage: skip > 0,
        hasPrevPage: skip + effectiveLimit < totalMessages,
      },
      sortedMessages,
    );

    // Build filters metadata using existing helper
    const filtersMetadata = buildFiltersMetadata(
      messageFilter,
      query,
      messageSortOptions,
    );

    // Prepare response using existing format
    const response = {
      conversation: conversationResponse,
      filters: filtersMetadata,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        conversationId,
        messageCount: totalMessages,
      },
    };

    logger.debug('Conversation fetched successfully', {
      requestId,
      conversationId,
      duration: Date.now() - startTime,
    });

    res.status(200).json(response);
  } catch (error: any) {
    logger.error('Error fetching conversation', {
      requestId,
      conversationId,
      error: error.message,
      stack: error.stack,
      duration: Date.now() - startTime,
    });

    next(error);
  }
};

export const deleteConversationById = async (
  req: AuthenticatedUserRequest,
  res: Response,
  next: NextFunction,
) => {
  const requestId = req.context?.requestId;
  const startTime = Date.now();
  let session: ClientSession | null = null;
  const { conversationId } = req.params;

  try {
    const userId = req.user?.userId;
    const orgId = req.user?.orgId;

    logger.debug('Attempting to delete conversation', {
      requestId,
      message: 'Attempting to delete conversation',
      conversationId,
      userId,
      timestamp: new Date().toISOString(),
    });

    // Common helper that performs the delete operation.
    async function performDeleteConversation(session?: ClientSession | null) {
      // Get conversation with access control
      const conversation: IConversation | null =
        await EnterpriseSearchConversation.findOne({
          _id: conversationId,
          userId,
          orgId,
          isDeleted: false,
          $or: [
            { initiator: userId },
            { 'sharedWith.userId': userId, 'sharedWith.accessLevel': 'write' },
          ],
        });

      if (!conversation) {
        throw new NotFoundError('Conversation not found');
      }

      // Perform soft delete on the conversation
      const updatedConversation =
        await EnterpriseSearchConversation.findByIdAndUpdate(
          conversationId,
          {
            $set: {
              isDeleted: true,
              deletedBy: userId,
              lastActivityAt: new Date(),
            },
          },
          {
            new: true,
            session,
            runValidators: true,
          },
        );

      if (!updatedConversation) {
        throw new InternalServerError('Failed to delete conversation');
      }

      // Extract all citation IDs from messages
      const citationIds = conversation.messages
        .filter((msg: IMessage) => msg.citations && msg.citations.length)
        .flatMap((msg: IMessage) =>
          msg.citations?.map(
            (citation: IMessageCitation) => citation.citationId,
          ),
        );

      // Update all associated citations if any exist
      if (citationIds.length > 0) {
        await CitationModel.updateMany(
          {
            _id: { $in: citationIds },
            orgId,
            isDeleted: false,
          },
          {
            $set: {
              isDeleted: true,
              deletedBy: userId,
            },
          },
          { session: session || undefined },
        );
      }

      return { updatedConversation, citationIds };
    }

    let result;
    if (rsAvailable) {
      session = await mongoose.startSession();
      session.startTransaction();
      result = await session.withTransaction(() =>
        performDeleteConversation(session),
      );
      await session.commitTransaction();
    } else {
      result = await performDeleteConversation();
    }

    const response = {
      id: conversationId,
      status: 'deleted',
      deletedAt: result.updatedConversation.updatedAt,
      deletedBy: userId,
      citationsDeleted: result.citationIds.length,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      },
    };

    logger.debug('Conversation deleted successfully', {
      requestId,
      message: 'Conversation deleted successfully',
      conversationId,
      duration: Date.now() - startTime,
    });

    res.status(200).json(response);
  } catch (error: any) {
    logger.error('Error deleting conversation', {
      requestId,
      message: 'Error deleting conversation',
      conversationId,
      error: error.message,
      stack: error.stack,
      duration: Date.now() - startTime,
    });

    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
    next(error);
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

export const shareConversationById = async (
  req: AuthenticatedUserRequest,
  res: Response,
  next: NextFunction,
) => {
  const requestId = req.context?.requestId;
  const startTime = Date.now();
  let session: ClientSession | null = null;
  const { conversationId } = req.params;
  let { userIds, accessLevel } = req.body;
  try {
    const userId = req.user?.userId;
    const orgId = req.user?.orgId;

    logger.debug('Attempting to share conversation', {
      requestId,
      conversationId,
      userIds,
      accessLevel,
      timestamp: new Date().toISOString(),
    });

    async function performShareConversation(session?: ClientSession | null) {
      // Validate request body
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        throw new BadRequestError('userIds is required and must be an array');
      }

      if (accessLevel && !['read', 'write'].includes(accessLevel)) {
        throw new BadRequestError(
          "Invalid access level. Must be 'read' or 'write'",
        );
      }

      // Start transaction
      session = await mongoose.startSession();
      session.startTransaction();

      // Get conversation with access control
      const conversation: IConversation | null =
        await EnterpriseSearchConversation.findOne({
          _id: conversationId,
          orgId,
          userId,
          isDeleted: false,
          initiator: userId, // Only initiator can share
        });

      if (!conversation) {
        throw new NotFoundError('Conversation not found or unauthorized');
      }

      // Update object for conversation
      const updateObject: Partial<IConversation> = {
        isShared: true,
      };

      // Set shareLink based on conversation source
      if (
        conversation.conversationSource ===
        CONVERSATION_SOURCE.ENTERPRISE_SEARCH
      ) {
        updateObject.shareLink = `${process.env.FRONTEND_URL}/enterprise-search/${conversationId}`;
      } else if (
        conversation.conversationSource === CONVERSATION_SOURCE.RECORDS
      ) {
        updateObject.shareLink = `${process.env.FRONTEND_URL}/knowledge-base/records/${conversation.conversationSourceRecordId}`;
      }

      // Handle user-specific sharing
      // Validate all user IDs
      const validUsers = await Promise.all(
        userIds.map(async (id) => {
          if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new BadRequestError(`Invalid user ID format: ${id}`);
          }
          try {
            const iamCommand = new IAMServiceCommand({
              uri: `${process.env.IAM_SERVICE_URL}/api/v1/users/${id}`,
              method: HttpMethod.GET,
              headers: req.headers as Record<string, string>,
            });
            const userResponse = await iamCommand.execute();
            if (userResponse && userResponse.statusCode !== 200) {
              throw new BadRequestError(`User not found: ${id}`);
            }
          } catch (exception) {
            logger.debug(`User does not exist: ${id}`, {
              requestId,
            });
            throw new BadRequestError(`User not found: ${id}`);
          }
          return {
            userId: id,
            accessLevel: accessLevel || 'read',
          };
        }),
      );

      // Get existing shared users
      const existingSharedWith = conversation.sharedWith || [];

      // Create a map of existing users for quick lookup
      const existingUserMap = new Map(
        existingSharedWith.map((share) => [share.userId.toString(), share]),
      );

      // Merge existing and new users, updating access levels for existing users if they're in the new list
      const mergedSharedWith = [...existingSharedWith];

      for (const newUser of validUsers) {
        const existingUser = existingUserMap.get(newUser.userId.toString());
        if (existingUser) {
          // Update access level if user already exists
          existingUser.accessLevel = newUser.accessLevel;
        } else {
          // Add new user if they don't exist
          mergedSharedWith.push(newUser);
        }
      }

      // Update sharedWith array with merged users
      updateObject.sharedWith = mergedSharedWith;

      // Update the conversation
      const updatedConversation =
        await EnterpriseSearchConversation.findByIdAndUpdate(
          conversationId,
          updateObject,
          {
            new: true,
            session,
            runValidators: true,
          },
        );

      if (!updatedConversation) {
        throw new InternalServerError('Failed to update conversation sharing settings');
      }
      return updatedConversation;
    }

    let updatedConversation: IConversationDocument | null = null;
    if (rsAvailable) {
      session = await mongoose.startSession();
      session.startTransaction();
      updatedConversation = await performShareConversation(session);
      await session.commitTransaction();
    } else {
      updatedConversation = await performShareConversation();
    }

    logger.debug('Conversation shared successfully', {
      requestId,
      conversationId,
      duration: Date.now() - startTime,
    });

    // Prepare response
    const response = {
      id: updatedConversation._id,
      isShared: updatedConversation.isShared,
      shareLink: updatedConversation.shareLink,
      sharedWith: updatedConversation.sharedWith,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      },
    };

    res.status(200).json(response);
  } catch (error: any) {
    logger.error('Error sharing conversation', {
      requestId,
      message: 'Error sharing conversation',
      conversationId,
      error: error.message,
      stack: error.stack,
      duration: Date.now() - startTime,
    });

    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
    next(error);
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

export const unshareConversationById = async (
  req: AuthenticatedUserRequest,
  res: Response,
  next: NextFunction,
) => {
  const requestId = req.context?.requestId;
  const startTime = Date.now();
  let session: ClientSession | null = null;
  const { conversationId } = req.params;
  try {
    const { userIds } = req.body;
    const userId = req.user?.userId;
    const orgId = req.user?.orgId;

    logger.debug('Attempting to unshare conversation', {
      requestId,
      conversationId,
      userId,
      timestamp: new Date().toISOString(),
    });

    // Validate request body
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      throw new BadRequestError('userIds is required and must be an array');
    }

    // Validate all user IDs format
    userIds.forEach((id) => {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new BadRequestError(`Invalid user ID format: ${id}`);
      }
    });

    async function performUnshareConversation(session?: ClientSession | null) {
      // Get conversation with access control
      const conversation = await EnterpriseSearchConversation.findOne({
        _id: conversationId,
        orgId,
        isDeleted: false,
        initiator: userId, // Only initiator can unshare
      });

      if (!conversation) {
        throw new NotFoundError('Conversation not found or unauthorized');
      }

      // Get existing shared users
      const existingSharedWith = conversation.sharedWith || [];

      // Remove specified users from sharedWith array
      const updatedSharedWith = existingSharedWith.filter(
        (share) => !userIds.includes(share.userId.toString()),
      );

      // Prepare update object
      const updateObject: Partial<IConversation> = {
        sharedWith: updatedSharedWith,
      };

      // If no more shares exist, update isShared and remove shareLink
      if (updatedSharedWith.length === 0) {
        updateObject.isShared = false;
        updateObject.shareLink = undefined;
      }

      // Update the conversation
      const updatedConversation =
        await EnterpriseSearchConversation.findByIdAndUpdate(
          conversationId,
          updateObject,
          {
            new: true,
            session,
            runValidators: true,
          },
        );

      if (!updatedConversation) {
        throw new InternalServerError('Failed to update conversation sharing settings');
      }
      return updatedConversation;
    }

    let updatedConversation: IConversationDocument | null = null;
    if (rsAvailable) {
      session = await mongoose.startSession();
      session.startTransaction();
      updatedConversation = await performUnshareConversation(session);
      await session.commitTransaction();
    } else {
      updatedConversation = await performUnshareConversation();
    }

    logger.debug('Conversation unshared successfully', {
      requestId,
      conversationId,
      duration: Date.now() - startTime,
    });

    // Prepare response
    const response = {
      id: updatedConversation._id,
      isShared: updatedConversation.isShared,
      shareLink: updatedConversation.shareLink,
      sharedWith: updatedConversation.sharedWith,
      unsharedUsers: userIds,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      },
    };

    res.status(200).json(response);
  } catch (error: any) {
    logger.error('Error un-sharing conversation', {
      requestId,
      conversationId,
      error: error.message,
      stack: error.stack,
      duration: Date.now() - startTime,
    });

    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
    next(error);
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

export const regenerateAnswers = async (
  req: AuthenticatedUserRequest,
  res: Response,
  next: NextFunction,
) => {
  const rsAvailable = process.env.REPLICA_SET_AVAILABLE === 'true';
  const requestId = req.context?.requestId;
  const startTime = Date.now();
  let session: ClientSession | null = null;
  const { conversationId, messageId } = req.params;
  try {
    const userId = req.user?.userId;
    const orgId = req.user?.orgId;

    logger.debug('Attempting to regenerate answers', {
      requestId,
      conversationId,
      messageId,
      timestamp: new Date().toISOString(),
    });

    // Common helper that performs all operations needed to regenerate the answer.
    async function performRegenerateAnswers(session?: ClientSession | null) {
      // Get conversation with access control
      const conversation = await EnterpriseSearchConversation.findOne({
        _id: conversationId,
        orgId,
        userId,
        isDeleted: false,
        $or: [
          { initiator: userId },
          { 'sharedWith.userId': userId },
          { isShared: true },
        ],
      });

      if (!conversation) {
        throw new NotFoundError('Conversation not found or unauthorized');
      }

      // Ensure there are messages
      if (!conversation.messages || conversation.messages.length === 0) {
        throw new BadRequestError('No messages found in conversation');
      }

      // Get the last message and validate it
      const lastMessage: IMessageDocument =
        conversation.messages[conversation.messages.length - 1] as IMessageDocument;
      if (lastMessage._id?.toString() === messageId) {
        throw new BadRequestError(
          'Can only regenerate the last message in the conversation',
        );
      }
      if (lastMessage.messageType !== 'bot_response') {
        throw new BadRequestError('Can only regenerate bot response messages');
      }

      // Get user query from the previous message
      if (conversation.messages.length < 2) {
        throw new BadRequestError('No user query found to regenerate response');
      }
      const userQuery = conversation.messages[conversation.messages.length - 2] as IMessageDocument;
      if (userQuery.messageType !== 'user_query') {
        throw new BadRequestError('Previous message must be a user query');
      }

      // Format previous conversations up to this message
      const previousConversations = formatPreviousConversations(
        conversation.messages.slice(0, -2), // Exclude last bot response and user query
      );

      let recordIds = [];
      if (conversation.conversationSource === CONVERSATION_SOURCE.RECORDS) {
        recordIds.push(conversation.conversationSourceRecordId?.toString());
      }

      // Get new AI response
      const aiCommand = new AIServiceCommand({
        uri: `${process.env.AI_BACKEND_URL}/api/v1/chatbot`,
        method: HttpMethod.POST,
        headers: req.headers as Record<string, string>,
        body: {
          query: userQuery.content,
          previousConversations: previousConversations || [],
          recordIds: recordIds || [],
        },
      });
      const aiResponse =
        (await aiCommand.execute()) as AIServiceResponse<IAIResponse>;
      if (!aiResponse || aiResponse.statusCode !== 200) {
        throw new InternalServerError(
          'Failed to get response from AI service',
          aiResponse?.data,
        );
      }

      // Create and save citations
      const citations: ICitationDocument[] = await Promise.all(
        aiResponse.data?.citations?.map(async (citation: any) => {
          const newCitation = await CitationModel.createFromAIResponse(
            citation,
            orgId,
          );
          return newCitation.save({ session });
        }) || [],
      );

      // Build new AI message (preserving the same message _id)
      const newMessage = {
        _id: lastMessage._id,
        ...buildAIResponseMessage(
          aiResponse,
          citations.map((citation) => ({
            citationId: (citation as mongoose.Document).id.toString(),
          })),
        ),
      };

      // Update conversation with the new message
      const updatedConversation =
        await EnterpriseSearchConversation.findOneAndUpdate(
          { _id: conversationId },
          {
            $set: {
              [`messages.${conversation.messages.length - 1}`]: newMessage,
              lastActivityAt: new Date(),
            },
          },
          {
            new: true,
            session,
            runValidators: true,
          },
        );
      if (!updatedConversation) {
        throw new InternalServerError('Failed to update conversation');
      }

      return {
        conversation: {
          id: updatedConversation._id,
          messages: [
            {
              ...newMessage,
              citations:
                newMessage.citations?.map((citation) => ({
                  citationId: citation.citationId,
                  citationData: citations.find(
                    (c) =>
                      (c as mongoose.Document).id.toString() ===
                      citation.citationId?.toString(),
                  ),
                })) || [],
            },
          ],
        },
      };
    }

    let responseData;
    if (rsAvailable) {
      session = await mongoose.startSession();
      responseData = await session.withTransaction(() =>
        performRegenerateAnswers(session),
      );
    } else {
      responseData = await performRegenerateAnswers();
    }

    if (session && rsAvailable) {
      await session.commitTransaction();
    }

    logger.debug('Answer regenerated successfully', {
      requestId,
      conversationId,
      messageId,
      duration: Date.now() - startTime,
    });

    res.status(200).json({
      ...responseData,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      },
    });
  } catch (error: any) {
    logger.error('Error regenerating answer', {
      requestId,
      conversationId,
      messageId,
      error: error.message,
      stack: error.stack,
      duration: Date.now() - startTime,
    });
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
    next(error);
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

export const updateTitle = async (
  req: AuthenticatedUserRequest,
  res: Response,
  next: NextFunction,
) => {
  const requestId = req.context?.requestId;
  const startTime = Date.now();
  let session: ClientSession | null = null;
  try {
    const { conversationId } = req.params;
    const userId = req.user?.userId;
    const orgId = req.user?.orgId;

    logger.debug('Attempting to update conversation title', {
      requestId,
      message: 'Attempting to update conversation title',
      conversationId: req.params.conversationId,
      userId,
      title: req.body.title,
      timestamp: new Date().toISOString(),
    });

    session = await mongoose.startSession();
    session.startTransaction();

    const conversation = await EnterpriseSearchConversation.findOne({
      _id: conversationId,
      orgId,
      userId,
      isDeleted: false,
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    conversation.title = req.body.title;
    await conversation.save();

    const response = {
      conversation: {
        ...conversation.toObject(),
        title: conversation.title,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      },
    };

    logger.debug('Conversation title updated successfully', {
      requestId,
      message: 'Conversation title updated successfully',
      conversationId,
      duration: Date.now() - startTime,
    });

    res.status(HTTP_STATUS.OK).json(response);
  } catch (error: any) {
    logger.error('Error updating conversation title', {
      requestId,
      message: 'Error updating conversation title',
      error: error.message,
      stack: error.stack,
      duration: Date.now() - startTime,
    });
    next(error);
  }
};

export const updateFeedback = async (
  req: AuthenticatedUserRequest,
  res: Response,
  next: NextFunction,
) => {
  const requestId = req.context?.requestId;
  const startTime = Date.now();
  let session: ClientSession | null = null;
  try {
    const { conversationId, messageId } = req.params;
    const userId = req.user?.userId;
    const orgId = req.user?.orgId;

    logger.debug('Attempting to update conversation feedback', {
      requestId,
      message: 'Attempting to update conversation feedback',
      conversationId: req.params.conversationId,
      userId,
      feedback: req.body.feedback,
      timestamp: new Date().toISOString(),
    });

    session = await mongoose.startSession();
    session.startTransaction();

    const conversation = await EnterpriseSearchConversation.findOne({
      _id: conversationId,
      orgId,
      userId,
      isDeleted: false,
      $or: [
        { initiator: userId },
        { 'sharedWith.userId': userId },
        { isShared: true },
      ],
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    // Find the specific message
    const messageIndex = conversation.messages.findIndex(
      (msg) => msg._id?.toString() === messageId,
    );

    if (messageIndex === -1) {
      throw new NotFoundError('Message not found');
    }

    // Check if message is a user query
    if (conversation.messages[messageIndex]?.messageType === 'user_query') {
      throw new BadRequestError('Feedback is not allowed for user queries');
    }

    // Update message feedback
    // Prepare feedback entry
    const feedbackEntry = {
      ...req.body,
      feedbackProvider: userId,
      timestamp: new Date(),
      metrics: {
        timeToFeedback:
          Date.now() - Number(conversation.messages[messageIndex]?.createdAt),
        userInteractionTime: req.body.metrics?.userInteractionTime,
        feedbackSessionId: req.body.metrics?.feedbackSessionId,
        userAgent: req.headers['user-agent'],
      },
    };

    // Update message feedback
    const updatePath = `messages.${messageIndex}.feedback`;
    const updateObject = {
      $push: { [updatePath]: feedbackEntry },
    };

    // Update conversation
    const updatedConversation =
      await EnterpriseSearchConversation.findByIdAndUpdate(
        conversationId,
        updateObject,
        {
          new: true,
          session,
          runValidators: true,
        },
      );

    if (!updatedConversation) {
      throw new InternalServerError('Failed to update feedback');
    }

    await session.commitTransaction();

    logger.debug('Feedback updated successfully', {
      requestId,
      conversationId,
      messageId,
      duration: Date.now() - startTime,
    });

    // Prepare response
    const response = {
      conversationId: updatedConversation._id,
      messageId,
      feedback: feedbackEntry,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      },
    };

    res.status(200).json(response);
  } catch (error: any) {
    logger.error('Error updating conversation feedback', {
      requestId,
      message: 'Error updating conversation feedback',
      error: error.message,
      stack: error.stack,
      duration: Date.now() - startTime,
    });
    next(error);
  }
};

export const archiveConversation = async (
  req: AuthenticatedUserRequest,
  res: Response,
  next: NextFunction,
) => {
  const requestId = req.context?.requestId;
  const startTime = Date.now();
  let session: ClientSession | null = null;
  try {
    const { conversationId } = req.params;
    const userId = req.user?.userId;
    const orgId = req.user?.orgId;

    logger.debug('Attempting to archive conversation', {
      requestId,
      message: 'Attempting to archive conversation',
      conversationId: req.params.conversationId,
      userId,
      timestamp: new Date().toISOString(),
    });

    async function performArchiveConversation(session?: ClientSession | null) {
      // Get conversation with access control
      const conversation = await EnterpriseSearchConversation.findOne({
        _id: conversationId,
        userId,
        orgId,
        isDeleted: false,
        $or: [
          { initiator: userId },
          { 'sharedWith.userId': userId, 'sharedWith.accessLevel': 'write' },
        ],
      });

      if (!conversation) {
        throw new NotFoundError(
          'Conversation not found or no archive permission',
        );
      }

      if (conversation.isArchived) {
        throw new BadRequestError('Conversation already archived');
      }

      // Perform soft delete
      const updatedConversation: IConversationDocument | null =
        await EnterpriseSearchConversation.findByIdAndUpdate(
          conversationId,
          {
            $set: {
              isArchived: true,
              archivedBy: userId,
              lastActivityAt: new Date(),
            },
          },
          {
            new: true,
            session,
            runValidators: true,
          },
        ).exec();

      if (!updatedConversation) {
        throw new InternalServerError('Failed to archive conversation');
      }

      return updatedConversation;
    }

    let updatedConversation: IConversationDocument | null = null;
    if (rsAvailable) {
      session = await mongoose.startSession();
      session.startTransaction();
      updatedConversation = await performArchiveConversation(session);
      await session.commitTransaction();
    } else {
      await performArchiveConversation();
    }

    // Prepare response
    const response = {
      id: updatedConversation?._id,
      status: 'archived',
      archivedBy: userId,
      archivedAt: updatedConversation?.updatedAt,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      },
    };

    logger.debug('Conversation archived successfully', {
      requestId,
      conversationId,
      duration: Date.now() - startTime,
    });

    res.status(HTTP_STATUS.OK).json(response);
  } catch (error: any) {
    logger.error('Error archiving conversation', {
      requestId,
      message: 'Error archiving conversation',
      error: error.message,
      stack: error.stack,
      duration: Date.now() - startTime,
    });
    next(error);
  }
};

export const unarchiveConversation = async (
  req: AuthenticatedUserRequest,
  res: Response,
  next: NextFunction,
) => {
  const requestId = req.context?.requestId;
  const startTime = Date.now();
  let session: ClientSession | null = null;
  try {
    const { conversationId } = req.params;
    const userId = req.user?.userId;
    const orgId = req.user?.orgId;

    logger.debug('Attempting to unarchive conversation', {
      requestId,
      message: 'Attempting to unarchive conversation',
      conversationId: req.params.conversationId,
      userId,
      timestamp: new Date().toISOString(),
    });

    async function performUnarchiveConversation(
      session?: ClientSession | null,
    ) {
      // Get conversation with access control
      const conversation = await EnterpriseSearchConversation.findOne({
        _id: conversationId,
        userId,
        orgId,
        isDeleted: false,
        $or: [
          { initiator: userId },
          { 'sharedWith.userId': userId, 'sharedWith.accessLevel': 'write' },
        ],
      });

      if (!conversation) {
        throw new NotFoundError(
          'Conversation not found or no unarchive permission',
        );
      }

      if (!conversation.isArchived) {
        throw new BadRequestError('Conversation is not archived');
      }

      // Perform soft delete
      const updatedConversation: IConversationDocument | null =
        await EnterpriseSearchConversation.findByIdAndUpdate(
          conversationId,
          {
            $set: {
              isArchived: false,
              archivedBy: null,
              lastActivityAt: new Date(),
            },
          },
          {
            new: true,
            session,
            runValidators: true,
          },
        ).exec();

      if (!updatedConversation) {
        throw new InternalServerError('Failed to unarchive conversation');
      }
      return updatedConversation;
    }

    let updatedConversation: IConversationDocument | null = null;
    if (rsAvailable) {
      session = await mongoose.startSession();
      session.startTransaction();
      updatedConversation = await performUnarchiveConversation(session);
      await session.commitTransaction();
    } else {
      await performUnarchiveConversation();
    }

    // Prepare response
    const response = {
      id: updatedConversation?._id,
      status: 'unarchived',
      unarchivedBy: userId,
      unarchivedAt: updatedConversation?.updatedAt,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      },
    };

    logger.debug('Conversation un-archived successfully', {
      requestId,
      conversationId,
      duration: Date.now() - startTime,
    });

    res.status(HTTP_STATUS.OK).json(response);
  } catch (error: any) {
    logger.error('Error un-archiving conversation', {
      requestId,
      message: 'Error un-archiving conversation',
      error: error.message,
    });
    next(error);
  }
};

export const listAllArchivesConversation = async (
  req: AuthenticatedUserRequest,
  res: Response,
  next: NextFunction,
) => {
  const requestId = req.context?.requestId;
  const startTime = Date.now();
  try {
    const userId = req.user?.userId;
    const orgId = req.user?.orgId;
    const {
      conversationSource,
      conversationSourceRecordId,
      conversationId,
      conversationSourceConnectorIds,
      conversationSourceRecordType,
      conversationSourceConnectorTypes,
    } = req.query;

    logger.debug('Fetching all archived conversations', {
      requestId,
      userId,
      conversationSource,
      conversationSourceRecordId,
    });

    const { skip, limit, page } = getPaginationParams(req);
    const filter = {
      ...buildFilter(
        req,
        orgId,
        userId,
        conversationId as string,
        conversationSource as string,
        conversationSourceRecordId as string,
        conversationSourceConnectorIds as string[],
        conversationSourceRecordType as string,
        conversationSourceConnectorTypes as string[],
      ),
      isArchived: true, // Add archived filter
      archivedBy: { $exists: true }, // Ensure it was properly archived
    };
    const sortOptions = buildSortOptions(req);

    // Execute query
    const [conversations, totalCount] = await Promise.all([
      EnterpriseSearchConversation.find(filter)
        .sort(sortOptions as any)
        .skip(skip)
        .limit(limit)
        .select('-__v')
        .select('-citations')
        .lean()
        .exec(),
      EnterpriseSearchConversation.countDocuments(filter),
    ]);

    // Process results with computed fields and restructured citations
    const processedConversations = conversations.map((conversation: any) => {
      const conversationWithComputedFields = addComputedFields(
        conversation as IConversation,
        userId,
      );

      return {
        ...conversationWithComputedFields,
        archivedAt: conversation.updatedAt,
        archivedBy: conversation.archivedBy,
      };
    });

    // Build response with metadata
    const response = {
      conversations: processedConversations,
      pagination: buildPaginationMetadata(totalCount, page, limit),
      filters: buildFiltersMetadata(filter, req.query),
      summary: {
        totalArchived: totalCount,
        oldestArchive: processedConversations[0]?.archivedAt,
        newestArchive:
          processedConversations[processedConversations.length - 1]?.archivedAt,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        conversationSource,
      },
    };

    logger.debug('Successfully fetched archived conversations', {
      requestId,
      count: conversations.length,
      totalCount,
      conversationSource,
      duration: Date.now() - startTime,
    });

    res.status(HTTP_STATUS.OK).json(response);
  } catch (error: any) {
    logger.error('Error fetching archived conversations', {
      requestId,
      message: 'Error fetching archived conversations',
      error: error.message,
    });
    next(error);
  }
};
