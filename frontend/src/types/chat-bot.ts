export interface ApiCitation {
    citationId: string;
    citationData?: {
      _id: string;
      content: string;
      documentIndex: number ;
      citationMetaData: {
        rowNum?: any; 
        recordId?:string;
        [key: string]: any; 
      };
      orgId: string;
      citationType: string;
      relatedCitations: any[];
      isDeleted: boolean;
      usageCount: number;
      verificationStatus: string;
      createdAt: string;
      updatedAt: string;
      slug: string;
    };
    orgId: string;
    citationType: string;
    [key: string]: any;
  }
  
  // The Citation interface as specified
  export interface Citation {
    id: string;
    _id: string;
    citationId: string;
    content: string;
    documentIndex: number ;
    metadata: {
      recordId?:string;
      para?:{
        bounding_box ?: any[];
        [key: string]: any; 
      };
      bounding_box ?: any[];
      page_number ?: number;
      [key: string]: any; 
    };
    orgId: string;
    citationType: string;
    citationMetaData: {
      rowNum?: any; 
      recordId?:string;
      [key: string]: any; 
    };
    relatedCitations: any[];
    isDeleted: boolean;
    usageCount: number;
    verificationStatus: string;
    createdAt: string;
    updatedAt: string;
    slug: string;
    [key: string]: any;
  }
  
  export interface Message {
    _id: string;
    messageType: string;
    content: string;
    contentFormat: string;
    citations: Citation[];
    followUpQuestions: string[];
    feedback: any[];
    createdAt: string;
    updatedAt: string;
    confidence?: string;
  }
  
  export interface ConversationFilters {
    applied: {
      filters: any[];
      values: Record<string, any>;
    };
    available: {
      messageType: {
        values: string[];
        description: string;
        current: null;
      };
      dateRange: {
        type: string;
        description: string;
        format: string;
        current: {
          startDate: null;
          endDate: null;
        };
      };
      sorting: {
        sortBy: {
          values: string[];
          default: string;
          description: string;
          current: string;
        };
        sortOrder: {
          values: string[];
          default: string;
          description: string;
          current: string;
        };
      };
      pagination: {
        description: string;
        currentPage: number;
        itemsPerPage: number;
        orderDirection: string;
      };
    };
  }
  
  export interface ConversationPagination {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    messageRange: {
      start: number;
      end: number;
    };
  }
  
  export interface ConversationAccess {
    isOwner: boolean;
    accessLevel: string;
  }
  
  export interface Conversation {
    _id: string;
    id: string;
    title: string;
    initiator: string;
    createdAt: string;
    isShared: boolean;
    sharedWith: string[];
    messages: Message[];
    pagination: ConversationPagination;
    access: ConversationAccess;
    filters: ConversationFilters;
    lastActivityAt : string;
  }
  
  export interface ApiResponse {
    conversation: Conversation;
    meta: {
      requestId: string;
      timestamp: string;
      duration: number;
      conversationId: string;
      messageCount: number;
    };
  }
  
  export interface FormattedMessage {
    id: string;
    timestamp: Date;
    content: string;
    type: string;
    contentFormat: string;
    followUpQuestions: string[];
    createdAt: Date;
    updatedAt: Date;
    feedback?: any[];
    confidence?: string;
    citations?: Citation[];
    messageType?: string;
    error?: boolean;
    [key: string]: any;
  }
  
  export interface ChatHeaderProps {
    isDrawerOpen: boolean;
    onDrawerOpen: () => void;
    conversationId: string | null;
  }
  
  export interface ChatProps {
    onClose: () => void;
    onChatSelect: (chat: Conversation) => void;
    onNewChat: () => void;
    selectedId: string | null;
    shouldRefresh: boolean;
    onRefreshComplete: () => void;
  }
  
  export interface ExpandedCitationsState {
    [key: number]: boolean;
  }