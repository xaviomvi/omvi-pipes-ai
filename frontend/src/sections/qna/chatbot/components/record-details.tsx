import type { Citation } from 'src/types/chat-bot';

import { Icon } from '@iconify/react';
import React, { useState, useEffect } from 'react';

import {
  Box,
  Chip,
  Paper,
  Stack,
  Button,
  Divider,
  Tooltip,
  Typography,
  IconButton,
  CircularProgress,
} from '@mui/material';

import axiosInstance from 'src/utils/axios';

import PDFViewer from './pdf-viewer';

interface Department {
  _id: string;
  name: string;
}

interface AppSpecificRecordType {
  _id: string;
  name: string;
}

interface Certificate {
  certificateType: string;
  [key: string]: any;
}

interface FileRecord {
  storageDocumentId: string;
  extension: string;
  fileName?: string;
  createdAt: string;
  [key: string]: any;
}

interface Record {
  _id: string;
  name: string;
  slug: string;
  version: string;
  status: string;
  recordType: string;
  createdAt: string;
  updatedAt: string;
  departments?: Department[];
  appSpecificRecordType?: AppSpecificRecordType[];
  certificate?: Certificate;
  fileRecord?: FileRecord;
  [key: string]: any;
}

interface RecordDetailsProps {
  recordId: string;
  citations: Citation[];
  onExternalLink?: string;
}

interface RecordDetailsProps {
  recordId: string;
  citations: Citation[];
  onExternalLink?: string;
}

