// Updated CitationHoverCard component to work with Popper

import type { Record } from 'src/types/chat-message';
import type { Metadata, CustomCitation } from 'src/types/chat-bot';

import React from 'react';
import { Icon } from '@iconify/react';
import eyeIcon from '@iconify-icons/mdi/eye-outline';
import fileDocumentIcon from '@iconify-icons/mdi/file-document-outline';

import { Box, Fade, Card, Chip, Stack, Button, Divider, Typography } from '@mui/material';

interface CitationHoverCardProps {
  citation: CustomCitation;
  isVisible: boolean;
  onRecordClick: (record: Record) => void;
  onClose: () => void;
  onViewPdf: (
    url: string,
    citationMeta: Metadata,
    citations: CustomCitation[],
    isExcelFile?: boolean,
    buffer?: ArrayBuffer
  ) => Promise<void>;
  aggregatedCitations: CustomCitation[];
}

const CitationHoverCard = ({
  citation,
  isVisible,
  onRecordClick,
  onClose,
  onViewPdf,
  aggregatedCitations,
}: CitationHoverCardProps) => {
  const hasRecordId = Boolean(citation?.metadata?.recordId);

  const handleClick = (e: React.MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    if (hasRecordId && citation.metadata?.recordId) {
      // Create a proper Record object with the required citations property
      const record: Record = {
        ...citation.metadata,
        recordId: citation.metadata.recordId,
        citations: aggregatedCitations.filter(
          (c) => c.metadata?.recordId === citation.metadata?.recordId
        ),
      };
      onRecordClick(record);
    }
  };

  const handleOpenPdf = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (citation?.metadata?.recordId) {
      try {
        const isExcelOrCSV = ['csv', 'xlsx', 'xls'].includes(citation.metadata?.extension);
        const citationMeta = citation.metadata;
        onViewPdf('', citationMeta, aggregatedCitations, isExcelOrCSV);
      } catch (err) {
        console.error('Failed to fetch document:', err);
      }
    }
  };

  function isDocViewable(extension: string) {
    const viewableExtensions = ['pdf', 'xlsx', 'xls', 'csv', 'docx', 'html', 'txt', 'md','ppt','pptx'];
    return viewableExtensions.includes(extension);
  }

  return (
    <Fade in={isVisible} timeout={150}>
      <Card
        elevation={4}
        sx={{
          maxHeight: '320px',
          p: 1.5,
          mt: 0.5,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
          borderRadius: '8px',
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          overflow: 'auto',
          // Prevent card from affecting layout
          position: 'relative',
          transformOrigin: 'top left',
        }}
      >
        <Stack spacing={1.5}>
          {/* Document Header with View Button */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 0.5,
            }}
          >
            <Typography
              variant="subtitle2"
              onClick={handleClick}
              sx={{
                cursor: hasRecordId ? 'pointer' : 'default',
                color: 'text.primary',
                fontWeight: 500,
                fontSize: '0.85rem',
                lineHeight: 1.4,
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                transition: 'color 0.2s ease-in-out',
                maxWidth: 'calc(100% - 80px)', // Reserve space for button
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                '&:hover': hasRecordId
                  ? {
                      color: 'primary.main',
                    }
                  : {},
              }}
            >
              <Icon icon={fileDocumentIcon} width={16} height={16} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {citation.metadata?.recordName || 'Document'}
              </span>
            </Typography>

            {isDocViewable(citation.metadata.extension) && (
              <Button
                size="small"
                variant="outlined"
                color="primary"
                onClick={handleOpenPdf}
                sx={{
                  py: 0.5,
                  px: 1,
                  minWidth: '64px', // Fixed minimum width for button
                  height: '28px',
                  borderRadius: '4px',
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  ml: 1, // Add margin to separate from text
                  flexShrink: 0, // Prevent button from shrinking
                }}
              >
                <Icon
                  icon={eyeIcon}
                  width={14}
                  height={14}
                  style={{ marginRight: '4px', flexShrink: 0 }}
                />
                View
              </Button>
            )}
          </Box>
          {/* Document Metadata */}
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 0.5 }}>
            {citation.metadata?.pageNum[0] && (
              <Chip
                size="small"
                label={citation.metadata?.pageNum[0] ? `Page ${citation.metadata?.pageNum[0]}` : ''}
                variant="outlined"
                sx={{
                  height: '20px',
                  fontSize: '0.7rem',
                  fontWeight: 400,
                  bgcolor: 'transparent',
                }}
              />
            )}
            {citation.metadata?.extension && (
              <Chip
                size="small"
                label={citation.metadata.extension.toUpperCase()}
                variant="outlined"
                sx={{
                  height: '20px',
                  fontSize: '0.7rem',
                  fontWeight: 400,
                  bgcolor: 'transparent',
                }}
              />
            )}
          </Box>

          <Divider sx={{ my: 0.5 }} />

          {/* Citation Content */}
          <Box>
            <Typography
              sx={{
                fontSize: '0.8rem',
                lineHeight: 1.5,
                color: 'text.primary',
                fontStyle: 'italic',
                mb: 0.5,
                pb: 0.5,
                borderLeft: '2px solid',
                borderColor: 'primary.light',
                pl: 1.5,
              }}
            >
              {citation?.content || 'No content available.'}
            </Typography>
          </Box>

          {/* Topics and Departments in one row */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* Topics */}
            {citation.metadata?.topics && citation.metadata.topics.length > 0 && (
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontWeight: 500, display: 'block', mb: 0.5, fontSize: '0.7rem' }}
                >
                  Topics
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {citation.metadata.topics.slice(0, 4).map((topic, index) => (
                    <Chip
                      key={index}
                      label={topic}
                      size="small"
                      sx={{
                        height: '18px',
                        fontSize: '0.65rem',
                        fontWeight: 400,
                        bgcolor: 'background.default',
                        color: 'text.secondary',
                        '& .MuiChip-label': {
                          px: 1,
                        },
                      }}
                    />
                  ))}
                  {citation.metadata.topics.length > 4 && (
                    <Chip
                      label={`+${citation.metadata.topics.length - 4}`}
                      size="small"
                      sx={{
                        height: '18px',
                        fontSize: '0.65rem',
                        fontWeight: 400,
                        bgcolor: 'background.default',
                        color: 'text.secondary',
                        '& .MuiChip-label': {
                          px: 1,
                        },
                      }}
                    />
                  )}
                </Box>
              </Box>
            )}

            {/* Departments */}
            {citation.metadata?.departments && citation.metadata.departments.length > 0 && (
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontWeight: 500, display: 'block', mb: 0.5, fontSize: '0.7rem' }}
                >
                  Departments
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {citation.metadata.departments.map((dept, index) => (
                    <Chip
                      key={index}
                      label={dept}
                      size="small"
                      sx={{
                        height: '18px',
                        fontSize: '0.65rem',
                        fontWeight: 400,
                        bgcolor: 'background.default',
                        color: 'text.secondary',
                        '& .MuiChip-label': {
                          px: 1,
                        },
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </Stack>
      </Card>
    </Fade>
  );
};

export default CitationHoverCard;