import { ObjectId } from 'mongoose';
import mongoose from 'mongoose';

export interface ICitation {
  slug?: string;
  orgId: ObjectId;
  content: string;
  documentIndex?: number;
  citationType: 'vectordb|document' | 'reference' | 'external';
  citationMetaData?: Record<string, unknown>;
  relatedCitations?: ObjectId[];
  isDeleted?: boolean;
  deletedBy?: ObjectId;
  usageCount?: number;
  lastUsedAt?: Date;
  verificationStatus: 'unverified' | 'verified' | 'disputed';
  verifiedBy?: ObjectId;
  verifiedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICitationData {
  citationId: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface ICitationModel extends ICitation {
  _id: ObjectId;
}

export interface ICitationDocument extends ICitation, mongoose.Document {
  // Add any instance methods here if needed
}

export interface ICitationStatics extends mongoose.Model<ICitationDocument> {
  createFromAIResponse(
    aiCitation: any,
    orgId: string,
  ): Promise<ICitationDocument>;
}
