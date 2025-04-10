import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, Typography, Paper } from '@mui/material';
import { styled } from '@mui/material/styles';
import { Icon } from '@iconify/react';
import { HighlightType, Position, ProcessedCitation } from 'src/types/pdf-highlighter';
import { DocumentContent } from 'src/sections/knowledgebase/types/search-response';
import { CustomCitation } from 'src/types/chat-bot';
import CitationSidebar from './highlighter-sidebar';

type TextViewerProps = {
  citations: DocumentContent[] | CustomCitation[];
  url: string | null;
  text?: string | null;
  buffer?: ArrayBuffer | null;
  sx?: Record<string, unknown>;
};

// Styled components
const TextViewerContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  height: '100%',
  position: 'relative',
  overflow: 'hidden',
  borderRadius: theme.shape.borderRadius,
}));

const LoadingOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: theme.palette.background.paper,
  zIndex: 10,
}));

const ErrorOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: theme.palette.error.light,
  color: theme.palette.error.contrastText,
  zIndex: 10,
}));

const DocumentContainer = styled(Box)({
  width: '100%',
  height: '100%',
  overflow: 'auto',
  minHeight: '100px',
  fontFamily: 'monospace',
  padding: '16px',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  lineHeight: 1.6,
});

// Helper function to generate unique IDs
const getNextId = (): string => String(Math.random()).slice(2);

// Helper type guard to check if an object is DocumentContent
const isDocumentContent = (
  citation: DocumentContent | CustomCitation
): citation is DocumentContent => 'metadata' in citation && citation.metadata !== undefined;

// Process citation to create a highlight based on text content
const processTextHighlight = (citation: DocumentContent | CustomCitation): HighlightType | null => {
  try {
    if (!citation.content) {
      console.warn('Citation missing content, skipping highlight');
      return null;
    }

    let id: string;

    if (isDocumentContent(citation) && citation.metadata && citation.metadata._id) {
      id = citation.metadata._id;
    } else if ('id' in citation) {
      id = citation.id as string;
    } else if ('_id' in citation) {
      id = citation._id as string;
    } else if ('citationId' in citation) {
      id = citation.citationId as string;
    } else {
      id = getNextId();
    }

    // Create a complete Position object with required properties
    const position: Position = {
      pageNumber: 1,
      boundingRect: {
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 0,
        width: 0,
        height: 0,
      },
      rects: [
        {
          x1: 0,
          y1: 0,
          x2: 0,
          y2: 0,
          width: 0,
          height: 0,
        },
      ],
    };

    return {
      content: {
        text: citation.content,
      },
      position,
      comment: {
        text: '',
        emoji: '',
      },
      id,
    };
  } catch (error) {
    console.error('Error processing highlight:', error);
    return null;
  }
};

