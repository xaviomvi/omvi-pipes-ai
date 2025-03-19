import type { Citation } from 'src/types/chat-bot';
import type { Record } from 'src/types/chat-message';

import React from 'react';

import { Fade, Card, Stack, Button, Typography } from '@mui/material';

import axiosInstance from 'src/utils/axios';

interface CitationHoverCardProps {
  citation : Citation;
  isVisible : boolean;
  onRecordClick : (record: Record) => void;
  onClose : ()=> void;
  onViewPdf  : (url: string, citations: Citation[], isExcelFile?: boolean) => Promise<void>
  aggregatedCitations : Citation[];
} 

interface TrimmedTextProps {
  text: string | undefined;
  maxLength?: number;
}

const TrimmedText = ({ text, maxLength = 150 } : TrimmedTextProps) => {
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
  const hasRecordId = Boolean(citation.metadata?.recordId);
  const handleClick = (e: React.MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    if (hasRecordId && citation.metadata?.recordId) {
      // Create a proper Record object with the required citations property
      const record: Record = {
        ...citation.metadata,
        recordId: citation.metadata.recordId,
        citations: aggregatedCitations.filter(c => 
          c.citationMetaData?.recordId === citation.metadata?.recordId
        ),
      };
      onRecordClick(record);
      onClose();
    }
  };

  const handleOpenPdf = async () => {
    if (aggregatedCitations[0]?.citationMetaData?.recordId) {
      try {
        const isExcelOrCSV = aggregatedCitations[0].citationMetaData?.recordOriginFormat === 'CSV';
        const recordId = aggregatedCitations[0]?.citationMetaData?.recordId;
        const getRecord = await axiosInstance.get(`/api/v1/knowledgebase/${recordId}`);
        const { storageDocumentId } = getRecord.data.fileRecord;
        const response = await axiosInstance.get(`/api/v1/document/${storageDocumentId}/download`);

        const url = response.data.data;
        onViewPdf(url, aggregatedCitations, isExcelOrCSV);
      } catch (err) {
        console.error('Failed to fetch PDF:', err);
      }
    }
  };

  return (
    <Fade in={isVisible}>
      <Card
        sx={{
          position: 'absolute',
          zIndex: 1400,
          width: '400px',
          height: '250px',
          p: 2,
          mt: 1,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
          borderRadius: '8px',
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          overflow: 'auto',
        }}
      >
        <Stack spacing={1.5}>
          {/* Title Section */}
          {citation.metadata?.question && (
            <Typography
              variant="subtitle2"
              onClick={handleClick}
              sx={{
                cursor: hasRecordId ? 'pointer' : 'default',
                color: hasRecordId ? 'primary.main' : 'text.primary',
                fontWeight: 600,
                fontSize: '0.875rem',
                lineHeight: 1.4,
                transition: 'color 0.2s ease-in-out',
                '&:hover': hasRecordId
                  ? {
                      color: 'primary.dark',
                      textDecoration: 'underline',
                    }
                  : {},
              }}
            >
              {citation.metadata.question}
            </Typography>
          )}

          {/* Main Content */}
          <Typography
            onClick={handleClick}
            sx={{
              fontSize: '0.8rem',
              lineHeight: 1.4,
              fontWeight: 600,
              cursor: hasRecordId ? 'pointer' : 'default',
              color: 'text.primary',
              transition: 'all 0.2s ease-in-out',
              '&:hover': hasRecordId
                ? {
                    color: 'primary.main',
                    textDecoration: 'underline',
                  }
                : {},
            }}
          >
            {citation.content?.length > 200
              ? `${citation.content.substring(0, 200)}...`
              : citation.content}
          </Typography>

          {/* Paragraph Content */}
          {citation.metadata?.para?.content && (
            <TrimmedText text={citation.metadata.para.content} maxLength={300} />
          )}

          {/* Answer Section */}
          {citation.metadata?.answer && (
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">
                Answer:
              </Typography>
              <TrimmedText text={citation.metadata.answer} maxLength={150} />
            </Stack>
          )}
          <Button onClick={handleOpenPdf}>View Document</Button>
        </Stack>
      </Card>
    </Fade>
  );
};

export default CitationHoverCard;
