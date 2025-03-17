// token-reference.schema.ts
import { Document, Schema, model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export enum ServiceType {
  ONEDRIVE = 'ONEDRIVE',
  GOOGLE_DRIVE = 'GOOGLE_DRIVE',
  CONFLUENCE = 'CONFLUENCE',
}

export enum TokenEventType {
  TOKEN_CREATED = 'TOKEN_CREATED',
  TOKEN_REFRESHED = 'TOKEN_REFRESHED',
  TOKEN_REVOKED = 'TOKEN_REVOKED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
}

export interface ITokenReferenceBase {
  tokenId: string;
  accountId: string;
  serviceType: ServiceType;
  tokenStoreId: string;
  expiresAt: Date;
  metadata: Record<string, any>;
}

// Interface for creating a new token reference
export interface ICreateTokenReference {
  accountId: string;
  serviceType: ServiceType;
  tokenStoreId: string;
  expiresAt: Date;
  metadata: Record<string, any>;
}

// Mongoose document interface
export interface ITokenReference extends ITokenReferenceBase, Document {
  orgId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITokenEvent {
  eventId: string;
  eventType: TokenEventType;
  tokenReferenceId: string;
  serviceType: ServiceType;
  accountId: string;
  timestamp: Number;
}

const TokenReferenceSchema = new Schema<ITokenReference>(
  {
    tokenId: {
      type: String,
      required: true,
      unique: true,
      default: uuidv4,
    },
    orgId: { type: Schema.Types.ObjectId, required: true },
    accountId: {
      type: String,
      required: true,
      index: true,
    },
    serviceType: {
      type: String,
      enum: Object.values(ServiceType),
      required: true,
    },
    tokenStoreId: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const TokenReferenceModel = model<ITokenReference>(
  'TokenReference',
  TokenReferenceSchema,
);
