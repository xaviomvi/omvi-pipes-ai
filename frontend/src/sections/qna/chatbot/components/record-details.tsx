import type { CustomCitation } from 'src/types/chat-bot';
import type {
  Permissions,
  RecordDetailsResponse,
} from 'src/sections/knowledgebase/types/record-details';

import { Icon } from '@iconify/react';
import linkIcon from '@iconify-icons/mdi/link';
import React, { useState, useEffect } from 'react';
import loadingIcon from '@iconify-icons/mdi/loading';
import openNewIcon from '@iconify-icons/mdi/open-in-new';
import filePdfIcon from '@iconify-icons/mdi/file-pdf-box';
import fileIcon from '@iconify-icons/mdi/file-text-outline';
import fileDocIcon from '@iconify-icons/mdi/file-document-outline';

import {
  Box,
  Chip,
  Paper,
  Button,
  Divider,
  Tooltip,
  Typography,
  IconButton,
  CircularProgress,
} from '@mui/material';

import axios from 'src/utils/axios';

import { CONFIG } from 'src/config-global';

import { ORIGIN } from 'src/sections/knowledgebase/constants/knowledge-search';

import PDFViewer from './pdf-viewer';

interface RecordDetailsProps {
  recordId: string;
  citations: CustomCitation[];
  onExternalLink?: string;
}

