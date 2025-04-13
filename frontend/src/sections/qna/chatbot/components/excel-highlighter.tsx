import type { BoxProps } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import type { CustomCitation } from 'src/types/chat-bot';
import type { DocumentContent } from 'src/sections/knowledgebase/types/search-response';

import * as XLSX from 'xlsx';
import { Icon } from '@iconify/react';
import fullScreenIcon from '@iconify-icons/mdi/fullscreen';
import fullScreenExitIcon from '@iconify-icons/mdi/fullscreen-exit';
import React, { useRef, useState, useEffect, useCallback } from 'react';

import {
  Box,
  List,
  Table,
  Alert,
  styled,
  Tooltip,
  TableRow,
  ListItem,
  TableBody,
  TableCell,
  TableHead,
  Typography,
  IconButton,
  TableContainer,
  CircularProgress,
} from '@mui/material';

import scrollableContainerStyle from '../../utils/styles/scrollbar';

type ExcelViewerprops = {
  citations: DocumentContent[] | CustomCitation[];
  fileUrl: string | null;
  excelBuffer?: ArrayBuffer | null;
};

interface StyleProps {
  theme?: Theme;
  highlighted?: boolean;
  show?: boolean;
}

interface TableRowType {
  [key: string]: React.ReactNode;
}

interface RichTextStyle {
  fontWeight?: 'bold';
  fontStyle?: 'italic';
  textDecoration?: 'underline' | 'line-through';
  color?: string;
}

interface RichTextFragment {
  t: string;
  s?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strike?: boolean;
    color?: {
      rgb: string;
    };
  };
}

interface CellData {
  r?: RichTextFragment[];
  w?: string;
  v?: string | number;
  s?: any;
}

// Styled components for the table
const StyledTableCell = styled(TableCell, {
  shouldForwardProp: (prop) => prop !== 'highlighted',
})<StyleProps>(({ theme, highlighted }) => ({
  backgroundColor: highlighted ? 'rgba(46, 125, 50, 0.1)' : 'inherit',
  minWidth: '100px',
  maxWidth: '400px',
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  verticalAlign: 'top',
  lineHeight: '1.5',
  fontSize: '14px',
  '& p': {
    margin: 0,
  },
  '& .rich-text-container span': {
    display: 'inline',
  },
  transition: 'background-color 0.2s ease',
  '&:hover': {
    backgroundColor: highlighted ? 'rgba(46, 125, 50, 0.2)' : theme.palette.action.hover,
  },
}));

const HeaderRowNumberCell = styled(TableCell)(({ theme }) => ({
  backgroundColor: theme.palette.grey[100],
  minWidth: '60px',
  maxWidth: '80px',
  padding: theme.spacing(2),
  borderBottom: `2px solid ${theme.palette.divider}`,
  position: 'sticky',
  left: 0,
  top: 0,
  zIndex: 3,
  textAlign: 'center',
  fontWeight: 600,
}));
const RowNumberCell = styled(TableCell)(({ theme }) => ({
  backgroundColor: theme.palette.grey[50],
  minWidth: '60px',
  maxWidth: '80px',
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  position: 'sticky',
  left: 0,
  zIndex: 2,
  textAlign: 'center',
  fontWeight: 500,
}));

const StyledTableRow = styled(TableRow, {
  shouldForwardProp: (prop) => prop !== 'highlighted',
})<StyleProps>(({ theme, highlighted }) => ({
  backgroundColor: highlighted ? 'rgba(46, 125, 50, 0.1)' : 'inherit',
  transition: 'background-color 0.2s ease',
  '&:hover': {
    backgroundColor: highlighted ? 'rgba(46, 125, 50, 0.2)' : theme.palette.action.hover,
  },
}));

const HeaderCell = styled(TableCell)(({ theme }) => ({
  fontWeight: 600,
  backgroundColor: theme.palette.background.paper,
  borderBottom: `2px solid ${theme.palette.divider}`,
  padding: theme.spacing(2),
  position: 'sticky',
  top: 0,
  zIndex: 2,
  minWidth: '250px',
  maxWidth: '400px',
  fontSize: '14px',
}));

const StyledSidebar = (props: BoxProps) => (
  <Box
    {...props}
    sx={{
      borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: (theme) => theme.palette.background.paper,
      overflow: 'auto',
      width: '300px',
      flexShrink: 0,
      ...scrollableContainerStyle,
    }}
  />
);

const ViewerContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  height: '100%',
  width: '100%',
  overflow: 'hidden',
  backgroundColor: theme.palette.background.paper, // Add explicit background color
  '&:fullscreen': {
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(2),
  },
}));

const MainContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  // overflow: 'auto',
  backgroundColor: theme.palette.background.paper,
  '& .MuiTableContainer-root': {
    overflow: 'visible',
  },
  '& table': {
    width: 'max-content',
    maxWidth: 'none',
    backgroundColor: theme.palette.background.paper,
  },
}));

