import type { Citation } from 'src/types/chat-bot';
import type {
  Record,
  ChatMessageProps,
  MessageContentProps,
  StyledCitationProps,
} from 'src/types/chat-message';

import { Icon } from '@iconify/react';
import React, { useRef, useMemo, useState } from 'react';

import {
  Box,
  Chip,
  Fade,
  Paper,
  Stack,
  Dialog,
  Button,
  Tooltip,
  Divider,
  Collapse,
  Typography,
  IconButton,
  DialogTitle,
  DialogContent,
  CircularProgress,
} from '@mui/material';

import RecordDetails from './record-details';
import MessageFeedback from './message-feedback';
import CitationHoverCard from './citations-hover-card';
import scrollableContainerStyle from '../../utils/styles/scrollbar';

const formatTime = (createdAt: Date) => {
  const date = new Date(createdAt);
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
};

const formatDate = (createdAt: Date) => {
  const date = new Date(createdAt);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
};

const StyledCitation: React.FC<StyledCitationProps> = ({
  children,
  onMouseEnter,
  onMouseLeave,
}) => (
  <Box
    component="span"
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      ml: 0.5,
      cursor: 'pointer',
      position: 'relative',
      '&:hover .citation-number': {
        bgcolor: 'primary.main',
        color: 'white',
      },
    }}
  >
    <Box
      component="span"
      className="citation-number"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        bgcolor: 'grey.100',
        color: 'text.secondary',
        fontSize: '0.65rem',
        fontWeight: 600,
        transition: 'all 0.2s ease-in-out',
        textDecoration: 'none',
      }}
    >
      {children}
    </Box>
  </Box>
);

const MessageContent: React.FC<MessageContentProps> = ({
  content,
  citations,
  onRecordClick,
  aggregatedCitations,
  onViewPdf,
}) => {
  const [hoveredCitation, setHoveredCitation] = useState<Citation | null>(null);
  const [hoveredRecordCitations, setHoveredRecordCitations] = useState<Citation[]>([]);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const citationMapping = useMemo(() => {
    const mapping: { [key: number]: number } = {};
    content.match(/\[(\d+)\]/g)?.forEach((match, index) => {
      const num = parseInt(match.replace(/[[\]]/g, ''), 10);
      mapping[num] = index;
    });
    return mapping;
  }, [content]);

  // Split content by newlines first
  const lines = content.split('\n');

  const handleMouseEnter = (citationRef: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    const citationNumber = parseInt(citationRef.replace(/[[\]]/g, ''), 10);
    const arrayIndex = citationMapping[citationNumber];
    const citation = citations[arrayIndex];
    if (citation?.citationMetaData?.recordId) {
      const recordCitations = aggregatedCitations[citation.citationMetaData.recordId] || [];
      setHoveredRecordCitations(recordCitations);
    }
    setHoveredCitation(citation);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredCitation(null);
      setHoveredRecordCitations([]);
    }, 100);
  };

  const handleCloseHoverCard = () => {
    setHoveredCitation(null);
    setHoveredRecordCitations([]);
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <Typography
        component="div"
        sx={{
          fontSize: '0.9rem',
          lineHeight: 1.6,
          letterSpacing: '0.005em',
          wordBreak: 'break-word',
        }}
      >
        {lines.map((line, lineIndex) => {
          const parts = line.split(/(\[\d+\])/);
          return (
            <Box key={lineIndex} sx={{ mb: lineIndex < lines.length - 1 ? 1.5 : 0 }}>
              {parts.map((part, partIndex) => {
                const citationMatch = part.match(/\[(\d+)\]/);
                if (citationMatch) {
                  const citationNumber = parseInt(citationMatch[1], 10);
                  const arrayIndex = citationMapping[citationNumber];
                  const citation = citations[arrayIndex];
                  return (
                    <StyledCitation
                      key={`${lineIndex}-${partIndex}`}
                      onMouseEnter={() => handleMouseEnter(part)}
                      onMouseLeave={handleMouseLeave}
                    >
                      {citationNumber}
                      {hoveredCitation === citation && (
                        <Box sx={{ position: 'absolute', left: 0, zIndex: 1400 }}>
                          <CitationHoverCard
                            citation={citation}
                            isVisible={Boolean(true)}
                            onRecordClick={onRecordClick}
                            onClose={handleCloseHoverCard}
                            aggregatedCitations={hoveredRecordCitations}
                            onViewPdf={onViewPdf}
                          />
                        </Box>
                      )}
                    </StyledCitation>
                  );
                }
                return <span key={`${lineIndex}-${partIndex}`}>{part}</span>;
              })}
            </Box>
          );
        })}
      </Typography>
    </Box>
  );
};

