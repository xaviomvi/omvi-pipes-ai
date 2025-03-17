// import React, { useState, useEffect, useRef, useCallback } from 'react';
// import {
//   Box,
//   TextField,
//   IconButton,
//   Tab,
//   Tabs,
//   Card,
//   CardContent,
//   Typography,
//   Paper,
//   Chip,
//   CircularProgress,
//   Collapse,
//   IconButton as MuiIconButton,
//   Avatar,
// } from '@mui/material';
// import { Icon } from '@iconify/react';
// import { useNavigate } from 'react-router';
// import { searchKnowledgeBase } from './utils';
// import { useUsers } from '../workflow/context/UserContext';

// const KnowledgeSearch = () => {
//   const [searchQuery, setSearchQuery] = useState('');
//   const [activeTab, setActiveTab] = useState(0);
//   const [searchResults, setSearchResults] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [selectedRecord, setSelectedRecord] = useState(null);
//   const [detailsOpen, setDetailsOpen] = useState(false);
//   const [topK, setTopK] = useState(10);
//   const [results, setResults] = useState({ records: [], fileRecords: [] }); // Added state for full results
//   const navigate = useNavigate();
//   const observer = useRef();
//   const users = useUsers();
//   console.log(users, 'users');

//   const lastResultElementRef = useCallback(
//     (node) => {
//       if (loading) return;
//       if (observer.current) observer.current.disconnect();
//       observer.current = new IntersectionObserver((entries) => {
//         if (entries[0].isIntersecting) {
//           setTopK((prevTopK) => prevTopK + 10);
//         }
//       });
//       if (node) observer.current.observe(node);
//     },
//     [loading]
//   );

//   const handleSearch = async () => {
//     setLoading(true);
//     try {
//       const data = await searchKnowledgeBase(searchQuery, topK);
//       setResults(data); // Update results state
//       setSearchResults(
//         Object.values(data).filter((item) => item.content && typeof item.content === 'string')
//       );
//     } catch (error) {
//       console.error('Search failed:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     handleSearch();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [topK]);

//   const handleRecordClick = (record) => {
//     const fullRecord = searchResults.find((r) => r.id === record.id);
//     setSelectedRecord(fullRecord);
//     setDetailsOpen(true);
//   };

//   const getRecordDetails = (recordId) => {
//     const record = searchResults.find((r) => r.recordId === recordId);
//     if (!record) return null;

//     const fullRecord = results.records.find((r) => r._id === recordId);
//     const fileRecord = results.fileRecords.find((fr) => fr._id === record.fileRecordId);

//     return {
//       modules: fullRecord?.modules || [],
//       searchTags: fullRecord?.searchTags || [],
//       version: fullRecord?.version,
//       uploadedBy: fileRecord?.uploadedBy,
//     };
//   };

//   const highlightText = (text, query) => {
//     if (!query) return text;
//     const parts = text.split(new RegExp(`(${query})`, 'gi'));
//     return parts.map((part, index) =>
//       part.toLowerCase() === query.toLowerCase() ? (
//         <mark key={index} style={{ backgroundColor: '#ffeb3b' }}>
//           {part}
//         </mark>
//       ) : (
//         part
//       )
//     );
//   };

//   return (
//     <Box sx={{ height: '100vh', bgcolor: 'background.default', p: 3 }}>
//       <Typography sx={{ ml: 3 }} variant="h5">
//         Knowledge Search
//       </Typography>

//       <Paper sx={{ p: 2, mb: 3 }}>
//         <Box sx={{ display: 'flex', gap: 2 }}>
//           <TextField
//             fullWidth
//             value={searchQuery}
//             onChange={(e) => setSearchQuery(e.target.value)}
//             placeholder="Search knowledge base..."
//             variant="outlined"
//             size="small"
//             onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
//           />
//           <IconButton onClick={handleSearch} color="primary">
//             <Icon icon="mdi:magnify" />
//           </IconButton>
//         </Box>

