import type { Citation, FormattedMessage } from './chat-bot';

export interface ChatMessageProps {
  message: FormattedMessage;
  index: number;
  isExpanded: boolean;
  onToggleCitations: (index: number) => void;
  onRegenerate: (messageId: string) => Promise<void>;
  onFeedbackSubmit: (messageId: string, feedback: any) => Promise<void>;
  conversationId: string | null;
  onViewPdf: (url: string, citations: Citation[], isExcelFile?: boolean) => void;
  isRegenerating: boolean;
  showRegenerate: boolean;
}

export interface StyledCitationProps {
  children: React.ReactNode;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export interface MessageContentProps {
  content: string;
  citations: Citation[];
  onRecordClick: (record: Record) => void;
  aggregatedCitations: { [key: string]: Citation[] };
  onViewPdf: (url: string, citations: Citation[], isExcelFile?: boolean) => Promise<void>;
}

export interface Record {
  recordId: string;
  citations: Citation[];
  [key: string]: any;
}
