export interface InitialContext {
    recordId: string;
    recordName: string;
    recordType: string;
    departments?: string[];
    modules?: string[];
    categories?: string[];
  }

export interface RecordSalesAgentProps {
    initialContext: InitialContext;
    recordId: string;
    containerStyle?: React.CSSProperties;
  }

 export interface Record {
    _id?: string | null;
    name?: string;
    title?: string;
    departments?: string[];
    recordType?: string;
    conversationSource?: string | null;
    lastActivityAt?: string;
  } 

 export interface RecordHeaderProps {
    record: Record | null;
    isConversation: boolean;
    isDrawerOpen: boolean;
    onDrawerToggle: () => void;
  }


  export interface RecordSidebarProps {
    onClose: () => void;
    onRecordSelect: (record: ConversationRecord) => Promise<void>;
    selectedRecordId?: string | null;
    recordType?: string;
    onRefreshComplete?: () => void;
    shouldRefresh?: boolean;
    onNewChat?: () => void;
    recordId?: string;
    initialRecord?: Record | null;
  }

 export interface ConversationRecord {
    _id?: string | null;
    userId?: string;
    orgId?: string;
    title?: string;
    initiator?: string;
    isShared?: boolean;
    isDeleted?: boolean;
    isArchived?: boolean;
    lastActivityAt?: string;
    tags?: any[];
    conversationSource?: string;
    conversationSourceRecordId?: string | null;
    sharedWith?: string[];
    createdAt?: any;
    updatedAt?: string;
    isOwner?: boolean;
    accessLevel?: string;
    name?: string;
    departments?: any;
  }