//         {searchResults.length > 0 && (
//           <Tabs
//             value={activeTab}
//             onChange={(e, newValue) => setActiveTab(newValue)}
//             sx={{ mt: 2, borderBottom: 1, borderColor: 'divider' }}
//           >
//             <Tab label="Documents" />
//             <Tab label="FAQs" />
//           </Tabs>
//         )}
//       </Paper>

//       <Box sx={{ display: 'flex', gap: 2, height: 'calc(100vh - 180px)', maxWidth: '100%' }}>
//         <Box
//           sx={{
//             width: detailsOpen ? '50%' : '100%',
//             overflow: 'auto',
//             transition: 'width 0.3s ease',
//           }}
//         >
//           {searchResults.map((result, index) => (
//             <Card
//               key={result.id}
//               ref={index === searchResults.length - 1 ? lastResultElementRef : null}
//               sx={{
//                 mb: 2,
//                 width: '100%',
//                 cursor: 'pointer',
//                 bgcolor: selectedRecord?.id === result.id ? 'action.selected' : 'background.paper',
//               }}
//               onClick={() => handleRecordClick(result)}
//             >
//               <CardContent>
//                 <Typography>{highlightText(result.content, searchQuery)}</Typography>
//                 <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
//                   {result.categories?.map((cat) => (
//                     <Chip
//                       key={cat.category}
//                       label={cat.category}
//                       size="small"
//                       color="primary"
//                       variant="outlined"
//                     />
//                   ))}
//                   {result.departments?.map((dept) => (
//                     <Chip
//                       key={dept}
//                       label={dept}
//                       size="small"
//                       color="secondary"
//                       variant="outlined"
//                     />
//                   ))}
//                 </Box>
//               </CardContent>
//             </Card>
//           ))}
//           {loading && (
//             <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
//               <CircularProgress />
//             </Box>
//           )}
//         </Box>

//         <Collapse in={detailsOpen} orientation="horizontal" sx={{ flex: 1 }}>
//           <Paper sx={{ p: 3, height: '100%', overflow: 'auto' }}>
//             {selectedRecord && (
//               <>
//                 <Box sx={{ display: 'flex', mb: 2, gap: 2 }}>
//                   <Typography variant="h6">Record Details</Typography>
//                   <MuiIconButton
//                     onClick={() => navigate(`/knowledge-base/records/${selectedRecord?.recordId}`)}
//                     size="small"
//                   >
//                     <Icon icon="mdi:open-in-new" />
//                   </MuiIconButton>
//                   <MuiIconButton onClick={() => setDetailsOpen(false)} size="small">
//                     <Icon icon="mdi:chevron-right" />
//                   </MuiIconButton>
//                 </Box>

//                 <Typography variant="body1" paragraph>
//                   {selectedRecord.content}
//                 </Typography>

//                 <Box sx={{ mt: 4 }}>
//                   <Typography variant="subtitle2" color="text.secondary" gutterBottom>
//                     Last Updated:
//                   </Typography>
//                   <Typography variant="body2">{new Date().toLocaleDateString()}</Typography>

//                   <Typography
//                     variant="subtitle2"
//                     color="text.secondary"
//                     sx={{ mt: 2 }}
//                     gutterBottom
//                   >
//                     Categories:
//                   </Typography>
//                   <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
//                     {selectedRecord.categories?.map((cat) => (
//                       <Chip key={cat.category} label={cat.category} size="small" />
//                     ))}
//                   </Box>

//                   {selectedRecord.departments && (
//                     <>
//                       <Typography
//                         variant="subtitle2"
//                         color="text.secondary"
//                         sx={{ mt: 2 }}
//                         gutterBottom
//                       >
//                         Departments:
//                       </Typography>
//                       <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
//                         {selectedRecord.departments?.map((dept) => (
//                           <Chip key={dept} label={dept} size="small" />
//                         ))}
//                       </Box>
//                     </>
//                   )}

