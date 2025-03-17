export interface BoundingBox {
    x: number;
    y: number;
  }
  
  export  interface Span {
    offset: number;
    bounding_box: null;
    length: number;
    page_number: number;
  }
  
  export  interface Para {
    content: string;
    spans: Span[];
    bounding_box: BoundingBox[];
    page_number: number;
    role: null;
  }
  
  export interface Category {
    category: string;
    subcategories: string[];
  }
  
  export interface Department {
    _id: string;
    name: string;
  }
  
  export interface AppSpecificRecordType {
    _id: string;
    name: string;
    tag: string;
  }
  
  export  interface Record {
    _id: string;
    orgId: string;
    name: string;
    version: string;
    isLatestVersion: boolean;
    recordType: string;
    status: string;
    departments: Department[];
    appSpecificRecordType: AppSpecificRecordType[];
    modules: any[];
    searchTags: any[];
    isDeleted: boolean;
    isArchived: boolean;
    createdBy: string;
    relatedRecords: any[];
    createdAt: string;
    updatedAt: string;
    slug: string;
    __v: number;
    score?: number;
  }
  
  export interface FileRecord {
    _id: string;
    orgId: string;
    uploadedBy: string;
    storageDocumentId: string;
    version: number;
    fileName: string;
    extension: string;
    recordId: string;
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
    __v: number;
  }
  
  export interface SearchResult {
    id: string;
    content: string;
    dataframe: null;
    blob: null;
    score: number;
    embedding: null;
    sparse_embedding: null;
    recordName: string;
    orgId: string;
    categories: Category[];
    recordOriginFormat: string;
    contentType: string;
    version: number;
    languages: string[];
    paragraph_num: number;
    page_number: number;
    recordType: string;
    source: string;
    sentence_num: number;
    bounding_box: BoundingBox[];
    departments: string[];
    fileRecordId: string;
    recordId: string;
    para: Para;
    records: Record[];
    fileRecords: FileRecord[];
  } 
  
  export interface SearchResponse {
    [key: string]: SearchResult | Record[] | FileRecord[] | {
      requestId: string;
      timestamp: string;
      duration: number;
      searchContext: {
        totalRecordsSearched: number;
        matchedRecords: number;
        matchedFiles: number;
      };
      filters: {
        departments: number;
        modules: number;
        searchTags: number;
        appSpecificRecordType: number;
      };
    } | any; // to allow for numeric indices
    records: Record[];
    fileRecords: FileRecord[];
    meta: {
      requestId: string;
      timestamp: string;
      duration: number;
      searchContext: {
        totalRecordsSearched: number;
        matchedRecords: number;
        matchedFiles: number;
      };
      filters: {
        departments: number;
        modules: number;
        searchTags: number;
        appSpecificRecordType: number;
      };
    };
  }
  
  export interface SearchFilters {
    department?: string[];
    moduleId?: string[];
    appSpecificRecordType?: string[];
  }

  export interface KnowledgeSearchProps {
    searchResults: SearchResult[] & {
      records?: Record[];
      fileRecords?: FileRecord[];
    };
    loading: boolean;
    onSearchQueryChange: (query: string) => void;
    onTopKChange: (callback: (prevTopK: number) => number) => void;
  }