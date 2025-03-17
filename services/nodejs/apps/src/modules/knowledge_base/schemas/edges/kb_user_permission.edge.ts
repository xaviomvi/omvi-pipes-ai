import { SchemaOptions } from 'arangojs/collections';

export const kbToUserPermissionEdgeSchema: SchemaOptions = {
    rule: {
        type: 'object',
        properties: {
          _from: { type: 'string' },
          _to: { type: 'string' },
          role: { type: 'string', enum: ['USER', 'GROUP', 'DOMAIN'] },
          type: { 
            type: 'array', 
            items: { 
              type: 'string', 
              enum : ["OWNER", "WRITER", "COMMENTER", "READER"]
            } 
          },
          createdAt: { type: 'number' },
          last_updated: { type: 'number' },
          isDeleted: { type: 'boolean', default: false }
        },
        // required: ['_from', '_to', 'relationshipType', 'createdAt'],
        // additionalProperties: false,
      },
    //   level: 'strict' as ValidationLevel,
      message: 'Document does not match the user-to-record edge schema.',
};
