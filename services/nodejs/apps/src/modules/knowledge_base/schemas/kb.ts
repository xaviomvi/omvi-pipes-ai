import { SchemaOptions, ValidationLevel } from "arangojs/collections";

export const kbSchema: SchemaOptions = {
    rule: {
      type: 'object',
      properties: {
        orgId: { type: 'string' }, // The owner of this knowledge base
        name: { type: 'string', default: 'Default' },
        createdAt: { type: 'number' },
        updatedAt: { type: 'number' },
        deletedAt: { type: 'number' },
        isDeleted: { type: 'boolean', default: false },
        isArchived: { type: 'boolean', default: false },
      },
      required: ['orgId'],
      additionalProperties: false,
    },
    level: 'strict' as ValidationLevel,
    message: 'Document does not match the knowledge base schema.',
  };