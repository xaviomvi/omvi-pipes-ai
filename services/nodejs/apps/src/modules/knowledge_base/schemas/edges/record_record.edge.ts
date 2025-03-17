import { SchemaOptions, ValidationLevel } from 'arangojs/collections';

export const recordToRecordEdgeSchema: SchemaOptions = {
  rule: {
    type: 'object',
    properties: {
      _from: { type: 'string' }, // Source record document handle
      _to: { type: 'string' }, // Target record document handle
      relationshipType: {
        type: 'string',
        enum: ['CHILD', 'PARENT', 'SIBLING', 'OTHERS'],
      },
      relationshipTag: { type: 'string' },
      createdAt: { type: 'number' },
      updatedAt: { type: 'number' },
      isDeleted: { type: 'boolean', default: false },
      createdBy: { type: 'string' }, // User ID
    },
    required: ['_from', '_to', 'relationshipType', 'createdAt'],
    additionalProperties: false,
  },
  level: 'strict' as ValidationLevel,
  message: 'Document does not match the Record-to-Record edge schema.',
};
