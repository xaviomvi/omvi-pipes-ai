import { Schema, Document, model, Types } from 'mongoose';
import { TokenType } from '../types/oauth.types';
import { v4 as uuidv4 } from 'uuid';

export interface IToken {
  uid: string;
  orgId: Types.ObjectId;
  provider: string;
  tenantId: string;
  accountId: string;
  accessToken: string;
  accessTokenIv: string;
  accessTokenTag: string;
  refreshToken?: string;
  refreshTokenIv?: string;
  refreshTokenTag?: string;
  expiresAt: Date;
  scope: string[];
  tokenType: TokenType;
  createdAt: Date;
  updatedAt: Date;
}

export interface TokenDocument extends IToken, Document {}

const TokenSchema = new Schema<TokenDocument>(
  {
    uid: { type: String, required: true, unique: true, default: uuidv4 },
    orgId: { type: Schema.Types.ObjectId, required: true },
    provider: { type: String, required: true },
    tenantId: { type: String, required: true },
    accountId: { type: String, required: true },
    accessToken: { type: String, required: true },
    accessTokenIv: { type: String, required: true },
    accessTokenTag: { type: String, required: true },
    refreshToken: String,
    refreshTokenIv: String,
    refreshTokenTag: String,
    expiresAt: { type: Date, required: true },
    scope: [{ type: String }],
    tokenType: {
      type: String,
      required: true,
      enum: ['enterprise_global', 'enterprise_user', 'individual_user'],
    },
  },
  { timestamps: true },
);

export const TokenModel = model<TokenDocument>('Token', TokenSchema);