const ChatMessage = ({
  message,
  isExpanded,
  onToggleCitations,
  index,
  onRegenerate,
  onFeedbackSubmit,
  conversationId,
  isRegenerating,
  showRegenerate,
  onViewPdf,
}: ChatMessageProps) => {
  const [selectedRecord, setSelectedRecord] = useState<Record | null>(null);
  const [isRecordDialogOpen, setRecordDialogOpen] = useState<boolean>(false);

  const aggregatedCitations = useMemo(() => {
    if (!message.citations) return {};

    return message.citations.reduce<{ [key: string]: Citation[] }>((acc, citation) => {
      const recordId = citation.citationMetaData?.recordId;
      if (!recordId) return acc;

      if (!acc[recordId]) {
        acc[recordId] = [];
      }
      acc[recordId].push(citation);
      return acc;
    }, {});
  }, [message.citations]);

  const handleOpenRecordDetails = (record: Record) => {
    const recordCitations = aggregatedCitations[record.recordId] || [];

    setSelectedRecord({ ...record, citations: recordCitations });
    setRecordDialogOpen(true);
  };

  const handleCloseRecordDetails = () => {
    setRecordDialogOpen(false);
    setSelectedRecord(null);
  };

  const handleViewPdf = async (
    url: string,
    citations: Citation[],
    isExcelFile?: boolean
  ): Promise<void> =>
    new Promise<void>((resolve) => {
      onViewPdf(url, citations, isExcelFile);
      resolve();
    });

  return (
    <Box sx={{ mb: 3, width: '100%', position: 'relative' }}>
      {/* Message Metadata */}
      <Box
        sx={{
          mb: 1,
          display: 'flex',
          justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
          px: 1.5,
          opacity: isRegenerating ? 0.5 : 1,
          transition: 'opacity 0.2s ease-in-out',
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            px: 1,
            py: 0.25,
            borderRadius: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.02)',
          }}
        >
          <Icon
            icon={message.type === 'user' ? 'mdi:account-circle' : 'mdi:robot-outline'}
            width={14}
            height={14}
            color={message.type === 'user' ? '#1976d2' : '#2e7d32'}
          />
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontSize: '0.6rem',
              fontWeight: 500,
            }}
          >
            {formatDate(message.createdAt)} • {formatTime(message.createdAt)}
          </Typography>
          {message.type === 'bot' && message.confidence && (
            <Chip
              label={message.confidence}
              size="small"
              sx={{
                height: '16px',
                fontSize: '0.5rem',
                fontWeight: 600,
                backgroundColor:
                  message.confidence === 'Very High'
                    ? 'rgba(46, 125, 50, 0.08)'
                    : 'rgba(237, 108, 2, 0.08)',
                color: message.confidence === 'Very High' ? '#2e7d32' : '#ed6c02',
              }}
            />
          )}
        </Stack>
      </Box>

      {/* Message Content */}
      <Box sx={{ position: 'relative' }}>
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: '85%',
            p: 2,
            ml: message.type === 'user' ? 'auto' : 0,
            bgcolor: message.type === 'user' ? 'rgba(25, 118, 210, 0.02)' : 'background.paper',
            color: 'text.primary',
            borderRadius: '12px',
            border: '1px solid',
            borderColor:
              message.type === 'user' ? 'rgba(25, 118, 210, 0.08)' : 'rgba(0, 0, 0, 0.05)',
            position: 'relative',
            transition: 'all 0.2s ease-in-out',
            opacity: isRegenerating ? 0.5 : 1,
            filter: isRegenerating ? 'blur(0.5px)' : 'none',
            '&:hover': {
              borderColor:
                message.type === 'user' ? 'rgba(25, 118, 210, 0.15)' : 'rgba(0, 0, 0, 0.1)',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
            },
          }}
        >
          {/* Message Content with Citation Hover */}
          {message.type === 'bot' ? (
            <MessageContent
              content={message.content}
              citations={message.citations || []}
              onRecordClick={handleOpenRecordDetails}
              aggregatedCitations={aggregatedCitations}
              onViewPdf={handleViewPdf}
            />
          ) : (
            <Typography
              sx={{
                fontSize: '0.9rem',
                lineHeight: 1.6,
                letterSpacing: '0.005em',
                wordBreak: 'break-word',
                fontWeight: 500,
              }}
            >
              {message.content}
            </Typography>
          )}
          {/* Citations Section */}
          {message.citations?.length && (
            <Box sx={{ mt: 2 }}>
              <Tooltip title={isExpanded ? 'Hide Citations' : 'Show Citations'}>
                <Button
                  variant="text"
                  size="small"
                  onClick={() => onToggleCitations(index)}
                  startIcon={
                    <Icon
                      icon={isExpanded ? 'mdi:chevron-down' : 'mdi:chevron-right'}
                      width={16}
                      height={16}
                    />
                  }
                  sx={{
                    color: 'primary.main',
                    textTransform: 'none',
                    fontWeight: 500,
                    fontSize: '0.7rem',
                    '&:hover': {
                      backgroundColor: 'rgba(25, 118, 210, 0.05)',
                    },
                  }}
                >
                  {message.citations.length} {message.citations.length === 1 ? 'Source' : 'Sources'}
                </Button>
              </Tooltip>

              <Collapse in={isExpanded}>
                <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                  {message.citations.map((citation, cidx) => (
                    <Paper
                      key={cidx}
                      elevation={0}
                      sx={{
                        p: 1.5,
                        bgcolor: 'rgba(0, 0, 0, 0.01)',
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: 'divider',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          backgroundColor: 'rgba(0, 0, 0, 0.02)',
                          borderColor: 'rgba(0, 0, 0, 0.1)',
                        },
                      }}
                    >
                      <Stack spacing={1}>
                        <Typography
                          sx={{
                            fontSize: '0.75rem',
                            lineHeight: 1.5,
                            color: 'text.primary',
                            fontWeight: 400,
                          }}
                        >
                          {citation.content}
                        </Typography>

                        {citation.metadata?.para?.content && (
                          <Typography
                            sx={{
                              fontSize: '0.8rem',
                              lineHeight: 1.4,
                              color: 'text.secondary',
                            }}
                          >
                            {citation.metadata.para.content}
                          </Typography>
                        )}

                        {citation.metadata?.recordId && (
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Button
                              size="small"
                              startIcon={
                                <Icon icon="mdi:file-document-outline" width={14} height={14} />
                              }
                              onClick={() => {
                                if (citation.metadata?.recordId) {
                                  const record: Record = {
                                    recordId: citation.metadata.recordId,
                                    citations: [], // This will be populated by handleOpenRecordDetails
                                    ...citation.metadata,
                                  };
                                  handleOpenRecordDetails(record);
                                }
                              }}
                              sx={{
                                textTransform: 'none',
                                fontSize: '0.65rem',
                                fontWeight: 500,
                              }}
                            >
                              View Details
                            </Button>
                          </Box>
                        )}
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Collapse>
            </Box>
          )}
          {/* Message Controls */}
          {/* // In your ChatMessage component's controls section */}
          {message.type === 'bot' && (
            <>
              <Divider sx={{ my: 1 }} />
              <Stack direction="row" spacing={1} alignItems="center">
                {showRegenerate && (
                  <Tooltip title="Regenerate response">
                    <IconButton
                      onClick={() => onRegenerate(message.id)}
                      size="small"
                      disabled={isRegenerating}
                      sx={{
                        color: 'text.secondary',
                        '&:hover': {
                          color: 'primary.main',
                          backgroundColor: 'rgba(25, 118, 210, 0.05)',
                        },
                      }}
                    >
                      <Icon
                        icon={isRegenerating ? 'mdi:loading' : 'mdi:refresh'}
                        width={16}
                        height={16}
                        className={isRegenerating ? 'spin' : ''}
                      />
                    </IconButton>
                  </Tooltip>
                )}
                <MessageFeedback
                  messageId={message.id}
                  conversationId={conversationId}
                  onFeedbackSubmit={onFeedbackSubmit}
                />
              </Stack>
            </>
          )}
        </Paper>
      </Box>

      {/* Record Details Dialog */}
      <Dialog
        open={isRecordDialogOpen}
        onClose={handleCloseRecordDetails}
        maxWidth="md"
        fullWidth
        PaperProps={{
          elevation: 1,
          sx: {
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
          },
        }}
      >
        <DialogTitle
          sx={{
            fontSize: '1rem',
            fontWeight: 500,
            py: 2,
            px: 2.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          Record Details
        </DialogTitle>
        <DialogContent sx={{ p: 2.5, ...scrollableContainerStyle }}>
          {selectedRecord && (
            <RecordDetails
              recordId={selectedRecord.recordId}
              citations={selectedRecord.citations}
            />
          )}
        </DialogContent>
      </Dialog>
      {isRegenerating && (
        <Fade in>
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: message.type === 'user' ? 'auto' : '50%',
              right: message.type === 'user' ? '50%' : 'auto',
              transform: 'translate(-50%, -50%)',
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <CircularProgress size={24} />
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontWeight: 500,
                bgcolor: 'background.paper',
                px: 2,
                py: 0.5,
                borderRadius: 1,
                boxShadow: '0 2px 12px rgba(0, 0, 0, 0.03)',
              }}
            >
              Regenerating...
            </Typography>
          </Box>
        </Fade>
      )}
    </Box>
  );
};

export default ChatMessage;
