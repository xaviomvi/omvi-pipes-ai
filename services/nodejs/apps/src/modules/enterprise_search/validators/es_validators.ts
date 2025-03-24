// es_schema.ts
import { z } from 'zod';
import { CONVERSATION_SOURCE } from '../constants/constants';
import mongoose from 'mongoose';

// Regular expression for MongoDB ObjectId validation
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

// Allowed values for conversation source (adapt these as needed)
const conversationSourceEnum = z.enum([
  CONVERSATION_SOURCE.ENTERPRISE_SEARCH,
  CONVERSATION_SOURCE.RECORDS,
  CONVERSATION_SOURCE.CONNECTORS,
  CONVERSATION_SOURCE.INTERNET_SEARCH,
  CONVERSATION_SOURCE.PERSONAL_KB_SEARCH,
]);

/**
 * Schema for creating an enterprise search document.
 * This validates that:
 * - query is provided (nonempty, maximum 100000 characters)
 * - conversationSource is provided and is one of the allowed values
 * - If conversationSource is "records":
 *    - conversationSourceRecordId is required and must be a valid ObjectId
 *    - if recordIds are provided, conversationSourceRecordId must be included in them
 * - If conversationSource is "sales":
 *    - conversationSourceRecordId must NOT be provided
 * - Optionally, recordIds, modules, departments, searchTags, and appSpecificRecordType
 *   are arrays of valid ObjectIds.
 */
export const enterpriseSearchCreateSchema = z.object({
  body: z
    .object({
      query: z
        .string({ required_error: 'Query is required' })
        .min(1, { message: 'Query is required' })
        .max(100000, {
          message: 'Query exceeds maximum length of 100000 characters',
        }),
      conversationSource: conversationSourceEnum,
      conversationSourceRecordId: z
        .string()
        .regex(objectIdRegex, {
          message: 'Invalid conversation source record ID format',
        })
        .optional(),
      recordIds: z
        .array(
          z
            .string()
            .regex(objectIdRegex, { message: 'Invalid record ID format' }),
        )
        .optional(),
      modules: z
        .array(
          z
            .string()
            .regex(objectIdRegex, { message: 'Invalid module ID format' }),
        )
        .optional(),
      departments: z
        .array(
          z
            .string()
            .regex(objectIdRegex, { message: 'Invalid department ID format' }),
        )
        .optional(),
      searchTags: z
        .array(
          z
            .string()
            .regex(objectIdRegex, { message: 'Invalid search tag ID format' }),
        )
        .optional(),
      appSpecificRecordType: z
        .array(
          z
            .string()
            .regex(objectIdRegex, {
              message: 'Invalid app specific record type ID format',
            }),
        )
        .optional(),
    })
    .superRefine((data) => {
      if (data.conversationSource === CONVERSATION_SOURCE.ENTERPRISE_SEARCH) {
        // TODO: Add validation for enterprise search
      }
      if (data.conversationSource === CONVERSATION_SOURCE.RECORDS) {
        // TODO: Add validation for records
      }
      if (data.conversationSource === CONVERSATION_SOURCE.CONNECTORS) {
        // TODO: Add validation for connectors
      }
      if (data.conversationSource === CONVERSATION_SOURCE.INTERNET_SEARCH) {
        // TODO: Add validation for internet search
      }

      if (data.conversationSource === CONVERSATION_SOURCE.PERSONAL_KB_SEARCH) {
        // TODO: Add validation for personal kb search
      }

      if (data.conversationSource === CONVERSATION_SOURCE.PERSONAL_KB_SEARCH) {
        // TODO: Add validation for personal kb search
      }
    }),
});

export const conversationIdParamsSchema = z.object({
  params: z.object({
    conversationId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, {
      message: 'Conversation ID must be a valid MongoDB ObjectId',
    })
    .transform((id) => new mongoose.Types.ObjectId(id)),
  }),
});

