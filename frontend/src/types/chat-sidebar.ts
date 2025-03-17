import type { AlertColor } from "@mui/material";

import type { Conversation } from "./chat-bot";

export interface PaginationInfo {
page: number;
limit: number;
totalCount: number;
totalPages: number;
hasNextPage: boolean;
hasPrevPage: boolean;
}

export interface DateRange {
start: string | null;
end: string | null;
}

export interface PaginationFilter {
type: 'number';
current: string;
min: number;
max: number;
default: number;
description: string;
applied: boolean;
}

export interface SortingOption {
values: string[];
default: string;
description: string;
current: string;
applied: boolean;
}

export interface DateFilter {
type: 'date';
description: string;
format: string;
current: DateRange;
applied: boolean;
}

export interface GenericFilter {
type: string;
description: string;
current: string | null;
applied: boolean;
}

export interface SharedFilter {
values: string[];
description: string;
current: string;
applied: boolean;
}

export interface Filters {
applied: {
    filters: string[];
    values: {
    [key: string]: string;
    };
};
available: {
    shared: SharedFilter;
    tags: GenericFilter;
    minMessages: GenericFilter;
    search: GenericFilter;
    pagination: {
    page: PaginationFilter;
    limit: PaginationFilter;
    };
    sorting: {
    sortBy: SortingOption;
    sortOrder: SortingOption;
    };
    dateFilters: {
    dateRange: DateFilter;
    };
};
}

export interface MetaInfo {
requestId: string;
conversationSource: string;
timestamp: string;
duration: number;
}

// Main API Response Interface
export interface ConversationsResponse {
conversations: Conversation[];
sharedWithMeConversations: Conversation[];
pagination: PaginationInfo;
filters: Filters;
meta: MetaInfo;
}

// Request Parameters Interface
export interface ConversationRequestParams {
page: number;
conversationSource: string;
limit: number;
shared: boolean;
}

export type ChatSidebarProps = {
onClose : ()=> void;
onChatSelect : (chat: Conversation) => Promise<void>;
onNewChat :() => void;
selectedId : string | null;
shouldRefresh : boolean;
onRefreshComplete : () => void;

}

export interface SnackbarState {
open: boolean;
message: string;
severity: AlertColor;
}

export interface DeleteDialogState {
open: boolean;
chat: Conversation | null;
}

export interface ConversationGroup {
Today: Conversation[];
Yesterday: Conversation[];
'Previous 7 days': Conversation[];
'Previous 30 days': Conversation[];
Older: Conversation[];
[key: string]: Conversation[];
}
