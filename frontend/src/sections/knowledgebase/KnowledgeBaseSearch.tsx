import { useState, useEffect, useCallback } from 'react';
import axios from 'src/utils/axios';
import { Box, Button, styled, useTheme, alpha, Divider } from '@mui/material';
import { Icon } from '@iconify/react';
import { searchKnowledgeBase } from './utils';
import KnowledgeSearch from './KnowledgeSearch';
import KnowledgeSearchSideBar from './KnowledgeSearchSideBar';
import ExcelViewer from '../qna/chatbot/components/excel-highlighter';
import PdfHighlighterComp from '../qna/chatbot/components/pdf-highlighter';

import type { Filters } from './types/knowledge-base';
import type {
  AggregatedDocument,
  DocumentContent,
  Record as RecordInterface,
  SearchResult,
} from './types/search-response';
import { ORIGIN } from './constants/knowledge-search';

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
  const [recordsMap, setRecordsMap] = useState<Record<string, RecordInterface>>({});

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
    (records: RecordInterface[]): Record<string, RecordInterface> =>
      records.reduce(
        (acc, record) => {
          // Use _key as the lookup key
          const recordKey = record._key || 'unknown';

          // Store the record in the accumulator with its _key as the key
          acc[recordKey] = record;

          return acc;
        },
        {} as Record<string, RecordInterface>
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
      if (record.origin === ORIGIN.UPLOAD) {
        const fetchRecordId = record.externalRecordId || '';
        if (!fetchRecordId) {
          console.error('No external record ID available');
          return;
        }
        const response = await axios.get(`/api/v1/document/${fetchRecordId}/download`);
        setFileUrl(response.data.signedUrl);

        // Find the correct citation from the aggregated data
        const citation = aggregatedCitations.find((item) => item.recordId === recordId);
        if (citation) {
          setRecordCitations(citation);
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
        {isPdf && (
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
              citations={recordCitations?.documents || []}
            />
          </Box>
        )}

        {/* Excel Viewer Container */}
        {isExcel && (
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