const TextViewer: React.FC<TextViewerProps> = ({ url, text, buffer, sx = {}, citations = [] }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [documentReady, setDocumentReady] = useState<boolean>(false);
  const [documentText, setDocumentText] = useState<string>('');
  const scrollViewerToRef = useRef<(highlight: HighlightType) => void>(() => {});
  const [processedCitations, setProcessedCitations] = useState<ProcessedCitation[]>([]);
  const styleAddedRef = useRef<boolean>(false);
  const processingCitationsRef = useRef<boolean>(false);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  const highlightAppliersRef = useRef<(() => void)[]>([]);

  // STEP 1: Load text content
  useEffect(() => {
    const loadTextContent = async (): Promise<void> => {
      try {
        // Reset state
        setLoading(true);
        setError(null);

        // If text is directly provided, use it
        if (text) {
          setDocumentText(text);
          setLoading(false);
          setDocumentReady(true);
          return;
        }

        // If buffer is provided, convert it to text
        if (buffer) {
          try {
            // Convert ArrayBuffer to string using TextDecoder
            const decoder = new TextDecoder('utf-8');
            const decodedText = decoder.decode(buffer);

            if (!decodedText) {
              throw new Error('Failed to decode buffer content');
            }

            setDocumentText(decodedText);
            setLoading(false);
            setDocumentReady(true);
            return;
          } catch (bufferError) {
            throw new Error(`Failed to process buffer: ${bufferError.message}`);
          }
        }

        // If URL is provided, fetch the text
        if (url) {
          try {
            const fetchWithTimeout = async (fetchUrl: string, timeoutMs = 30000) => {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

              try {
                const response = await fetch(fetchUrl, { signal: controller.signal });
                clearTimeout(timeoutId);
                return response;
              } catch (err) {
                clearTimeout(timeoutId);
                throw err;
              }
            };

            const response = await fetchWithTimeout(url);

            if (!response.ok) {
              throw new Error(
                `Failed to fetch document: ${response.status} ${response.statusText}`
              );
            }

            const fileText = await response.text();

            if (!fileText) {
              throw new Error('Received empty file from URL');
            }

            setDocumentText(fileText);
            setLoading(false);
            setDocumentReady(true);
          } catch (urlError) {
            if (urlError.name === 'AbortError') {
              throw new Error('Document fetch timed out. Check if the URL is accessible.');
            }
            throw new Error(`Failed to process document: ${urlError.message}`);
          }
        } else {
          throw new Error('Either url, text, or buffer must be provided');
        }
      } catch (err) {
        console.error('Error loading text document:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error loading document';
        setError(errorMessage);
        setLoading(false);
      }
    };

    loadTextContent();
  }, [url, text, buffer]);

  // STEP 2: Render text content when document is ready
  useEffect(() => {
    if (!documentReady || !documentText || !containerRef.current) return;

    try {
      // Clear container
      containerRef.current.innerHTML = '';

      // Process text for highlighting capabilities
      // For plain text, we'll split by lines and create paragraph elements
      const lines = documentText.split('\n');

      // Create a document fragment for better performance
      const fragment = document.createDocumentFragment();

      lines.forEach((line, index) => {
        const paragraph = document.createElement('p');
        paragraph.id = `line-${index}`;
        paragraph.className = 'text-line';
        paragraph.textContent = line || ' '; // Use space for empty lines
        fragment.appendChild(paragraph);
      });

      // Append all lines at once
      containerRef.current.appendChild(fragment);
    } catch (err) {
      console.error('Error rendering text document:', err);
      setError(err instanceof Error ? err.message : 'Error rendering text document');
    }
  }, [documentReady, documentText]);

  // STEP 3: Add highlight styles once
  useEffect(() => {
    if (styleAddedRef.current) return;

    styleAddedRef.current = true;
    createHighlightStyles();
  }, []);

  // Create highlight styles function
  const createHighlightStyles = (): (() => void) | undefined => {
    const styleId = 'text-highlight-styles';

    // Check if style already exists
    if (document.getElementById(styleId)) {
      return undefined;
    }

    // Create style element with enhanced highlighting styles
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Base highlight style */
      .text-highlight {
        cursor: pointer;
        background-color: rgba(255, 235, 59, 0.5) !important; /* Bright yellow with transparency */
        position: relative;
        z-index: 1;
        border-radius: 2px;
        box-shadow: 0 0 0 1px rgba(255, 193, 7, 0.3);
        transition: all 0.25s ease;
        text-decoration: none !important;
        color: inherit !important;
        border-bottom: 2px solid #FFC107;
      }
      
      /* Hover state */
      .text-highlight:hover {
        background-color: rgba(255, 193, 7, 0.6) !important; /* Amber on hover */
        box-shadow: 0 0 0 2px rgba(255, 152, 0, 0.4);
        z-index: 2;
      }
   
      /* Active state */
      .text-highlight-active {
        background-color: rgba(255, 152, 0, 0.7) !important; /* Orange for active */
        box-shadow: 0 0 0 3px rgba(255, 87, 34, 0.4) !important;
        font-weight: bold !important;
        z-index: 3 !important;
        color: inherit !important;
        border-bottom: 2px solid #FF5722;
      }
      
      /* Animation */
      .highlight-pulse {
        animation: highlightPulse 1.5s 1;
      }
      
      @keyframes highlightPulse {
        0% { box-shadow: 0 0 0 3px rgba(255, 87, 34, 0.3); }
        50% { box-shadow: 0 0 0 6px rgba(255, 87, 34, 0.1); }
        100% { box-shadow: 0 0 0 3px rgba(255, 87, 34, 0.3); }
      }
      
      /* Custom highlight styles for different types of matches */
      .text-highlight-exact {
        background-color: rgba(255, 235, 59, 0.6) !important; /* Brighter yellow for exact matches */
        border-bottom: 2px solid #FFC107;
      }
      
      .text-highlight-partial {
        background-color: rgba(156, 204, 101, 0.4) !important; /* Light green for partial matches */
        border-bottom: 2px dashed #8BC34A;
      }
      
      .text-highlight-fuzzy {
        background-color: rgba(187, 222, 251, 0.5) !important; /* Light blue for fuzzy matches */
        border-bottom: 2px dotted #2196F3;
      }
      
      /* Text viewer specific styles */
      .text-line {
        margin: 0;
        padding: 2px 0;
      }
      
      /* Make sure highlights preserve line breaks and formatting */
      .text-highlight {
        display: inline !important;
        white-space: pre-wrap !important;
      }
    `;

    document.head.appendChild(style);

    // Create cleanup function
    const cleanup = (): void => {
      const styleElement = document.getElementById(styleId);
      if (styleElement) {
        document.head.removeChild(styleElement);
      }
    };

    return cleanup;
  };

  // STEP 4: Process citations when document is ready
  useEffect(() => {
    // Skip if document not ready or already processing citations
    if (!documentReady || processingCitationsRef.current || !citations?.length) {
      return;
    }

    processingCitationsRef.current = true;

    try {
      // Clear previous highlight appliers
      highlightAppliersRef.current = [];

      // Create a properly typed array from the start
      const processed: ProcessedCitation[] = [];

      // Process citations into highlights with type safety
      citations.forEach((citation) => {
        const highlight = processTextHighlight(citation);

        // Only add items where highlight is not null
        if (highlight) {
          // Create a properly typed ProcessedCitation
          const processedCitation: ProcessedCitation = {
            ...citation,
            highlight,
          } as ProcessedCitation;

          processed.push(processedCitation);
        }
      });

      setProcessedCitations(processed);

      // Apply highlights after a short delay to ensure document is fully rendered
      if (processed.length > 0 && containerRef.current) {
        setTimeout(() => {
          applyTextHighlights(processed);
        }, 500);
      }
    } catch (err) {
      console.error('Error processing citations:', err);
    } finally {
      // Even if there's an error, mark processing as complete
      processingCitationsRef.current = false;
    }
    // eslint-disable-next-line
  }, [documentReady, citations]);

  // Helper function to calculate text similarity (Levenshtein distance for fuzzy matching)
  const calculateSimilarity = (text1: string, text2: string): number => {
    // Normalize texts
    const s1 = text1.toLowerCase().trim();
    const s2 = text2.toLowerCase().trim();

    // Simple word overlap ratio for longer texts
    if (s1.length > 100 || s2.length > 100) {
      const words1 = s1.split(/\s+/);
      const words2 = s2.split(/\s+/);

      const uniqueWords1 = new Set(words1);
      const uniqueWords2 = new Set(words2);

      let matchCount = 0;
      uniqueWords1.forEach((word) => {
        if (word.length > 3 && uniqueWords2.has(word)) {
          matchCount += 1;
        }
      });

      return matchCount / Math.max(uniqueWords1.size, uniqueWords2.size);
    }

    // For shorter strings, use Levenshtein distance
    const track = Array(s2.length + 1)
      .fill(null)
      .map(() => Array(s1.length + 1).fill(null));

    for (let i = 0; i <= s1.length; i += 1) {
      track[0][i] = i;
    }

    for (let j = 0; j <= s2.length; j += 1) {
      track[j][0] = j;
    }

    for (let j = 1; j <= s2.length; j += 1) {
      for (let i = 1; i <= s1.length; i += 1) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1, // deletion
          track[j - 1][i] + 1, // insertion
          track[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    // Convert distance to similarity ratio (1 = identical, 0 = completely different)
    const maxLength = Math.max(s1.length, s2.length);
    if (maxLength === 0) return 1.0; // Both strings are empty

    return 1.0 - track[s2.length][s1.length] / maxLength;
  };

  // Extract click handler to a separate function for reuse
  const addHighlightClickHandler = (element: HTMLElement, highlightId: string): void => {
    element.addEventListener('click', () => {
      // Remove active class from all highlights
      document.querySelectorAll('.text-highlight-active').forEach((el) => {
        el.classList.remove('text-highlight-active');
        el.classList.remove('highlight-pulse');
      });

      // Add active class to this highlight
      element.classList.add('text-highlight-active');
      element.classList.add('highlight-pulse');

      // Update active highlight ID
      setActiveHighlightId(highlightId);

      // Scroll into view with offset to ensure visibility
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  };

  // Function to determine which lines contain the text to highlight
  const findLinesWithText = (searchText: string, threshold = 0.8): Element[] => {
    if (!containerRef.current) return [];

    const lines = containerRef.current.querySelectorAll('.text-line');
    const resultLines: Element[] = [];

    // Normalize search text
    const normalizedSearch = searchText.toLowerCase().trim();

    // For very short search texts, require higher precision
    const adjustedThreshold = normalizedSearch.length < 20 ? 0.9 : threshold;

    // Find paragraphs containing the text with various matching strategies
    Array.from(lines).forEach((line) => {
      const lineText = line.textContent || '';
      const normalizedLine = lineText.toLowerCase().trim();

      // Try exact match first
      if (normalizedLine.includes(normalizedSearch)) {
        resultLines.push(line);
        return;
      }

      // Try fuzzy match if exact match fails
      const similarity = calculateSimilarity(normalizedSearch, normalizedLine);
      if (similarity >= adjustedThreshold) {
        resultLines.push(line);
      }
    });

    return resultLines;
  };

  // Function to highlight text within a specific element
  const highlightTextInElement = (
    element: Element,
    textString: string,
    highlightId: string,
    matchType: 'exact' | 'partial' | 'fuzzy' = 'exact'
  ): boolean => {
    if (!element || !textString) return false;

    try {
      // Find where the text appears in the element
      const elementContent = element.textContent || '';
      const normalizedContent = elementContent.toLowerCase();
      const normalizedText = textString.toLowerCase();
      let textIndex = normalizedContent.indexOf(normalizedText);

      // Determine the highlight class based on match type
      const highlightClass = `text-highlight highlight-${highlightId} text-highlight-${matchType}`;

      // If text is not found directly and we're doing a fuzzy match
      if (textIndex === -1 && matchType === 'fuzzy') {
        // For fuzzy matches, we'll wrap the whole element
        try {
          const wrapper = document.createElement('span');
          wrapper.className = highlightClass;
          wrapper.textContent = elementContent;
          wrapper.dataset.id = highlightId;
          wrapper.dataset.matchType = 'fuzzy';

          element.textContent = '';
          element.appendChild(wrapper);

          // Store a cleanup function
          highlightAppliersRef.current.push(() => {
            try {
              if (element && wrapper.parentNode === element) {
                element.textContent = wrapper.textContent;
              }
            } catch (e) {
              console.error('Error in cleanup', e);
            }
          });

          // Add click handler
          addHighlightClickHandler(wrapper, highlightId);

          return true;
        } catch (e) {
          console.error('Error wrapping element', e);
          return false;
        }
      }

      // For exact and partial matches, use text nodes
      if (textIndex >= 0 || matchType === 'exact' || matchType === 'partial') {
        // If we have an exact match, use original text index
        if (textIndex === -1) {
          // For partial matches, find the best substring match
          let bestMatchIndex = -1;
          let bestMatchLength = 0;

          // Try to find a significant substring match
          const words = normalizedText.split(/\s+/).filter((w) => w.length > 3);

          // Replace the for...of loop with reduce method
          words.reduce((_, word) => {
            const wordIndex = normalizedContent.indexOf(word);
            if (wordIndex >= 0 && word.length > bestMatchLength) {
              bestMatchIndex = wordIndex;
              bestMatchLength = word.length;
            }
            return null;
          }, null);

          if (bestMatchIndex >= 0) {
            textIndex = bestMatchIndex;
            // Adjust the text to highlight to be the best match area
            const contextSize = 40; // Characters before and after
            const start = Math.max(0, bestMatchIndex - contextSize);
            const end = Math.min(
              elementContent.length,
              bestMatchIndex + bestMatchLength + contextSize
            );
            text = elementContent.substring(start, end);
          } else {
            // If still no match, highlight the whole element
            try {
              const wrapper = document.createElement('span');
              wrapper.className = highlightClass;
              wrapper.textContent = elementContent;
              wrapper.dataset.id = highlightId;
              wrapper.dataset.matchType = matchType;

              element.textContent = '';
              element.appendChild(wrapper);

              // Store a cleanup function
              highlightAppliersRef.current.push(() => {
                try {
                  if (element && wrapper.parentNode === element) {
                    element.textContent = wrapper.textContent;
                  }
                } catch (e) {
                  console.error('Error in cleanup', e);
                }
              });

              // Add click handler
              addHighlightClickHandler(wrapper, highlightId);

              return true;
            } catch (e) {
              console.error('Error wrapping element for partial match', e);
              return false;
            }
          }
        }

        // Standard text node approach for highlighting
        try {
          // Get the actual text to highlight in the case-preserved version
          const highlightText = elementContent.substring(textIndex, textIndex + textString.length);

          const beforeText = elementContent.substring(0, textIndex);
          const afterText = elementContent.substring(textIndex + highlightText.length);

          // Clear the element
          element.textContent = '';

          // Add the before text if it exists
          if (beforeText) {
            element.appendChild(document.createTextNode(beforeText));
          }

          // Add the highlighted text
          const highlightSpan = document.createElement('span');
          highlightSpan.className = highlightClass;
          highlightSpan.textContent = highlightText;
          highlightSpan.dataset.id = highlightId;
          highlightSpan.dataset.matchType = matchType;
          element.appendChild(highlightSpan);

          // Add the after text if it exists
          if (afterText) {
            element.appendChild(document.createTextNode(afterText));
          }

          // Add click handler
          addHighlightClickHandler(highlightSpan, highlightId);

          // Store cleanup function
          highlightAppliersRef.current.push(() => {
            try {
              if (element) {
                element.textContent = elementContent;
              }
            } catch (err) {
              console.error('Error in cleanup', err);
            }
          });

          return true;
        } catch (err) {
          console.error('Error in highlight function:', err);
          return false;
        }
      }

      return false;
    } catch (err) {
      console.error('Error in highlight function:', err);
      return false;
    }
  };

  // Apply text-based highlights with fuzzy matching
  const applyTextHighlights = (citationsArray: ProcessedCitation[]): void => {
    if (!containerRef.current) return;

    // Clear existing highlights
    clearHighlights();

    // Apply new highlights
    citationsArray.forEach((citation) => {
      if (!citation.highlight) return;

      const textString = citation.highlight.content.text;
      if (!textString || textString.length < 4) {
        return;
      }

      try {
        // Find all text elements that might contain the target text
        const matchingLines = findLinesWithText(textString);

        if (matchingLines.length > 0) {
          // Try exact match first
          let exactMatchFound = false;

          // Replace for...of with some() to enable early exit with break
          matchingLines.some((line) => {
            const lineContent = line.textContent || '';
            if (lineContent.includes(textString)) {
              if (
                citation.highlight &&
                highlightTextInElement(line, textString, citation?.highlight?.id, 'exact')
              ) {
                exactMatchFound = true;
                return true; // equivalent to break
              }
            }
            return false; // continue the iteration
          });

          // If exact match not found, try normalized/partial matching
          if (!exactMatchFound) {
            // Normalize the citation text
            const normalizedText = textString.replace(/\s+/g, ' ').trim();

            let partialMatchFound = false;

            // Replace for...of with some() to enable early exit with break
            matchingLines.some((line) => {
              const normalizedContent = (line.textContent || '').replace(/\s+/g, ' ').trim();

              if (normalizedContent.includes(normalizedText)) {
                if (
                  citation.highlight &&
                  highlightTextInElement(line, normalizedText, citation.highlight.id, 'partial')
                ) {
                  partialMatchFound = true;
                  return true; // equivalent to break
                }
              }
              return false; // continue the iteration
            });

            // If still no match, use fuzzy matching
            if (!partialMatchFound) {
              // Try to break into chunks for longer texts
              if (textString.length > 60) {
                const chunks = [
                  textString.substring(0, Math.min(100, Math.floor(textString.length / 3))),
                  textString.substring(
                    Math.floor(textString.length / 3),
                    Math.floor((2 * textString.length) / 3)
                  ),
                  textString.substring(Math.floor((2 * textString.length) / 3)),
                ];

                let chunkMatchFound = false;
                chunks.forEach((chunk, i) => {
                  if (chunk.length < 15) return; // Skip chunks that are too short

                  const chunkLines = findLinesWithText(chunk, 0.75);
                  if (chunkLines.length > 0) {
                    chunkMatchFound = true;
                    highlightTextInElement(
                      chunkLines[0],
                      chunk,
                      `${citation.highlight?.id}-chunk-${i}`,
                      'partial'
                    );
                  }
                });

                if (!chunkMatchFound) {
                  // Last resort: just highlight the best candidate with fuzzy match
                  if (matchingLines.length > 0) {
                    highlightTextInElement(
                      matchingLines[0],
                      matchingLines[0].textContent || '',
                      citation.highlight.id,
                      'fuzzy'
                    );
                  }
                }
              } else if (matchingLines.length > 0) {
                highlightTextInElement(
                  matchingLines[0],
                  matchingLines[0].textContent || '',
                  citation.highlight.id,
                  'fuzzy'
                );
              }
            }
          }
        } else {
          console.log(`No match found for text: "${textString.substring(0, 30)}..."`);
        }
      } catch (err) {
        console.error('Error applying highlight:', err);
      }
    });
  };

  // Clear all highlights
  const clearHighlights = (): void => {
    // Get all highlight elements
    const highlightElements = containerRef.current?.querySelectorAll('.text-highlight');
    if (highlightElements?.length) {
      highlightElements.forEach((el) => {
        try {
          const parent = el.parentNode;
          if (parent) {
            const textNode = document.createTextNode(el.textContent || '');
            parent.replaceChild(textNode, el);
          }
        } catch (err) {
          console.error('Error removing highlight', err);
        }
      });
    }

    // Execute custom cleanup functions if any were stored
    highlightAppliersRef.current.forEach((cleanup) => {
      try {
        if (typeof cleanup === 'function') cleanup();
      } catch (e) {
        console.error('Error in highlight cleanup', e);
      }
    });

    // Reset the list
    highlightAppliersRef.current = [];
  };

  // Scroll to highlight function
  const scrollToHighlight = useCallback((highlight: HighlightType): void => {
    if (!containerRef.current || !highlight) return;

    const highlightId = highlight.id;
    const highlightElement = containerRef.current.querySelector(`.highlight-${highlightId}`);

    if (highlightElement) {
      // Remove active class from all highlights
      document.querySelectorAll('.text-highlight-active').forEach((el) => {
        el.classList.remove('text-highlight-active');
        el.classList.remove('highlight-pulse');
      });

      // Add active class to this highlight
      highlightElement.classList.add('text-highlight-active');
      highlightElement.classList.add('highlight-pulse');

      // Update active highlight ID
      setActiveHighlightId(highlightId);

      // Scroll to the highlight
      highlightElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    } else {
      console.warn(`Highlight element with ID ${highlightId} not found`);

      // Try to find partial highlights if they exist
      for (let i = 0; i < 3; i += 1) {
        const chunkHighlight = containerRef.current.querySelector(
          `.highlight-${highlightId}-chunk-${i}`
        );
        if (chunkHighlight) {
          document.querySelectorAll('.text-highlight-active').forEach((el) => {
            el.classList.remove('text-highlight-active');
            el.classList.remove('highlight-pulse');
          });

          chunkHighlight.classList.add('text-highlight-active');
          chunkHighlight.classList.add('highlight-pulse');

          chunkHighlight.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });

          setActiveHighlightId(`${highlightId}-chunk-${i}`);
          return;
        }
      }
    }
  }, []);

  // Set up scroll function ref - only once
  useEffect(() => {
    scrollViewerToRef.current = scrollToHighlight;
  }, [scrollToHighlight]);

  // Clean up highlights when component unmounts
  useEffect(
    () => () => {
      clearHighlights();
    },
    []
  );

  return (
    <TextViewerContainer component={Paper} sx={sx}>
      {loading && (
        <LoadingOverlay>
          <CircularProgress size={40} sx={{ mb: 2 }} />
          <Typography variant="body1">Loading document...</Typography>
        </LoadingOverlay>
      )}

      {error && (
        <ErrorOverlay>
          <Icon icon="mdi:alert-circle-outline" style={{ fontSize: 40, marginBottom: 16 }} />
          <Typography variant="body1">Error: {error}</Typography>
        </ErrorOverlay>
      )}

      <Box sx={{ display: 'flex', height: '100%' }}>
        {/* Text document container */}
        <Box
          sx={{
            height: '100%',
            width: processedCitations.length > 0 ? '75%' : '100%',
            position: 'relative',
          }}
        >
          <DocumentContainer ref={containerRef} />
        </Box>

        {/* Only show sidebar if there are processed citations */}
        {processedCitations.length > 0 && (
          <CitationSidebar
            citations={processedCitations}
            scrollViewerTo={scrollViewerToRef.current}
          />
        )}
      </Box>
    </TextViewerContainer>
  );
};

export default TextViewer;