const ControlsContainer = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(4),
  right: theme.spacing(4),
  zIndex: 1000,
}));

const ExcelViewer = ({ citations, fileUrl, excelBuffer }: ExcelViewerprops) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tableData, setTableData] = useState<TableRowType[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [highlightedRow, setHighlightedRow] = useState<number | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const processingRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleFullscreenChange = useCallback((): void => {
    setIsFullscreen(!!document.fullscreenElement);
  }, []);

  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [handleFullscreenChange]);

  const toggleFullscreen = useCallback(async (): Promise<void> => {
    try {
      if (!document.fullscreenElement && containerRef.current) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
    }
  }, []);

  const scrollToRow = useCallback((num: number): void => {
    if (!tableRef.current || !mountedRef.current) return;
    const tableRows = tableRef.current.getElementsByTagName('tr');
    if (tableRows[num]) {
      requestAnimationFrame(() => {
        if (!mountedRef.current) return;

        tableRows[num].scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });

        tableRows[num].style.transition = 'background-color 0.5s ease';
        tableRows[num].style.backgroundColor = 'rgba(46, 125, 50, 0.2)';
      });
    }
  }, []);

  const handleCitationClick = useCallback(
    (citation: DocumentContent): void => {
      if (!mountedRef.current) return;
      const { blockNum } = citation.metadata;
      if (blockNum[0]) {
        setSelectedCitation(citation.metadata._id);
        setHighlightedRow(blockNum[0]);
        scrollToRow(blockNum[0]);
      }
    },
    [scrollToRow]
  );

  const processRichText = (cell: CellData): React.ReactNode => {
    if (!cell) return '';

    if (cell.r && Array.isArray(cell.r)) {
      return (
        <div className="rich-text-container">
          {cell.r.map((fragment: RichTextFragment, index: number) => {
            const styles: RichTextStyle = {};
            if (fragment.s) {
              if (fragment.s.bold) styles.fontWeight = 'bold';
              if (fragment.s.italic) styles.fontStyle = 'italic';
              if (fragment.s.underline) styles.textDecoration = 'underline';
              if (fragment.s.strike) styles.textDecoration = 'line-through';
              if (fragment.s.color?.rgb) styles.color = `#${fragment.s.color.rgb}`;
            }
            return (
              <span key={index} style={styles}>
                {fragment.t}
              </span>
            );
          })}
        </div>
      );
    }

    return cell.w || cell.v || '';
  };

  const processExcelData = useCallback(async (workbook: XLSX.WorkBook): Promise<void> => {
    if (processingRef.current || !mountedRef.current) return;
    processingRef.current = true;

    try {
      const firstSheet = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheet];
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

      // Get hidden rows
      const hiddenRows = new Set();
      if (worksheet['!rows']) {
        worksheet['!rows'].forEach((row, index) => {
          if (row?.hidden) hiddenRows.add(index);
        });
      }

      const newHeaders = Array.from({ length: range.e.c - range.s.c + 1 }, (_, colIndex) => {
        const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: colIndex + range.s.c });
        const cell = worksheet[cellAddress] as CellData;
        return processRichText(cell)?.toString() || `Column${colIndex + 1}`;
      });

      // Process data rows
      const newData = Array.from({ length: range.e.r - range.s.r }, (_, rowIndex) => {
        if (hiddenRows.has(rowIndex + range.s.r + 1)) return null;

        const rowData: Record<string, React.ReactNode> = {};
        newHeaders.forEach((header, colIndex) => {
          const cellAddress = XLSX.utils.encode_cell({
            r: rowIndex + range.s.r + 1,
            c: colIndex + range.s.c,
          });
          const cell = worksheet[cellAddress] as CellData;
          rowData[header] = processRichText(cell);
        });

        return rowData;
      }).filter(Boolean) as TableRowType[];

      if (mountedRef.current) {
        setHeaders(newHeaders);
        setTableData(newData);
        setIsInitialized(true);
      }
    } catch (err) {
      if (mountedRef.current) {
        throw new Error(`Error processing Excel data: ${err.message}`);
      }
    } finally {
      processingRef.current = false;
    }
  }, []);

  const loadExcelFile = useCallback(async (): Promise<void> => {
    if (!fileUrl && !excelBuffer) return;

    try {
      setLoading(true);
      setError(null);

      let workbook: XLSX.WorkBook;

      if (excelBuffer) {
        // Use buffer directly if available - prevent detached buffer issues
        try {
          // Create a copy of the buffer to prevent detachment issues
          const bufferCopy = excelBuffer.slice(0);

          workbook = XLSX.read(new Uint8Array(bufferCopy), {
            type: 'array',
            cellFormula: true,
            cellHTML: true,
            cellStyles: true,
            cellText: true,
            cellDates: true,
            cellNF: true,
            sheetStubs: true,
            WTF: false,
          });
        } catch (bufferErr) {
          console.error('Error reading from buffer:', bufferErr);
          throw new Error(`Failed to read Excel data from buffer: ${bufferErr.message}`);
        }
      } else if (fileUrl) {
        // Fall back to URL loading
        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        if (!mountedRef.current) return;

        workbook = XLSX.read(arrayBuffer, {
          type: 'array',
          cellFormula: true,
          cellHTML: true,
          cellStyles: true,
          cellText: true,
          cellDates: true,
          cellNF: true,
          sheetStubs: true,
          WTF: false,
        });
      } else {
        throw new Error('No data source provided');
      }

      if (!mountedRef.current) return;
      await processExcelData(workbook);
    } catch (err) {
      if (mountedRef.current) {
        setError(`Error loading Excel file: ${err.message}`);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [fileUrl, excelBuffer, processExcelData]);

  // Handle initial load and cleanup
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Handle file URL or buffer changes
  useEffect(() => {
    setTableData([]);
    setHeaders([]);
    setHighlightedRow(null);
    setSelectedCitation(null);
    setError(null);
    setIsInitialized(false);
    loadExcelFile();
  }, [fileUrl, excelBuffer, loadExcelFile]);

  // Handle initial citation highlight
  useEffect(() => {
    if (isInitialized && citations.length > 0 && !highlightedRow && mountedRef.current) {
      const firstCitation = citations[0];
      const { blockNum } = firstCitation.metadata;
      if (blockNum[0]) {
        setHighlightedRow(blockNum[0]);
        setSelectedCitation(firstCitation.metadata._id);
        scrollToRow(blockNum[0]);
      }
    }
  }, [citations, isInitialized, highlightedRow, scrollToRow]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        height: '100%',
        backgroundColor: 'background.paper',
        '&:fullscreen': {
          backgroundColor: 'background.paper',
          padding: 2,
        },
      }}
    >
      {/* Rest of the component remains the same */}
      <ControlsContainer>
        <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}>
          <IconButton
            onClick={toggleFullscreen}
            size="large"
            sx={{
              backgroundColor: 'background.paper',
              boxShadow: 2,
              '&:hover': {
                backgroundColor: 'background.paper',
                opacity: 0.9,
              },
              mt: 2,
            }}
          >
            <Icon
              icon={isFullscreen ? fullScreenExitIcon : fullScreenIcon}
              width="24"
              height="24"
            />
          </IconButton>
        </Tooltip>
      </ControlsContainer>

      <ViewerContainer>
        <Box sx={{ maxHeight: '100%', overflow: 'auto' }}>
          <MainContainer>
            <TableContainer ref={tableRef} sx={{ overflow: 'auto' }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <HeaderRowNumberCell>#</HeaderRowNumberCell>
                    {headers.map((header, index) => (
                      <HeaderCell key={index}>
                        <Tooltip
                          title={typeof header === 'string' ? header : ''}
                          arrow
                          placement="top"
                        >
                          <Typography noWrap>{header}</Typography>
                        </Tooltip>
                      </HeaderCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tableData.map((row, rowIndex) => (
                    <StyledTableRow key={rowIndex} highlighted={highlightedRow === rowIndex + 1}>
                      <RowNumberCell>{rowIndex + 1}</RowNumberCell>
                      {headers.map((header, colIndex) => (
                        <StyledTableCell
                          key={colIndex}
                          highlighted={highlightedRow === rowIndex + 1}
                        >
                          {row[header]}
                        </StyledTableCell>
                      ))}
                    </StyledTableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </MainContainer>
        </Box>

        <StyledSidebar>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6">Citations</Typography>
          </Box>
          <List sx={{ flex: 1, overflow: 'auto', px: 2 }}>
            {citations.map((citation, index) => (
              <ListItem
                key={citation.metadata._id || index}
                onClick={() => handleCitationClick(citation)}
                sx={{
                  cursor: 'pointer',
                  position: 'relative',
                  px: 2,
                  py: 1.5,
                  mb: 1,
                  borderRadius: 1,
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                  ...(selectedCitation === citation.metadata._id && {
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      border: '2px solid #2e7d32',
                      borderRadius: 1,
                      pointerEvents: 'none',
                    },
                  }),
                }}
              >
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Citation {index + 1}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {citation.content}
                  </Typography>
                  <Typography variant="caption" color="primary" sx={{ mt: 1, display: 'block' }}>
                     {citation.metadata.sheetName}
                  </Typography>
                  <Typography variant="caption" color="primary" sx={{ mt: 1, display: 'block' }}>
                    Row {citation.metadata.blockNum[0]}
                  </Typography>
                </Box>
              </ListItem>
            ))}
          </List>
        </StyledSidebar>
      </ViewerContainer>
    </Box>
  );
};

export default ExcelViewer;
