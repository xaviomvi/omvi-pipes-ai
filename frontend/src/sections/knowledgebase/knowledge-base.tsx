import debounce from 'lodash/debounce';
import { useMemo, useState, useEffect, useCallback, useRef } from 'react';

import { 
  Box, 
  alpha, 
  useTheme, 
  LinearProgress,
  CircularProgress,
  Fade
} from '@mui/material';

import { fetchKnowledgeBaseDetails } from './utils';
import KnowledgeBaseSideBar from './knowledge-base-sidebar';
import KnowledgeBaseDetails from './knowledge-base-details';

import type { Filters, KnowledgeBaseResponse } from './types/knowledge-base';

// Constants for sidebar widths - must match the ones in KnowledgeBaseSideBar
const SIDEBAR_EXPANDED_WIDTH = 320;
const SIDEBAR_COLLAPSED_WIDTH = 64;

export default function KnowledgeBase() {
  const theme = useTheme();
  const [filters, setFilters] = useState<Filters>({
    indexingStatus: [],
    department: [],
    moduleId: [],
    searchTags: [],
    appSpecificRecordType: [],
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [knowledgeBaseData, setKnowledgeBaseData] = useState<KnowledgeBaseResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  // Add a separate loading state for filter changes to prevent flickering
  const [filterLoading, setFilterLoading] = useState<boolean>(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
  });
  const [openSidebar, setOpenSidebar] = useState<boolean>(true);
  
  // Add a ref to track filter changes
  const isFilterChanging = useRef(false);
  // Add a ref to store previous filter state for comparison
  const prevFiltersRef = useRef(filters);

  const toggleSidebar = useCallback(() => {
    setOpenSidebar((prev) => !prev);
  }, []);

  const debouncedFetchData = useCallback(
    (filter: Filters, searchQueryContent: string) => {
      // Show different loading indicators based on what changed
      if (JSON.stringify(prevFiltersRef.current) !== JSON.stringify(filter)) {
        setFilterLoading(true);
      } else {
        setLoading(true);
      }
      
      // Update previous filters ref
      prevFiltersRef.current = filter;
      
      try {
        const queryParams = new URLSearchParams();

        // Handle all possible filter arrays
        Object.entries(filter).forEach(([key, value]) => {
          if (Array.isArray(value) && value.length > 0) {
            value.forEach((item) => queryParams.append(key, item));
          }
        });

        if (searchQueryContent) {
          queryParams.append('search', searchQueryContent);
        }

        queryParams.append('page', pagination.page.toString());
        queryParams.append('limit', pagination.limit.toString());

        fetchKnowledgeBaseDetails(queryParams)
          .then((data) => {
            setKnowledgeBaseData(data);
          })
          .catch((error) => {
            console.error('Error fetching knowledge base details:', error);
          })
          .finally(() => {
            // Use a brief delay before hiding loading indicators to prevent UI flickering
            setTimeout(() => {
              setLoading(false);
              setFilterLoading(false);
            }, 100);
          });
      } catch (error) {
        console.error('Error preparing request:', error);
        setLoading(false);
        setFilterLoading(false);
      }
    },
    [pagination.page, pagination.limit]
  );

  // Increase debounce time for smoother UI
  const debouncedFetch = useMemo(
    () => debounce((filter: Filters, query: string) => debouncedFetchData(filter, query), 400),
    [debouncedFetchData]
  );

  useEffect(() => {
    debouncedFetch(filters, searchQuery);

    // Clean up the debounced function on unmount
    return () => {
      debouncedFetch.cancel();
    };
  }, [filters, searchQuery, pagination, debouncedFetch]);

  const handleFilterChange = (newFilters: Filters): void => {
    // If a filter operation is already in progress, return
    if (isFilterChanging.current) return;
    
    isFilterChanging.current = true;
    
    // Use requestAnimationFrame to batch UI updates
    requestAnimationFrame(() => {
      setFilters(newFilters);
      setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page on filter change
      
      // Reset the flag after a short delay
      setTimeout(() => {
        isFilterChanging.current = false;
      }, 50);
    });
  };

  const handleSearchChange = (query: string): void => {
    setSearchQuery(query);
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page on search change
  };

  const handlePageChange = (newPage: number): void => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const handleLimitChange = (newLimit: number): void => {
    setPagination({ page: 1, limit: newLimit });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        position: 'relative',
        flexGrow: 1,
        overflow: 'hidden',
        zIndex: 0,
        bgcolor: alpha(theme.palette.background.default, 0.4),
      }}
    >
      {/* Sidebar */}
      <KnowledgeBaseSideBar
        sx={{
          zIndex: 100,
          position: 'relative',
        }}
        filters={filters}
        onFilterChange={handleFilterChange}
        openSidebar={openSidebar}
        onToggleSidebar={toggleSidebar}
      />

      {/* Filter Loading Indicator - Shows only when filters change */}
      {filterLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: openSidebar ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH,
            right: 0,
            zIndex: 1000,
          }}
        >
          <LinearProgress 
            color="primary" 
            sx={{ 
              height: 3,
              bgcolor: 'transparent',
              '& .MuiLinearProgress-bar': {
                transition: theme.transitions.create(['transform'], {
                  easing: theme.transitions.easing.easeInOut,
                  duration: '0.3s',
                }),
              }
            }} 
          />
        </Box>
      )}

      {/* Details Section */}
      <Box
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          width: `calc(100% - ${openSidebar ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH}px)`,
          transition: theme.transitions.create(['width'], { // Removed 'margin-left' for better performance
            easing: theme.transitions.easing.sharp, // Changed from easeInOut to sharp
            duration: '0.25s', // Reduced from 0.3s
          }),
          marginLeft: 0,
          px: 3,
          py: 2.5,
          position: 'relative', // Added for the content loading overlay
        }}
      >
        {/* Content Loading Overlay - Only shows when filters change */}
        <Fade in={filterLoading} timeout={150}>
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: alpha(theme.palette.background.paper, 0.6),
              zIndex: 10,
              backdropFilter: 'blur(1px)', // Slight blur for better UX
            }}
          >
            <CircularProgress size={40} />
          </Box>
        </Fade>
        
        <KnowledgeBaseDetails
          knowledgeBaseData={knowledgeBaseData}
          onSearchChange={handleSearchChange}
          loading={loading && !filterLoading} // Only show regular loading when not filter loading
          pagination={pagination}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
        />
      </Box>
    </Box>
  );
}