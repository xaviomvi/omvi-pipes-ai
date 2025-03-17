export const CONVERSATION_SOURCE = {
  ENTERPRISE_SEARCH: 'enterprise_search' as const,
  RECORDS: 'records' as const,
  CONNECTORS: 'connectors' as const,
  INTERNET_SEARCH: 'internet_search' as const,
  PERSONAL_KB_SEARCH: 'personal_kb_search' as const,
} as const;

export const CONFIDENCE_LEVELS = {
  HIGH: 'High' as const,
  MEDIUM: 'Medium' as const,
  LOW: 'Low' as const,
  VERY_HIGH: 'Very High' as const,
  UNKNOWN: 'Unknown' as const,
} as const;

// Create a type from the object values
export type ConversationSource =
  (typeof CONVERSATION_SOURCE)[keyof typeof CONVERSATION_SOURCE];
export type ConfidenceLevel =
  (typeof CONFIDENCE_LEVELS)[keyof typeof CONFIDENCE_LEVELS];
