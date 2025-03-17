import React from 'react';
import dayjs from 'dayjs';
import { Icon } from '@iconify/react';

import { Box, Card, Stack, Typography, IconButton, CardContent } from '@mui/material';

import axios from 'src/utils/axios';

import { CONFIG } from 'src/config-global';

import type { Record } from './types/record-details';

// Keep the existing utility functions
const getFileIcon = (extension: string) => {
  const ext = extension?.replace('.', '').toLowerCase();

  switch (ext) {
    case 'pdf':
      return 'vscode-icons:file-type-pdf2';
    case 'doc':
    case 'docx':
      return 'vscode-icons:file-type-word2';
    case 'xls':
    case 'xlsx':
      return 'vscode-icons:file-type-excel2';
    case 'ppt':
    case 'pptx':
      return 'vscode-icons:file-type-powerpoint2';
    case 'jpg':
    case 'jpeg':
    case 'png':
      return 'vscode-icons:file-type-image';
    case 'zip':
    case 'rar':
      return 'vscode-icons:file-type-zip';
    default:
      return 'mdi:file-document-outline';
  }
};

const getExtensionColor = (extension: string) => {
  const ext = extension?.replace('.', '').toLowerCase();

  switch (ext) {
    case 'pdf':
      return '#FF4B4B';
    case 'doc':
    case 'docx':
      return '#2B579A';
    case 'xls':
    case 'xlsx':
      return '#217346';
    case 'jpg':
    case 'jpeg':
    case 'png':
      return '#4BAFFF';
    case 'zip':
    case 'rar':
      return '#FFA000';
    default:
      return '#757575';
  }
};

interface RecordDocumentViewerProps {
  record: Record;
}

const RecordDocumentViewer = ({ record }: RecordDocumentViewerProps) => {
  if (!record?.fileRecord) return null;

  const {
    recordName,
    externalRecordId,
    departments,
    appSpecificRecordType,
    modules,
    createdAtTimestamp,
    fileRecord,
  } = record;

  const handleDownload = async () => {
    try {
      const response = await axios.post(
        `${CONFIG.backendUrl}/api/v1/document/${externalRecordId}/signedUrlOfVersion`
      );
      const signedUrl = response.data;

      // Create a temporary anchor element
      const link = document.createElement('a');
      link.href = signedUrl;
      link.setAttribute('download', ''); // This will use the filename from the Content-Disposition header

      // Append to the document, trigger click, and then remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to download document:', error);
    }
  };

  return (
    <Card sx={{ maxWidth: 800, width: '100%' }}>
      <CardContent>
        {/* Document Header */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <Icon
            icon={getFileIcon(fileRecord.extension)}
            width={40}
            height={40}
            style={{ color: getExtensionColor(fileRecord.extension) }}
          />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" gutterBottom>
              {recordName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Added on {dayjs(createdAtTimestamp).format('MMM DD, YYYY')}
            </Typography>
          </Box>
          <IconButton onClick={handleDownload} sx={{ color: 'primary.main' }}>
            <Icon icon="mdi:download" width={24} />
          </IconButton>
        </Stack>

        {/* {certificate && (
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Typography variant="body2" color="text.secondary">
              Certificate:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip
                label={certificate.certificateType}
                size="small"
                variant="outlined"
                color="primary"
              />
            </Stack>
          </Stack>
        )} */}

        {/* Document Details */}
        {/* <Stack spacing={2}>
          
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary" sx={{ width: 120 }}>
              Status:
            </Typography>
            <Chip
              label={status}
              size="small"
              color={status === 'PROCESSING' ? 'warning' : 'success'}
            />
          </Stack>

          
          {departments?.length > 0 && (
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Typography variant="body2" color="text.secondary" sx={{ width: 120 }}>
                Departments:
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {departments.map((dept) => (
                  <Chip key={dept._id} label={dept.name} size="small" variant="outlined" />
                ))}
              </Stack>
            </Stack>
          )}

          
          {appSpecificRecordType?.length > 0 && (
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Typography variant="body2" color="text.secondary" sx={{ width: 120 }}>
                Record Type:
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {appSpecificRecordType.map((type) => (
                  <Chip key={type._id} label={type.name} size="small" variant="outlined" />
                ))}
              </Stack>
            </Stack>
          )}

         
          {certificate && (
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Typography variant="body2" color="text.secondary" sx={{ width: 120 }}>
                Certificate:
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip
                  label={certificate.certificateType}
                  size="small"
                  variant="outlined"
                  color="primary"
                />
              </Stack>
            </Stack>
          )}
        </Stack> */}
      </CardContent>
    </Card>
  );
};

export default RecordDocumentViewer;
