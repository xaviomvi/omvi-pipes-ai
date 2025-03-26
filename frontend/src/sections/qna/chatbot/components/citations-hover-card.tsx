import type { Citation, CustomCitation } from 'src/types/chat-bot';
import type { Record } from 'src/types/chat-message';

import React from 'react';
import { Icon } from '@iconify/react';

import { 
  Fade, 
  Card, 
  Stack, 
  Button, 
  Typography, 
  Chip, 
  Box, 
  Divider 
} from '@mui/material';

import axios from 'src/utils/axios';


interface CitationHoverCardProps {
  citation: CustomCitation;
  isVisible: boolean;
  onRecordClick: (record: Record) => void;
  onClose: () => void;
  onViewPdf: (url: string, citations: CustomCitation[], isExcelFile?: boolean) => Promise<void>;
  aggregatedCitations: CustomCitation[];
}

interface TrimmedTextProps {
  text: string | undefined;
  maxLength?: number;
}

const TrimmedText = ({ text, maxLength = 150 }: TrimmedTextProps) => {
  if (!text) return null;
  const trimmedText = text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;

  return (
    <Typography
      sx={{
        fontSize: '0.8rem',
        lineHeight: 1.4,
        color: 'text.secondary',
      }}
    >
      {trimmedText}
    </Typography>
  );
};

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
      onClose();
    }
  };

  const handleOpenPdf = async () => {
    if (citation?.metadata?.recordId) {
      if (citation.metadata.origin === 'UPLOAD') {
        try {
          const isExcelOrCSV = ['CSV', 'xlsx', 'xls'].includes(citation.metadata?.extension);
          const recordId = citation.metadata?.recordId;
          const response = await axios.get(`/api/v1/knowledgebase/${recordId}`);
          const { externalRecordId } = response.data.record;

          const downloadResponse = await axios.get(`/api/v1/document/${externalRecordId}/download`);
          const url = downloadResponse.data.signedUrl;
          onViewPdf(url, aggregatedCitations, isExcelOrCSV);
        } catch (err) {
          console.error('Failed to fetch document:', err);
        }
      }
    }
  };

  return (
    <Fade in={isVisible}>
      <Card
        sx={{
          position: 'absolute',
          zIndex: 1400,
          width: '380px',
          maxHeight: '320px',
          p: 1.5,
          mt: 1,
          boxShadow: '0 2px 14px rgba(0, 0, 0, 0.08)',
          borderRadius: '6px',
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          overflow: 'auto',
        }}
      >
        <Stack spacing={1.5}>
          {/* Document Header with View Button */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
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
                '&:hover': hasRecordId
                  ? {
                      color: 'primary.main',
                    }
                  : {},
              }}
            >
              <Icon icon="mdi:file-document-outline" width={16} height={16} />
              {citation.metadata?.recordName || 'Document'}
            </Typography>
            
            <Button
              size="small"
              variant="outlined"
              color="primary"
              onClick={handleOpenPdf}
              sx={{ 
                py: 0.5, 
                px: 1, 
                minWidth: 0, 
                height: '28px',
                borderRadius: '4px',
                textTransform: 'none',
                fontSize: '0.75rem',
                fontWeight: 500
              }}
            >
              <Icon icon="mdi:eye-outline" width={14} height={14} style={{ marginRight: '4px' }} />
              View
            </Button>
          </Box>
          
          {/* Document Metadata */}
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 0.5 }}>
            <Chip 
              size="small" 
              label={`Page ${citation.metadata?.pageNum || 1}`} 
              variant="outlined"
              sx={{ 
                height: '20px', 
                fontSize: '0.7rem',
                fontWeight: 400,
                bgcolor: 'transparent'
              }}
            />
            {citation.metadata?.extension && (
              <Chip 
                size="small" 
                label={citation.metadata.extension.toUpperCase()} 
                variant="outlined"
                sx={{ 
                  height: '20px', 
                  fontSize: '0.7rem',
                  fontWeight: 400,
                  bgcolor: 'transparent'
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
                          px: 1
                        }
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
                          px: 1
                        }
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
                          px: 1
                        }
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