const RecordDetails = ({ recordId, onExternalLink, citations = [] }: RecordDetailsProps) => {
  const [recordData, setRecordData] = useState<RecordDetailsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isPDFViewerOpen, setIsPDFViewerOpen] = useState<boolean>(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer>();

  useEffect(() => {
    if (!recordId) return;

    const fetchRecordDetails = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await axios.get<RecordDetailsResponse>(
          `/api/v1/knowledgebase/record/${recordId}`
        );
        setRecordData(response.data);
      } catch (err) {
        setError('Failed to fetch record details. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchRecordDetails();
  }, [recordId]);

  const handleOpenPDFViewer = async () => {
    const record = recordData?.record;
    if (record?.origin === ORIGIN.UPLOAD) {
      if (record?.externalRecordId) {
        try {
          const { externalRecordId } = record;
          const response = await axios.get(`/api/v1/document/${externalRecordId}/download`, {
            responseType: 'blob',
          });

          // Read the blob response as text to check if it's JSON with signedUrl
          const reader = new FileReader();
          const textPromise = new Promise<string>((resolve) => {
            reader.onload = () => {
              resolve(reader.result?.toString() || '');
            };
          });

          reader.readAsText(response.data);
          const text = await textPromise;

         
          try {
            // Try to parse as JSON to check for signedUrl property
            const jsonData = JSON.parse(text);
            if (jsonData && jsonData.signedUrl) {
              setPdfUrl(jsonData.signedUrl);
              setIsPDFViewerOpen(true);
              return;
            }
          } catch (e) {
            // Case 2: Local storage - Return buffer
            const bufferReader = new FileReader();
            const arrayBufferPromise = new Promise<ArrayBuffer>((resolve) => {
              bufferReader.onload = () => {
                resolve(bufferReader.result as ArrayBuffer);
              };
              bufferReader.readAsArrayBuffer(response.data);
            });

            const buffer = await arrayBufferPromise;
            setFileBuffer(buffer);
            setIsPDFViewerOpen(true);
            return;
          }

          throw new Error('Invalid response format');
        } catch (err) {
          console.error('Error downloading document:', err);
          throw new Error('Failed to download document');
        }
      }
    } else if (record?.origin === ORIGIN.CONNECTOR) {
      try {
        const response = await axios.get(
          `${CONFIG.backendUrl}/api/v1/knowledgeBase/stream/record/${recordId}`,
          {
            responseType: 'blob',
          }
        );

      
        // Convert blob directly to ArrayBuffer
        const bufferReader = new FileReader();
        const arrayBufferPromise = new Promise<ArrayBuffer>((resolve, reject) => {
          bufferReader.onload = () => {
            // Create a copy of the buffer to prevent detachment issues
            const originalBuffer = bufferReader.result as ArrayBuffer;
            const bufferCopy = originalBuffer.slice(0);
            resolve(bufferCopy);
          };
          bufferReader.onerror = () => {
            reject(new Error('Failed to read blob as array buffer'));
          };
          bufferReader.readAsArrayBuffer(response.data);
        });

        const buffer = await arrayBufferPromise;
        setFileBuffer(buffer);
        setIsPDFViewerOpen(true);
      } catch (err) {
        console.error('Error downloading document:', err);
        throw new Error(`Failed to download document: ${err.message}`);
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
          gap: 2,
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
            fontWeight: 500,
          }}
        >
          <Icon icon={loadingIcon} fontSize={16} />
          Loading record details...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  if (!recordData) {
    return null;
  }

  const { record } = recordData;
  let webUrl = record.fileRecord?.webUrl;
  if (record.origin === 'UPLOAD' && webUrl && !webUrl.startsWith('http')) {
    const baseUrl = `${window.location.protocol}//${window.location.host}`;
    const newWebUrl = baseUrl + webUrl;
    webUrl = newWebUrl;
  }
  console.log(webUrl)

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
          <Icon icon={fileIcon} width={24} height={24} />
          Record Details
          {webUrl && (
            <Tooltip title="View document">
              <IconButton onClick={() => window.open(webUrl, '_blank', 'noopener,noreferrer')}>
                <Icon icon={linkIcon} color="blue" width={24} height={24} />
              </IconButton>
            </Tooltip>
          )}
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
              <Icon icon={openNewIcon} width={20} height={20} />
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
          { label: 'Name', value: record.recordName },
          { label: 'Record Type', value: record.recordType },
          { label: 'Origin', value: record.origin },
          { label: 'Indexing Status', value: record.indexingStatus },
          { label: 'Version', value: record.version },
          {
            label: 'Created At',
            value: new Date(record.createdAtTimestamp).toLocaleString(),
          },
          {
            label: 'Updated At',
            value: new Date(record.updatedAtTimestamp).toLocaleString(),
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

        {/* Knowledge Base */}
        {recordData.knowledgeBase && (
          <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
            <Typography
              variant="body2"
              sx={{
                mb: 1,
                fontWeight: 600,
                color: 'text.secondary',
              }}
            >
              Knowledge Base
            </Typography>
            <Typography variant="body1" color="text.primary" sx={{ fontWeight: 500 }}>
              {recordData.knowledgeBase.name}
            </Typography>
          </Box>
        )}

        {/* Permissions */}
        {recordData.permissions && (
          <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
            <Typography
              variant="body2"
              sx={{
                mb: 1,
                fontWeight: 600,
                color: 'text.secondary',
              }}
            >
              Permissions
            </Typography>
            <Typography variant="body1" color="text.primary" sx={{ fontWeight: 500 }}>
              {recordData.permissions.length > 0 ? (
                recordData.permissions.map((permission: Permissions) => (
                  <Chip
                    key={permission.relationship} // Add a key to avoid React warnings
                    label={permission.relationship}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: '0.75rem',
                      fontWeight: 500,
                    }}
                  />
                ))
              ) : (
                <Typography variant="body2">No permissions assigned</Typography>
              )}
            </Typography>
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
              <Icon icon={fileDocIcon} width={20} height={20} />
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
                <strong>File Name:</strong> {record.fileRecord.name}
              </Typography>
              <Typography variant="body2">
                <strong>File Extension:</strong> {record.fileRecord.extension}
              </Typography>
              <Typography variant="body2">
                <strong>MIME Type:</strong> {record.fileRecord.mimeType}
              </Typography>
              <Typography variant="body2">
                <strong>Size:</strong> {(record.fileRecord.sizeInBytes / 1024).toFixed(2)} KB
              </Typography>
              {record.fileRecord.extension.toLowerCase() === 'pdf' && (
                <Box gridColumn="1 / -1">
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<Icon icon={filePdfIcon} />}
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
      {(pdfUrl || fileBuffer) && (
        <PDFViewer
          open={isPDFViewerOpen}
          onClose={handleClosePDFViewer}
          pdfUrl={pdfUrl}
          pdfBuffer={fileBuffer}
          fileName={record.fileRecord?.name || 'Document'}
          // citations={citations}
        />
      )}
    </Paper>
  );
};

export default RecordDetails;
