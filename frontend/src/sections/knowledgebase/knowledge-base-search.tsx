import { Icon } from '@iconify/react';
import { useState, useEffect, useCallback } from 'react';

import { Box, alpha, Button, styled, Divider, useTheme } from '@mui/material';

import axios from 'src/utils/axios';

import { CONFIG } from 'src/config-global';

import { searchKnowledgeBase } from './utils';
import KnowledgeSearch from './knowledge-search';
import { ORIGIN } from './constants/knowledge-search';
import KnowledgeSearchSideBar from './knowledge-search-sidebar';
import ExcelViewer from '../qna/chatbot/components/excel-highlighter';
import PdfHighlighterComp from '../qna/chatbot/components/pdf-highlighter';

import type { Filters } from './types/knowledge-base';
import type { PipesHub, SearchResult, AggregatedDocument } from './types/search-response';

// Constants for sidebar widths - must match with the sidebar component
const SIDEBAR_EXPANDED_WIDTH = 300;
const SIDEBAR_COLLAPSED_WIDTH = 64;

// Styled Close Button for the citation viewer
const StyledCloseButton = styled(Button)(({ theme }) => ({
  position: 'absolute',
  top: 15,
  right: 15,
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  textTransform: 'none',
  padding: '6px 12px',
  minWidth: 'auto',
  fontSize: '0.875rem',
  fontWeight: 600,
  zIndex: 10,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[2],
  '&:hover': {
    backgroundColor: theme.palette.primary.dark,
    boxShadow: theme.shadows[4],
  },
}));

