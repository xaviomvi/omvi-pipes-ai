import { Icon } from '@iconify/react';
import React, { useState, useEffect } from 'react';

import {
  Box,
  alpha,
  Dialog,
  Button,
  TextField,
  Typography,
  IconButton,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';

import axios from 'src/utils/axios';


interface SingleFileUploadDialogProps {
  open: boolean;
  onClose: () => void;
  initialName?: string;
  title?: string;
  acceptedFileTypes?: string;
  maxFileSize?: number; // in bytes
  onRecordUpdated: () => void;
  storageDocumentId: string;
  recordId: string;
  existingFile?: boolean; // Flag to indicate if there's an existing file
}

const SingleFileUploadDialog: React.FC<SingleFileUploadDialogProps> = ({
  open,
  onClose,
  initialName = '',
  title = 'Upload File',
  acceptedFileTypes = '*/*',
  maxFileSize,
  onRecordUpdated,
  storageDocumentId,
  recordId,
  existingFile = false
}) => {
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [nameChanged, setNameChanged] = useState(false);

  // Reset state when dialog opens/closes and set initial name
  useEffect(() => {
    if (open) {
      setName(initialName || '');
      setNameChanged(false);
    } else {
      setFile(null);
      setUploading(false);
      setNameChanged(false);
    }
  }, [open, initialName]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    setNameChanged(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      
      if (maxFileSize && selectedFile.size > maxFileSize) {
        // Handle file too large
        alert(`File is too large. Maximum size is ${formatFileSize(maxFileSize)}`);
        return;
      }
      
      setFile(selectedFile);
      
      // If name is empty and no initial name was provided, use the file name (without extension)
      if (!name.trim() && !initialName) {
        const fileName = selectedFile.name.split('.').slice(0, -1).join('.');
        setName(fileName);
        setNameChanged(true);
      }
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      
      if (maxFileSize && droppedFile.size > maxFileSize) {
        // Handle file too large
        alert(`File is too large. Maximum size is ${formatFileSize(maxFileSize)}`);
        return;
      }
      
      setFile(droppedFile);
      
      // If name is empty and no initial name was provided, use the file name (without extension)
      if (!name.trim() && !initialName) {
        const fileName = droppedFile.name.split('.').slice(0, -1).join('.');
        setName(fileName);
        setNameChanged(true);
      }
    }
  };

  const handleUpload = async () => {
    setUploading(true);
    
    try {
      // Create FormData object
      const formData = new FormData();
      
      // Only append file if a new one was selected
      if (file) {
        formData.append('file', file);
      }
      
      // Always append the current name (which might be changed or not)
      formData.append('recordName', name.trim() || (file ? file.name : initialName));
            
      // Send the file to the API
      const response = await axios.put(`/api/v1/knowledgeBase/${recordId}`, formData);
       
      if (!response) {
        throw new Error(`Upload failed with status: ${response}`);
      }
      
      // Call onRecordUpdated
      onRecordUpdated();      
      // Close the dialog
      onClose();
    } catch (error) {
      console.error('Error updating record:', error);
      alert('Failed to update. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / (k ** i)).toFixed(2))} ${sizes[i]}`;
  };

  // Determine if we should enable the upload button
  const canUpload = (file !== null) || (nameChanged && name.trim() !== initialName);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: '12px',
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle sx={{ p: 2.5 }}>
        <Typography variant="h6" fontWeight={500}>
          {title}
        </Typography>
      </DialogTitle>

      {uploading ? (
        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '200px',
            py: 4,
          }}
        >
          <CircularProgress size={36} thickness={4} sx={{ mb: 2.5 }} />
          <Typography variant="subtitle1" fontWeight={500}>
            {file ? 'Uploading file...' : 'Updating record...'}
          </Typography>
        </DialogContent>
      ) : (
        <DialogContent sx={{ p: 2.5 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Name {existingFile ? '' : '(Optional)'}
          </Typography>
          <TextField
            value={name}
            onChange={handleNameChange}
            fullWidth
            size="small"
            placeholder="Enter name"
            variant="outlined"
            sx={{ mb: 2.5 }}
          />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {existingFile ? 'Replace File' : 'File'}
          </Typography>
          <Box
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            sx={{
              border: '2px dashed',
              borderColor: dragActive ? 'primary.main' : alpha('#000', 0.15),
              borderRadius: '8px',
              p: 3,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              bgcolor: dragActive ? alpha('#1976d2', 0.04) : 'transparent',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: alpha('#1976d2', 0.04),
              },
            }}
          >
            <input
              type="file"
              id="fileInput"
              style={{ display: 'none' }}
              accept={acceptedFileTypes}
              onChange={handleFileChange}
            />
            
            <label htmlFor="fileInput" style={{ display: 'block', cursor: 'pointer' }}>
              <Icon
                icon="mdi:cloud-upload-outline"
                style={{
                  fontSize: '42px',
                  marginBottom: '12px',
                  color: dragActive ? '#1976d2' : '#757575',
                }}
              />
              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 500 }}>
                {dragActive ? 'Drop file here' : existingFile ? 'Drag and drop to replace file' : 'Drag and drop file here'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                or
              </Typography>
              <Button
                variant="outlined"
                size="small"
                component="span"
                sx={{ borderRadius: '6px' }}
              >
                Browse File
              </Button>
            </label>
          </Box>

          {file && (
            <Box
              sx={{
                mt: 2,
                p: 2,
                borderRadius: '8px',
                bgcolor: alpha('#000', 0.02),
                border: `1px solid ${alpha('#000', 0.08)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, overflow: 'hidden' }}>
                <Icon
                  icon="mdi:file-document-outline"
                  style={{ fontSize: '24px', color: '#1976d2', flexShrink: 0 }}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" noWrap title={file.name} fontWeight={500}>
                    {file.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatFileSize(file.size)}
                  </Typography>
                </Box>
              </Box>
              <IconButton
                size="small"
                onClick={() => setFile(null)}
                sx={{ ml: 1, flexShrink: 0 }}
              >
                <Icon icon="mdi:close" fontSize={18} />
              </IconButton>
            </Box>
          )}

          {existingFile && !file && (
            <Box
              sx={{
                mt: 2,
                p: 2,
                borderRadius: '8px',
                bgcolor: alpha('#000', 0.02),
                border: `1px solid ${alpha('#000', 0.08)}`,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Current file will be kept unless you upload a new one.
              </Typography>
            </Box>
          )}
        </DialogContent>
      )}

      <DialogActions sx={{ px: 2.5, pb: 2.5 }}>
        <Button
          onClick={onClose}
          color="inherit"
          size="small"
          disabled={uploading}
          sx={{ borderRadius: '6px' }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleUpload}
          variant="contained"
          size="small"
          disabled={!canUpload || uploading}
          sx={{ borderRadius: '6px' }}
        >
          {existingFile ? (file ? 'Replace' : nameChanged ? 'Update' : 'Save') : 'Upload'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SingleFileUploadDialog;