//                   {selectedRecord.recordId && (
//                     <>
//                       {getRecordDetails(selectedRecord.recordId)?.modules?.length > 0 && (
//                         <>
//                           <Typography
//                             variant="subtitle2"
//                             color="text.secondary"
//                             sx={{ mt: 2 }}
//                             gutterBottom
//                           >
//                             Modules:
//                           </Typography>
//                           <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
//                             {getRecordDetails(selectedRecord.recordId)?.modules?.map((module) => (
//                               <Chip key={module._id} label={module.name} size="small" />
//                             ))}
//                           </Box>
//                         </>
//                       )}

//                       {getRecordDetails(selectedRecord.recordId).searchTags.length > 0 && (
//                         <>
//                           <Typography
//                             variant="subtitle2"
//                             color="text.secondary"
//                             sx={{ mt: 2 }}
//                             gutterBottom
//                           >
//                             Search Tags:
//                           </Typography>
//                           <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
//                             {getRecordDetails(selectedRecord.recordId)?.searchTags?.map((tag) => (
//                               <Chip key={tag._id} label={tag.name} size="small" />
//                             ))}
//                           </Box>
//                         </>
//                       )}

//                       <Typography
//                         variant="subtitle2"
//                         color="text.secondary"
//                         sx={{ mt: 2 }}
//                         gutterBottom
//                       >
//                         Version:
//                       </Typography>
//                       <Typography variant="body2">
//                         {getRecordDetails(selectedRecord.recordId)?.version}
//                       </Typography>

//                       {/* <Typography
//                         variant="subtitle2"
//                         color="text.secondary"
//                         sx={{ mt: 2 }}
//                         gutterBottom
//                       >
//                         Uploaded By:
//                       </Typography>
//                       <Typography variant="body2">
//                         {getRecordDetails(selectedRecord.recordId)?.uploadedBy || 'N/A'}
//                       </Typography> */}
//                       <Typography
//                         variant="subtitle2"
//                         color="text.secondary"
//                         sx={{ mt: 2 }}
//                         gutterBottom
//                       >
//                         Uploaded By:
//                       </Typography>
//                       <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
//                         {(() => {
//                           const uploadedById = getRecordDetails(
//                             selectedRecord.recordId
//                           )?.uploadedBy;
//                           const user = users.find((u) => u._id === uploadedById);
//                           if (user) {
//                             return (
//                               <>
//                                 <Avatar sx={{ width: 24, height: 24 }}>
//                                   {user.fullName.charAt(0)}
//                                 </Avatar>
//                                 <Typography variant="body2">{user.fullName}</Typography>
//                               </>
//                             );
//                           }
//                           return <Typography variant="body2">N/A</Typography>;
//                         })()}
//                       </Box>
//                     </>
//                   )}
//                 </Box>
//               </>
//             )}
//           </Paper>
//         </Collapse>
//       </Box>
//     </Box>
//   );
// };

// export default KnowledgeSearch;

import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router';
import React, { useRef, useState, useCallback } from 'react';

import {
  Box,
  Tab,
  Tabs,
  Card,
  Chip,
  Paper,
  Avatar,
  Collapse,
  TextField,
  IconButton,
  Typography,
  CardContent,
  CircularProgress,
  IconButton as MuiIconButton,
} from '@mui/material';

import { useUsers } from 'src/context/UserContext';

import type {
  Record,
  FileRecord,
  SearchResult,
  KnowledgeSearchProps,
} from './types/search-response';

interface RecordDetails {
  modules: Array<{ _id: string; name: string }>;
  searchTags: Array<{ _id: string; name: string }>;
  version?: string;
  uploadedBy?: string;
}

