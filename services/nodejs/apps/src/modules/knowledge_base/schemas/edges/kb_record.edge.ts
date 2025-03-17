import { SchemaOptions } from 'arangojs/collections';

export const kbToRecordEdgeSchema: SchemaOptions = {
  rule: {
    type: 'object',
    properties: {
      _from: { type: 'string' }, // KB document handle
      _to: { type: 'string' }, // Record document handle
      createdAt: { type: 'number' },
      updatedAt: { type: 'number' },
      isDeleted: { type: 'boolean', default: false },
    },
    // required: ['_from', '_to', 'createdAt'],
    // additionalProperties: false,
  },
  // level: 'strict' as ValidationLevel,
  message: 'Document does not match the KB-to-Record edge schema.',
};