const RecordDetails = ({ recordId, onExternalLink,citations = [] } : RecordDetailsProps) => {
  const [record, setRecord] = useState<Record | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isPDFViewerOpen, setIsPDFViewerOpen] = useState<boolean>(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

console.log(citations)
  useEffect(() => {
    if (!recordId) return;

    const fetchRecordDetails = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await axiosInstance.get(`/api/v1/knowledgebase/${recordId}`);
        setRecord(response.data);
      } catch (err) {
        setError('Failed to fetch record details. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchRecordDetails();
  }, [recordId]);

  const handleOpenPDFViewer = async () => {
    if (record?.fileRecord?.storageDocumentId) {
      try {
        const response = await axiosInstance.get(
          `/api/v1/document/${record.fileRecord.storageDocumentId}/download`
        );

        const url = response.data.data;

        setPdfUrl(url);
        setIsPDFViewerOpen(true);
      } catch (err) {
        console.error('Failed to fetch PDF:', err);
      }
    }
  };

  const handleClosePDFViewer = () => {
    setIsPDFViewerOpen(false);
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 4,
          gap: 2
        }}
      >
        <CircularProgress size={24} thickness={2} />
        <Typography
          color="text.secondary"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            fontSize: '0.875rem',
            fontWeight: 500
          }}
        >
          <Icon icon="mdi:loading" fontSize={16} />
          Loading record details...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  if (!record) {
    return null;
  }

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        mt: 2,
        bgcolor: 'background.paper',
        borderRadius: 2,
        position: 'relative',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography
          variant="h5"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            fontWeight: 600,
            color: 'text.primary',
          }}
        >
          <Icon icon="mdi:file-text-outline" width={24} height={24} />
          Record Details
          <Tooltip title="View document">
            <IconButton
              onClick={() =>
                window.open(`/knowledge-base/records/${recordId}`, '_blank', 'noopener,noreferrer')
              }
            >
              <Icon icon="mdi:link" color="blue" width={24} height={24} />
            </IconButton>
          </Tooltip>
        </Typography>

        {onExternalLink && (
          <Tooltip title="Open External Link">
            <IconButton
              color="primary"
              onClick={() => window.open(onExternalLink, '_blank', 'noopener,noreferrer')}
              sx={{
                position: 'absolute',
                top: 16,
                right: 16,
                bgcolor: 'action.hover',
                '&:hover': {
                  bgcolor: 'action.selected',
                },
              }}
            >
              <Icon icon="mdi:open-in-new" width={20} height={20} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Divider sx={{ mb: 2 }} />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 1,
        }}
      >
        {[
          { label: 'Name', value: record.name },
          { label: 'Slug', value: record.slug },
          { label: 'Version', value: record.version },
          { label: 'Status', value: record.status },
          { label: 'Record Type', value: record.recordType },
          {
            label: 'Created At',
            value: new Date(record.createdAt).toLocaleString(),
          },
          {
            label: 'Updated At',
            value: new Date(record.updatedAt).toLocaleString(),
          },
        ].map((item) => (
          <Box
            key={item.label}
            sx={{
              bgcolor: 'background.default',
              borderRadius: 1,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontWeight: 600 }}>
              {item.label}
            </Typography>
            <Typography variant="body1" color="text.primary" sx={{ fontWeight: 500 }}>
              {item.value || 'N/A'}
            </Typography>
          </Box>
        ))}

        {/* Departments */}
        <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
          <Typography
            variant="body2"
            sx={{
              mb: 1,
              fontWeight: 600,
              color: 'text.secondary',
            }}
          >
            Departments
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {record.departments?.map((dept) => (
              <Chip
                key={dept._id}
                label={dept.name}
                size="small"
                icon={<Icon icon="mdi:folder-outline" width={16} height={16} />}
                variant="outlined"
                color="primary"
                sx={{ mb: 0.5 }}
              />
            ))}
          </Stack>
        </Box>

        {/* App Specific Record Types */}
        <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
          <Typography
            variant="body2"
            sx={{
              mb: 1,
              fontWeight: 600,
              color: 'text.secondary',
            }}
          >
            Record Types
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {record.appSpecificRecordType?.map((type) => (
              <Chip
                key={type._id}
                label={type.name}
                size="small"
                icon={<Icon icon="mdi:tag-outline" width={16} height={16} />}
                variant="outlined"
                color="secondary"
                sx={{ mb: 0.5 }}
              />
            ))}
          </Stack>
        </Box>

        {/* Certificate Details */}
        {record.certificate && (
          <Box gridColumn="1 / -1" sx={{ mt: 2 }}>
            <Typography
              variant="subtitle1"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: 1,
                fontWeight: 600,
                color: 'text.primary',
              }}
            >
              <Icon icon="mdi:check-circle-outline" width={20} height={20} />
              Certificate Information
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
              }}
            >
              <Typography variant="body2">
                <strong>Certificate Type:</strong> {record.certificate.certificateType}
              </Typography>
            </Box>
          </Box>
        )}

        {/* File Record Details */}
        {record.fileRecord && (
          <Box gridColumn="1 / -1" sx={{ mt: 2 }}>
            <Typography
              variant="subtitle1"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: 1,
                fontWeight: 600,
                color: 'text.primary',
              }}
            >
              <Icon icon="mdi:file-document-outline" width={20} height={20} />
              File Information
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
              }}
            >
              <Typography variant="body2">
                <strong>File Extension:</strong> {record.fileRecord.extension}
              </Typography>
              <Typography variant="body2">
                <strong>Uploaded At:</strong>{' '}
                {new Date(record.fileRecord.createdAt).toLocaleString()}
              </Typography>
              {record.fileRecord.extension.toLowerCase() === 'pdf' && (
                <Box gridColumn="1 / -1">
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<Icon icon="mdi:file-pdf-box" />}
                    onClick={handleOpenPDFViewer}
                    sx={{
                      mt: 1,
                      textTransform: 'none',
                      borderRadius: 2,
                    }}
                  >
                    View Document
                  </Button>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>
      {pdfUrl && (
        <PDFViewer 
          open={isPDFViewerOpen}
          onClose={handleClosePDFViewer}
          pdfUrl={pdfUrl}
          fileName={record.fileRecord?.fileName || 'Document'}
          // citations={citations}
        />
      )}
    </Paper>
  );
};

export default RecordDetails;
