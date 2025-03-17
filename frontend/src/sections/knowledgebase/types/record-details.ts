export interface Department {
    _id: string;
    name: string;
  }
  
  export  interface AppSpecificRecordType {
    _id: string;
    name: string;
    tag: string;
  }
  
  export interface Module {
    _id: string;
    name: string;
  }
  
  export interface SearchTag {
    _id: string;
    name: string;
  }
  
  export  interface User {
    _id: string;
    fullName: string;
  }
  
  export interface InitialContext {
    recordId: string;
    recordName: string;
    recordType: string;
    departments: string[];
    modules: string[];
    categories: string[];
  }


  // Updated types based on the API response
  interface FileRecord {
    name: string;
    extension: string;
    mimeType: string;
    sizeInBytes: number;
    isFile: boolean;
  }
  
  interface KnowledgeBase {
    id: string;
    name: string;
    orgId: string;
  }
  
  export interface Record {
    _key: string;
    _id: string;
    _rev: string;
    orgId: string;
    recordName: string;
    externalRecordId: string;
    recordType: string;
    origin: string;
    createdAtTimestamp: number;
    updatedAtTimestamp: number;
    isDeleted: boolean;
    isArchived: boolean;
    fileRecord?: FileRecord;
    departments?: Array<{ _id: string; name: string }>;
    appSpecificRecordType?: Array<{ _id: string; name: string }>;
    modules?: Array<{ _id: string; name: string }>;
    searchTags?: Array<{ _id: string; name: string }>;
    createdBy?: string;
  }
  
  export interface RecordDetailsResponse {
    record: Record;
    knowledgeBase: KnowledgeBase;
    permissions: string[];
    relatedRecords: any[];
  }