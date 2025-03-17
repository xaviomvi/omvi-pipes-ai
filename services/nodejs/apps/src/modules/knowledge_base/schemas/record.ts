import { SchemaOptions, ValidationLevel } from 'arangojs/collections';

// Now export your record schema using the custom SchemaOptions type
export const recordSchema: SchemaOptions = {
  rule: {
    type: 'object',
    properties: {
      orgId: { type: 'string' },
      recordName: { type: 'string', minLength: 1 },
      externalRecordId: { type: 'string', minLength: 1 },
      recordType: {
        type: 'string',
        enum: ['FILE', 'WEBPAGE', 'MESSAGE', 'EMAIL', 'OTHERS'],
      },
      version: { type: 'number', default: 0 },
      origin: { type: 'string', enum: ['UPLOAD', 'CONNECTOR'] },
      connectorName: {
        type: 'string',
        enum: ['ONEDRIVE', 'GOOGLE_DRIVE', 'CONFLUENCE', 'SLACK'],
      },
      // timestamps
      createdAtTimestamp: { type: 'number' },
      updatedAtTimestamp: { type: 'number' },
      lastSyncTimestamp: { type: 'number' },
      deletedAtSourceTimestamp: { type: 'number' },
      sourceCreatedAtTimestamp: { type: 'number' },
      sourceLastModifiedTimestamp: { type: 'number' },
      lastIndexTimestamp: { type: 'number' },
      lastExtractionTimestamp: { type: 'number' },

      isDeletedAtSource: { type: 'boolean', default: false },
      isDeleted: { type: 'boolean', default: false },
      isArchived: { type: 'boolean', default: false },
      deletedByUserId: { type: 'string' },

      indexingStatus: {
        type: 'string',
        enum: ['NOT_STARTED', 'IN_PROGRESS', 'FAILED', 'COMPLETED'],
        default: 'NOT_STARTED',
      },
      extractionStatus: {
        type: 'string',
        enum: ['NOT_STARTED', 'IN_PROGRESS', 'FAILED', 'COMPLETED'],
        default: 'NOT_STARTED',
      },
      isLatestVersion: { type: 'boolean', default: true },
      isDirty: { type: 'boolean', default: false },
      reason: { type: 'string' },
    },
    required: [
      'orgId',
      'recordName',
      'externalRecordId',
      'recordType',
      'origin',
      'createdAtTimestamp',
    ],
    additionalProperties: false,
  },
  level: 'strict' as ValidationLevel,
  message: 'Document does not match the record schema.',
};
