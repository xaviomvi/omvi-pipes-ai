// src/schemas/edges/user_record.edge.ts
import { SchemaOptions, ValidationLevel } from 'arangojs/collections';

export const userToRecordEdgeSchema: SchemaOptions = {
  rule: {
    type: 'object',
    properties: {
      _from: { type: 'string' },
      _to: { type: 'string' },
      relationshipType: { type: 'string', enum: ['CREATED', 'OWNER', 'VIEWER', 'EDITOR'] },
      permissions: { 
        type: 'array', 
        items: { 
          type: 'string', 
          enum: ['READ', 'WRITE', 'DELETE', 'SHARE'] 
        } 
      },
      createdAt: { type: 'number' },
      updatedAt: { type: 'number' },
      isDeleted: { type: 'boolean', default: false }
    },
    // required: ['_from', '_to', 'relationshipType', 'createdAt'],
    // additionalProperties: false,
  },
  level: 'strict' as ValidationLevel,
  message: 'Document does not match the user-to-record edge schema.',
};