const KnowledgeSearch = ({
  searchResults,
  loading,
  onSearchQueryChange,
  onTopKChange,
}: KnowledgeSearchProps) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<number>(0);
  const [selectedRecord, setSelectedRecord] = useState<SearchResult | null>(null);
  const [detailsOpen, setDetailsOpen] = useState<boolean>(false);
  const navigate = useNavigate();
  const observer = useRef<IntersectionObserver | null>(null);
  const users = useUsers();

  const lastResultElementRef = useCallback(
    (node: Element | null) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          onTopKChange((prevTopK: number) => prevTopK + 10);
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, onTopKChange]
  );

  const handleSearch = () => {
    onSearchQueryChange(searchQuery);
  };

  const handleRecordClick = (record: SearchResult): void => {
    const fullRecord = searchResults.find((r) => r.id === record.id);
    setSelectedRecord(fullRecord || null);
    setDetailsOpen(true);
  };

  const getRecordDetails = (recordId: string): RecordDetails | null => {
    const record = searchResults.find((r) => r.recordId === recordId);
    if (!record) return null;

    const fullRecord = searchResults?.records?.find((r: Record) => r._id === recordId);
    const fileRecord = searchResults?.fileRecords?.find(
      (fr: FileRecord) => fr._id === record.fileRecordId
    );

    return {
      modules: fullRecord?.modules || [],
      searchTags: fullRecord?.searchTags || [],
      version: fullRecord?.version,
      uploadedBy: fileRecord?.uploadedBy,
    };
  };

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} style={{ backgroundColor: '#ffeb3b' }}>
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const renderUploadedBy = (recordId: string): React.ReactNode => {
    const details = getRecordDetails(recordId);
    if (!details) return <Typography variant="body2">N/A</Typography>;

    const uploadedById = details.uploadedBy;
    const user = users.find((u) => u._id === uploadedById);

    if (!user) return <Typography variant="body2">N/A</Typography>;

    return (
      <>
        <Avatar sx={{ width: 24, height: 24 }}>{user.fullName.charAt(0)}</Avatar>
        <Typography variant="body2">{user.fullName}</Typography>
      </>
    );
  };

  const renderRecordDetails = (): React.ReactNode => {
    if (!selectedRecord?.recordId) return null;

    const details = getRecordDetails(selectedRecord.recordId);
    if (!details) return null;

    return (
      <>
        {details.modules.length > 0 && (
          <>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }} gutterBottom>
              Modules:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {details.modules.map((module) => (
                <Chip key={module._id} label={module.name} size="small" />
              ))}
            </Box>
          </>
        )}

        {details.searchTags.length > 0 && (
          <>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }} gutterBottom>
              Search Tags:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {details.searchTags.map((tag) => (
                <Chip key={tag._id} label={tag.name} size="small" />
              ))}
            </Box>
          </>
        )}

        <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }} gutterBottom>
          Version:
        </Typography>
        <Typography variant="body2">{details.version}</Typography>

        <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }} gutterBottom>
          Uploaded By:
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {renderUploadedBy(selectedRecord.recordId)}
        </Box>
      </>
    );
  };

  return (
    <Box sx={{ height: '100vh', bgcolor: 'background.default', p: 3 }}>
      <Typography sx={{ ml: 3 }} variant="h5">
        Knowledge Search
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            fullWidth
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search knowledge base..."
            variant="outlined"
            size="small"
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <IconButton onClick={handleSearch} color="primary">
            <Icon icon="mdi:magnify" />
          </IconButton>
        </Box>

        {searchResults.length > 0 && (
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            sx={{ mt: 2, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Documents" />
            <Tab label="FAQs" />
          </Tabs>
        )}
      </Paper>

      <Box sx={{ display: 'flex', gap: 2, height: 'calc(100vh - 180px)', maxWidth: '100%' }}>
        <Box
          sx={{
            width: detailsOpen ? '50%' : '100%',
            overflow: 'auto',
            transition: 'width 0.3s ease',
          }}
        >
          {searchResults.map((result, index) => (
            <Card
              key={result.id}
              ref={index === searchResults.length - 1 ? lastResultElementRef : null}
              sx={{
                mb: 2,
                width: '100%',
                cursor: 'pointer',
                bgcolor: selectedRecord?.id === result.id ? 'action.selected' : 'background.paper',
              }}
              onClick={() => handleRecordClick(result)}
            >
              <CardContent>
                <Typography>{highlightText(result.content, searchQuery)}</Typography>
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  {result.categories?.map((cat) => (
                    <Chip
                      key={cat.category}
                      label={cat.category}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                  {result.departments?.map((dept) => (
                    <Chip
                      key={dept}
                      label={dept}
                      size="small"
                      color="secondary"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          ))}
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          )}
        </Box>

        <Collapse in={detailsOpen} orientation="horizontal" sx={{ flex: 1 }}>
          <Paper sx={{ p: 3, height: '100%', overflow: 'auto' }}>
            {selectedRecord && (
              <>
                <Box sx={{ display: 'flex', mb: 2, gap: 2 }}>
                  <Typography variant="h6">Record Details</Typography>
                  <MuiIconButton
                    onClick={() => navigate(`/knowledge-base/records/${selectedRecord?.recordId}`)}
                    size="small"
                  >
                    <Icon icon="mdi:open-in-new" />
                  </MuiIconButton>
                  <MuiIconButton onClick={() => setDetailsOpen(false)} size="small">
                    <Icon icon="mdi:chevron-right" />
                  </MuiIconButton>
                </Box>

                <Typography variant="body1" paragraph>
                  {selectedRecord.content}
                </Typography>

                <Box sx={{ mt: 4 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Last Updated:
                  </Typography>
                  <Typography variant="body2">{new Date().toLocaleDateString()}</Typography>

                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    sx={{ mt: 2 }}
                    gutterBottom
                  >
                    Categories:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {selectedRecord.categories?.map((cat) => (
                      <Chip key={cat.category} label={cat.category} size="small" />
                    ))}
                  </Box>

                  {selectedRecord.departments && (
                    <>
                      <Typography
                        variant="subtitle2"
                        color="text.secondary"
                        sx={{ mt: 2 }}
                        gutterBottom
                      >
                        Departments:
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {selectedRecord.departments?.map((dept) => (
                          <Chip key={dept} label={dept} size="small" />
                        ))}
                      </Box>
                    </>
                  )}

                  {selectedRecord.recordId &&
                    (() => {
                      const details = getRecordDetails(selectedRecord.recordId);

                      // Early return if no details
                      if (!details) return null;

                      return (
                        <>
                          {details.modules && details.modules.length > 0 && (
                            <>
                              <Typography
                                variant="subtitle2"
                                color="text.secondary"
                                sx={{ mt: 2 }}
                                gutterBottom
                              >
                                Modules:
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                {details.modules.map((module) => (
                                  <Chip key={module._id} label={module.name} size="small" />
                                ))}
                              </Box>
                            </>
                          )}

                          {details.searchTags && details.searchTags.length > 0 && (
                            <>
                              <Typography
                                variant="subtitle2"
                                color="text.secondary"
                                sx={{ mt: 2 }}
                                gutterBottom
                              >
                                Search Tags:
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                {details.searchTags.map((tag) => (
                                  <Chip key={tag._id} label={tag.name} size="small" />
                                ))}
                              </Box>
                            </>
                          )}

                          <Typography
                            variant="subtitle2"
                            color="text.secondary"
                            sx={{ mt: 2 }}
                            gutterBottom
                          >
                            Version:
                          </Typography>
                          <Typography variant="body2">{details.version}</Typography>

                          <Typography
                            variant="subtitle2"
                            color="text.secondary"
                            sx={{ mt: 2 }}
                            gutterBottom
                          >
                            Uploaded By:
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {(() => {
                              const uploadedById = details.uploadedBy;
                              const user = users.find((u) => u._id === uploadedById);
                              if (user) {
                                return (
                                  <>
                                    <Avatar sx={{ width: 24, height: 24 }}>
                                      {user.fullName.charAt(0)}
                                    </Avatar>
                                    <Typography variant="body2">{user.fullName}</Typography>
                                  </>
                                );
                              }
                              return <Typography variant="body2">N/A</Typography>;
                            })()}
                          </Box>
                        </>
                      );
                    })()}
                </Box>
              </> 
            )}     
          </Paper>
        </Collapse>
      </Box>
    </Box>
  );
};

export default KnowledgeSearch;
