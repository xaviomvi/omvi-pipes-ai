import mongoose, { Document, Schema } from 'mongoose';

export interface IEnterpriseSemanticSearch extends Document {
  query: string;
  limit: number;
  orgId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  citationIds: mongoose.Types.ObjectId[]; // Array of references to citation documents
  createdAt: Date;
  updatedAt: Date;
}

const enterpriseSemanticSearchSchema = new Schema<IEnterpriseSemanticSearch>(
  {
    query: { type: String, required: true, index: true },
    limit: { type: Number, required: true },
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    citationIds: [{ 
      type: Schema.Types.ObjectId, 
      ref: 'citation',
      index: true
    }]
  },
  {
    timestamps: true,
  },
);

enterpriseSemanticSearchSchema.index({ query: 'text' });

const EnterpriseSemanticSearch = mongoose.model<IEnterpriseSemanticSearch>(
  'search',
  enterpriseSemanticSearchSchema,
);

export default EnterpriseSemanticSearch;