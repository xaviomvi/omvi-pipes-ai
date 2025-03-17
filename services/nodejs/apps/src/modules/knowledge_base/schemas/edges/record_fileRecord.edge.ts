// src/schemas/edges/record_fileRecord.edge.ts
import { SchemaOptions } from 'arangojs/collections';

export const recordToFileRecordEdgeSchema: SchemaOptions = {
  rule: {
    type: 'object',
    properties: {
      _from: { type: 'string' },
      _to: { type: 'string' },
      createdAt: { type: 'number' },
      updatedAt: { type: 'number' },
      isDeleted: { type: 'boolean', default: false }
    },
    // required: ['_from', '_to', 'createdAt'],
    // additionalProperties: false,
  },
//   level: 'strict' as ValidationLevel,
  message: 'Document does not match the record-to-fileRecord edge schema.',
};