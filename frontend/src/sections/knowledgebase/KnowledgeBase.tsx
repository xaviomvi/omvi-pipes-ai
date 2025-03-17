import debounce from 'lodash/debounce';
import { useMemo, useState, useEffect, useCallback } from 'react';

import { Box } from '@mui/material';

import { fetchKnowledgeBaseDetails } from './utils';
import KnowledgeBaseSideBar from './KnowledgeBaseSideBar';
import KnowledgeBaseDetails from './KnowledgeBaseDetails';

import type { Filters, KnowledgeBaseResponse } from './types/knowledge-base';

export default function KnowledgeBase() {
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
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
  });

  const debouncedFetchData = useCallback(
    (filter: Filters, searchQueryContent: string) => {
      setLoading(true);
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
            setLoading(false);
          });
      } catch (error) {
        console.error('Error preparing request:', error);
        setLoading(false);
      }
    },
    [pagination.page, pagination.limit, setLoading, setKnowledgeBaseData]
  );

  const debouncedFetch = useMemo(
    () => debounce((filter: Filters, query: string) => debouncedFetchData(filter, query), 300),
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
    setFilters(newFilters);
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page on filter change
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
        flexGrow: 1,
        overflow: 'hidden',
        zIndex: 0,
      }}
    >
      {/* Sidebar */}
      <KnowledgeBaseSideBar
        sx={{
          pt: 3,
          zIndex: 100,
          width: 300,
          flexShrink: 0,
        }}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      {/* Details Section */}
      <Box
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          p: 3,
        }}
      >
        <KnowledgeBaseDetails
          knowledgeBaseData={knowledgeBaseData}
          onSearchChange={handleSearchChange}
          loading={loading}
          pagination={pagination}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
        />
      </Box>
    </Box>
  );
}
