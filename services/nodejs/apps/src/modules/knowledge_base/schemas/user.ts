import { SchemaOptions, ValidationLevel } from 'arangojs/collections';

export const UserSchema: SchemaOptions = {
  rule: {
    type: 'object',
    properties: {
      orgId: { type: 'string' },
      userId: {type: 'string'},
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      fullName: { type: 'string' },
      email: { type: 'string', format: 'email' },
      designation: { type: 'string' },
      isActive: { type: 'boolean', default: false },
      isDeleted: { type: 'boolean', default: false },
      createdAtTimestamp: { type: 'number' },
      updatedAtTimestamp: { type: 'number' }
    },
    required: ['email'],
    additionalProperties: false
  },
  level: 'strict' as ValidationLevel,
  message: 'Document does not match the user schema.'
};