export const messageIdParamsSchema = z.object({
  params: z.object({
    messageId: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, {
      message: 'Message ID must be a valid MongoDB ObjectId',
    })
    .transform((id) => new mongoose.Types.ObjectId(id)),
  }),
});

/**
 * Schema for validating conversation parameters.
 * This validates that:
 * - conversationId is provided and is a valid ObjectId
 * - messageId is provided and is a valid ObjectId
 */
export const conversationParamsSchema = z.object({
  params : z.object({
    conversationId:conversationIdParamsSchema,
    messageId: messageIdParamsSchema
  })
});

/**
 * Schema for updating an enterprise search document.
 * This requires a valid document ID in params and allows optional updates in the body.
 * Conditional validation for conversationSource and conversationSourceRecordId is applied.
 */
export const enterpriseSearchUpdateSchema = z.object({
  body: z
    .object({
      // For example, you might allow updating the query and title fields.
      query: z.string().min(1).max(100000).optional(),
      title: z.string().min(1).max(200).optional(),
      conversationSource: conversationSourceEnum.optional(),
      conversationSourceRecordId: z
        .string()
        .regex(objectIdRegex, {
          message: 'Invalid conversation source record ID format',
        })
        .optional(),
      recordIds: z.array(z.string().regex(objectIdRegex)).optional(),
      modules: z.array(z.string().regex(objectIdRegex)).optional(),
      departments: z.array(z.string().regex(objectIdRegex)).optional(),
      searchTags: z.array(z.string().regex(objectIdRegex)).optional(),
      appSpecificRecordType: z
        .array(z.string().regex(objectIdRegex))
        .optional(),
    })
    .superRefine((data) => {
      if (data.conversationSource === CONVERSATION_SOURCE.ENTERPRISE_SEARCH) {
        // TODO: Add validation for enterprise search
      }
      if (data.conversationSource === CONVERSATION_SOURCE.RECORDS) {
        // TODO: Add validation for records
      }
      if (data.conversationSource === CONVERSATION_SOURCE.CONNECTORS) {
        // TODO: Add validation for connectors
      }
      if (data.conversationSource === CONVERSATION_SOURCE.INTERNET_SEARCH) {
        // TODO: Add validation for internet search
      }
      if (data.conversationSource === CONVERSATION_SOURCE.PERSONAL_KB_SEARCH) {
        // TODO: Add validation for personal kb search
      }
    }),
});

/**
 * Schema for getting an enterprise search document by ID.
 */
export const enterpriseSearchGetSchema = z.object({
  params: z.object({
    conversationId: z
      .string()
      .regex(objectIdRegex, {
        message: 'ID must be a valid MongoDB ObjectId',
      }),
  }),
});

/**
 * Schema for deleting an enterprise search document.
 * (Same as get schema for ID validation.)
 */
export const enterpriseSearchDeleteSchema = enterpriseSearchGetSchema;

/**
 * Schema for searching enterprise search documents.
 * Validates query parameters:
 * - query (required)
 * - page and limit are optional numbers (with defaults)
 * - sortBy and sortOrder are optional and must be one of the allowed values if provided.
 */
export const enterpriseSearchQuerySchema = z.object({
  query: z.object({
    query: z
      .string({ required_error: 'Search query is required' })
      .min(1, { message: 'Search query is required' }),
    page: z.preprocess((arg) => Number(arg), z.number().min(1).default(1)),
    limit: z.preprocess(
      (arg) => Number(arg),
      z.number().min(1).max(100).default(10),
    ),
    sortBy: z.enum(['createdAt', 'title']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

export const enterpriseSearchSearchSchema = z.object({
  body: z.object({
    query: z.string().min(1, { message: 'Search query is required' }),
    limit: z.preprocess((arg) => Number(arg), z.number().min(1).max(100).default(10)),
  }),
});

export const enterpriseSearchSearchHistorySchema = z.object({
  body: z.object({
    limit: z.preprocess((arg) => Number(arg), z.number().min(1).max(100).default(10)),
  }),
});