export default function KnowledgeBaseSearch() {
  const theme = useTheme();
  const [filters, setFilters] = useState<Filters>({
    department: [],
    moduleId: [],
    appSpecificRecordType: [],
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [topK, setTopK] = useState<number>(10);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [aggregatedCitations, setAggregatedCitations] = useState<AggregatedDocument[]>([]);
  const [openSidebar, setOpenSidebar] = useState<boolean>(true);
  const [isPdf, setIsPdf] = useState<boolean>(false);
  const [isExcel, setIsExcel] = useState<boolean>(false);
  const [fileUrl, setFileUrl] = useState<string>('');
  const [recordCitations, setRecordCitations] = useState<AggregatedDocument | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [recordsMap, setRecordsMap] = useState<Record<string, PipesHub.Record>>({});
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  // Add a state to track if citation viewer is open
  const isCitationViewerOpen = isPdf || isExcel;

  const handleFilterChange = (newFilters: Filters) => {
    setFilters(newFilters);
  };

  const aggregateCitationsByRecordId = useCallback(
    (documents: SearchResult[]): AggregatedDocument[] => {
      // Create a map to store aggregated documents
      const aggregationMap = documents.reduce(
        (acc, doc) => {
          const recordId = doc.metadata?.recordId || 'unknown';

          // If this recordId doesn't exist in the accumulator, create a new entry
          if (!acc[recordId]) {
            acc[recordId] = {
              recordId,
              documents: [],
            };
          }

          // Add current document to the group
          acc[recordId].documents.push(doc);

          return acc;
        },
        {} as Record<string, AggregatedDocument>
      );

      // Convert the aggregation map to an array
      return Object.values(aggregationMap);
    },
    []
  );

  const aggregateRecordsByRecordId = useCallback(
    (records: PipesHub.Record[]): Record<string, PipesHub.Record> =>
      records.reduce(
        (acc, record) => {
          // Use _key as the lookup key
          const recordKey = record._key || 'unknown';

          // Store the record in the accumulator with its _key as the key
          acc[recordKey] = record;

          return acc;
        },
        {} as Record<string, PipesHub.Record>
      ),

    []
  );

  const handleSearch = useCallback(async () => {
    // Only proceed if search query is not empty
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setAggregatedCitations([]);
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      const data = await searchKnowledgeBase(searchQuery, topK, filters);

      // Extract search results from the response
      const results = data.searchResults || [];
      const recordResult = data.records || [];
      setSearchResults(results);

      const recordsLookupMap = aggregateRecordsByRecordId(recordResult);
      setRecordsMap(recordsLookupMap);
      // Ensure we have a safe way to aggregate citations
      const citations = aggregateCitationsByRecordId(results);
      setAggregatedCitations(citations);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
      setAggregatedCitations([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line
  }, [searchQuery, topK, filters, aggregateCitationsByRecordId]);

  useEffect(() => {
    // Only trigger search if there's a non-empty query
    if (searchQuery.trim()) {
      handleSearch();
    }
  }, [topK, filters, handleSearch, searchQuery]);

  const handleSearchQueryChange = (query: string): void => {
    setSearchQuery(query);
    if (!query.trim()) {
      setHasSearched(false);
    }
  };

  const handleTopKChange = (callback: (prevTopK: number) => number): void => {
    setTopK(callback);
  };

  const viewCitations = async (recordId: string, isDocPdf: boolean, isDocExcel: boolean) => {
    // Reset view states
    setIsPdf(false);
    setIsExcel(false);

    if (isDocPdf) {
      setIsPdf(true);
    } else if (isDocExcel) {
      setIsExcel(true);
    } else {
      return; // If neither PDF nor Excel, don't proceed
    }

    // Close sidebar when showing citation viewer
    setOpenSidebar(false);

    try {
      // Get the record ID from parameter or fallback
      const record = recordsMap[recordId];

      // If record doesn't exist, use fallback or show error
      if (!record) {
        console.error('Record not found for ID:', recordId);
        return;
      }
      // Find the correct citation from the aggregated data
      const citation = aggregatedCitations.find((item) => item.recordId === recordId);
      if (citation) {
        setRecordCitations(citation);
      }
      if (record.origin === ORIGIN.UPLOAD) {
        const fetchRecordId = record.externalRecordId || '';
        if (!fetchRecordId) {
          console.error('No external record ID available');
          return;
        }

        try {
          const response = await axios.get(`/api/v1/document/${fetchRecordId}/download`, {
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

          let filename = record.recordName || `document-${record.recordId}`;
          const contentDisposition = response.headers['content-disposition'];
          if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?([^"]*)"?/);
            if (filenameMatch && filenameMatch[1]) {
              filename = filenameMatch[1];
            }
          }

          try {
            // Try to parse as JSON to check for signedUrl property
            const jsonData = JSON.parse(text);
            if (jsonData && jsonData.signedUrl) {
              setFileUrl(jsonData.signedUrl);
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
          }
        } catch (error) {
          console.error('Error downloading document:', error);
          throw new Error('Failed to download document');
        }
      } else if (record.origin === ORIGIN.CONNECTOR) {
        try {

          const response = await axios.get(
            `${CONFIG.backendUrl}/api/v1/knowledgeBase/stream/record/${recordId}`,
            {
              responseType: 'blob',
            }
          );

          // Extract filename from content-disposition header
          let filename = record.recordName || `document-${recordId}`;
          const contentDisposition = response.headers['content-disposition'];
          if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?([^"]*)"?/);
            if (filenameMatch && filenameMatch[1]) {
              filename = filenameMatch[1];
            }
          }

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
        } catch (err) {
          console.error('Error downloading document:', err);
          throw new Error(`Failed to download document: ${err.message}`);
        }
      }
    } catch (error) {
      console.error('Error fetching document:', error);
    }
  };

  const toggleSidebar = () => {
    setOpenSidebar((prev) => !prev);
  };

  const handleCloseViewer = () => {
    setIsPdf(false);
    setIsExcel(false);
    setFileBuffer(null);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        overflow: 'hidden',
        bgcolor: alpha(theme.palette.background.default, 0.7),
        position: 'relative',
      }}
    >
      {/* Sidebar - Only displayed when citation viewer is not open */}
      <KnowledgeSearchSideBar
        sx={{
          height: '100%',
          zIndex: 100,
          flexShrink: 0,
          boxShadow: '0 0 10px rgba(0,0,0,0.05)',
        }}
        filters={filters}
        onFilterChange={handleFilterChange}
        openSidebar={openSidebar}
        onToggleSidebar={toggleSidebar}
      />

      {/* Main Content Area */}
      <Box
        sx={{
          maxHeight: '100vh',
          width: openSidebar
            ? `calc(100% - ${SIDEBAR_EXPANDED_WIDTH}px)`
            : `calc(100% - ${SIDEBAR_COLLAPSED_WIDTH}px)`,
          transition: theme.transitions.create('width', {
            duration: '0.3s',
            easing: theme.transitions.easing.easeInOut,
          }),
          display: 'flex',
          position: 'relative',
        }}
      >
        {/* Knowledge Search Component */}
        <Box
          sx={{
            width: isCitationViewerOpen ? '50%' : '100%',
            height: '100%',
            transition: theme.transitions.create('width', {
              duration: '0.3s',
              easing: theme.transitions.easing.easeInOut,
            }),
            overflow: 'auto',
            maxHeight: '100%',
          }}
        >
          <KnowledgeSearch
            searchResults={searchResults}
            loading={loading}
            onSearchQueryChange={handleSearchQueryChange}
            onTopKChange={handleTopKChange}
            onViewCitations={viewCitations}
            recordsMap={recordsMap}
          />
        </Box>
        <Divider orientation="vertical" flexItem sx={{ borderRightWidth: 3 }} />

        {/* PDF Viewer Container */}
        {(isPdf || fileBuffer) && !isExcel && (
          <Box
            sx={{
              width: '70%',
              // height: '100%',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <PdfHighlighterComp
              key="pdf-viewer"
              pdfUrl={fileUrl}
              pdfBuffer={fileBuffer || null}
              citations={recordCitations?.documents || []}
            />
          </Box>
        )}

        {/* Excel Viewer Container */}
        {(isExcel || fileBuffer) && !isPdf && (
          <Box
            sx={{
              width: '70%',
              height: '100%',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <ExcelViewer
              key="excel-viewer"
              fileUrl={fileUrl}
              citations={recordCitations?.documents || []}
              excelBuffer={fileBuffer}
            />
          </Box>
        )}

        {/* Close Button for document viewers */}
        {isCitationViewerOpen && (
          <StyledCloseButton
            onClick={handleCloseViewer}
            startIcon={<Icon icon="mdi:close" />}
            size="small"
          >
            Close
          </StyledCloseButton>
        )}
      </Box>
    </Box>
  );
}
