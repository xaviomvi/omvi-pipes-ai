import { SchemaOptions, ValidationLevel } from "arangojs/collections";

export const fileRecordSchema: SchemaOptions = {
  rule: {
    type: 'object',
    properties: {
      userId: { type: 'string' },
      orgId: { type: 'string' },
      name: { type: 'string', minLength: 1 },
      isFile: { type: 'boolean' },
      extension: { type: ['string', 'null'] },
      mimeType: { type: ['string', 'null'] },
      sizeInBytes: { type: 'number' },
      webUrl: { type: 'string' },
      etag: { type: ['string', 'null'] },
      ctag: { type: ['string', 'null'] },
      md5Checksum: { type: ['string', 'null'] },
      quickXorHash: { type: ['string', 'null'] },
      crc32Hash: { type: ['string', 'null'] },
      sha1Hash: { type: ['string', 'null'] },
      sha256Hash: { type: ['string', 'null'] },
      path: { type: 'string' },
    },
    required: ['name','orgId'],
    additionalProperties: false,
  },
  level: 'strict' as ValidationLevel,
  message: 'Document does not match the file record schema.',
};
