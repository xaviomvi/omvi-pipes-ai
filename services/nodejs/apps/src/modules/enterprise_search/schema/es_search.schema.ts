import mongoose, { Document, Schema } from 'mongoose';

interface IBoundingBox {
  x: number;
  y: number;
}

interface IEnterpriseSemanticSearch extends Document {
  content: string;
  score: number;
  bounding_box: IBoundingBox[];
  mimeType: string;
  topics?: string[];
  pageNum?: number;
  recordVersion: number;
  blockNum?: number | number[] | string;
  languages?: string[];
  connector: string;
  categories: string;
  subcategoryLevel1?: string;
  subcategoryLevel2?: string;
  subcategoryLevel3?: string;
  orgId: string;
  blockType: number | string;
  origin: string;
  recordName: string;
  extension: string;
  recordType: string;
  departments?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const boundingBoxSchema = new Schema<IBoundingBox>({
  x: { type: Number, required: true },
  y: { type: Number, required: true }
});

const enterpriseSemanticSearchSchema = new Schema<IEnterpriseSemanticSearch>(
  {
    content: { type: String, required: true, index: true },
    score: { type: Number, required: true },
    bounding_box: {
      type: [boundingBoxSchema],
    },
    mimeType: { type: String, required: true },
    topics: [{ type: String }],
    pageNum: { type: Number },
    recordVersion: { type: Number, default: 0 },
    blockNum: { type: Schema.Types.Mixed },
    languages: [{ type: String }],
    connector: { type: String },
    categories: { type: String },
    subcategoryLevel1: { type: String },
    subcategoryLevel2: { type: String },
    subcategoryLevel3: { type: String },
    orgId: { type: String, required: true, index: true },
    blockType: { type: Schema.Types.Mixed },
    origin: { type: String },
    recordName: { type: String, required: true },
    extension: { type: String, required: true },
    recordType: { type: String, required: true },
    departments: [{ type: String }]
  },
  { 
    timestamps: true,
  }
);

enterpriseSemanticSearchSchema.index({ content: 'text' });

const EnterpriseSemanticSearch = mongoose.model<IEnterpriseSemanticSearch>(
  'EnterpriseSemanticSearch',
  enterpriseSemanticSearchSchema
);

export default EnterpriseSemanticSearch;