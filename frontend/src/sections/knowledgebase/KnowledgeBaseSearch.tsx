import { useState, useEffect, useCallback } from 'react';

import { Box } from '@mui/material';

import { searchKnowledgeBase } from './utils';
import KnowledgeSearch from './KnowledgeSearch';
import KnowledgeSearchSideBar from './KnowledgeSearchSideBar';

import type { Filters } from './types/knowledge-base';
import type { SearchResult } from './types/search-response';





export default function KnowledgeBaseSearch() {
  const [filters, setFilters] = useState<Filters>({
    department: [],
    moduleId: [],
    appSpecificRecordType: [],
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [topK, setTopK] = useState<number>(10);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const handleFilterChange = (newFilters: Filters) => {
    setFilters(newFilters);
  };

  const handleSearch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await searchKnowledgeBase(searchQuery, topK, filters);

      const results = Object.entries(data)
      .filter(([key]) => !['records', 'fileRecords', 'meta'].includes(key))
      .map(([_, value]) => value)
      .filter((item): item is SearchResult => item?.content && typeof item.content === 'string');

    setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, topK, filters]);

  useEffect(() => {
    handleSearch();
  }, [handleSearch]);

  const handleSearchQueryChange = (query: string): void => {
    setSearchQuery(query);
  };

  const handleTopKChange = (callback: (prevTopK: number) => number): void => {
    setTopK(callback);
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
      <KnowledgeSearchSideBar
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
        <KnowledgeSearch
          searchResults={searchResults}
          loading={loading}
          onSearchQueryChange={handleSearchQueryChange}
          onTopKChange={handleTopKChange}
        />
      </Box>
    </Box>
  );
}
