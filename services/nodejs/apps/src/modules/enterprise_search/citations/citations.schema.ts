import mongoose, { Schema } from 'mongoose';
import {
  ICitationDocument,
  ICitationStatics,
} from './citations.interface';

const ObjectId = Schema.Types.ObjectId;

const citationSchema = new Schema<ICitationDocument>(
  {
    orgId: {
      type: ObjectId,
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    documentIndex: {
      type: Number,
    },
    citationType: {
      type: String,
      enum: ['vectordb|document', 'reference', 'external'],
      default: 'vectordb|document',
    },
    citationMetaData: {
      type: Schema.Types.Mixed,
    },
    relatedCitations: [
      {
        type: ObjectId,
        ref: 'citations',
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedBy: {
      type: ObjectId,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    lastUsedAt: Date,
    verificationStatus: {
      type: String,
      enum: ['unverified', 'verified', 'disputed'],
      default: 'unverified',
    },
    verifiedBy: {
      type: ObjectId,
    },
    verifiedAt: Date,
  },
  {
    timestamps: true,
  },
);

// Static method to create citation from AI response
citationSchema.statics.createFromAIResponse = async function (
  aiCitation,
  orgId,
) {
  return new this({
    orgId,
    content: aiCitation.content,
    documentIndex: aiCitation.docIndex,
    citationType: aiCitation.citationType,
    citationMetaData: aiCitation.metadata,
  });
};

// Export the model
export const CitationModel = mongoose.model<
  ICitationDocument,
  ICitationStatics
>('citations', citationSchema, 'citations');
