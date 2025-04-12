import type { CustomCitation } from 'src/types/chat-bot';
import type { DocumentContent } from 'src/sections/knowledgebase/types/search-response';
import type { Position, HighlightType, ProcessedCitation } from 'src/types/pdf-highlighter';

import DOMPurify from 'dompurify';
import { Icon } from '@iconify/react';
import alertCircleIcon from '@iconify-icons/mdi/alert-circle-outline';
import React, { useRef, useState, useEffect, useCallback } from 'react';

import { styled } from '@mui/material/styles';
import { Box, Paper, Typography, CircularProgress } from '@mui/material';

import CitationSidebar from './highlighter-sidebar';

type HtmlViewerProps = {
  citations: DocumentContent[] | CustomCitation[];
  url: string | null;
  html?: string | null;
  buffer?: ArrayBuffer | null;
  sx?: Record<string, unknown>;
};

// Styled components
const HtmlViewerContainer = styled(Box)(({ theme }) => ({
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
  padding: '16px',
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
  } catch (err) {
    console.error('Error processing highlight:', err);
    return null;
  }
};

const HtmlViewer: React.FC<HtmlViewerProps> = ({ url, html, buffer, sx = {}, citations = [] }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [documentReady, setDocumentReady] = useState<boolean>(false);
  const [documentHtml, setDocumentHtml] = useState<string>('');
  const scrollViewerToRef = useRef<(highlight: HighlightType) => void>(() => {});
  const [processedCitations, setProcessedCitations] = useState<ProcessedCitation[]>([]);
  const styleAddedRef = useRef<boolean>(false);
  const processingCitationsRef = useRef<boolean>(false);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  const highlightAppliersRef = useRef<(() => void)[]>([]);

  // STEP 1: Load HTML content
  useEffect(() => {
    const loadHtmlContent = async (): Promise<void> => {
      try {
        // Reset state
        setLoading(true);
        setError(null);

        // If HTML is directly provided, use it
        if (html) {
          setDocumentHtml(html);
          setLoading(false);
          setDocumentReady(true);
          return;
        }

        // If buffer is provided, convert it to HTML
        if (buffer) {
          try {
            // Convert ArrayBuffer to string using TextDecoder
            const decoder = new TextDecoder('utf-8');
            const decodedHtml = decoder.decode(buffer);

            if (!decodedHtml) {
              throw new Error('Failed to decode buffer content');
            }

            setDocumentHtml(decodedHtml);
            setLoading(false);
            setDocumentReady(true);
            return;
          } catch (bufferError) {
            throw new Error(`Failed to process buffer: ${bufferError.message}`);
          }
        }

        // If URL is provided, fetch the HTML
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

            const fileHtml = await response.text();

            if (!fileHtml) {
              throw new Error('Received empty file from URL');
            }

            setDocumentHtml(fileHtml);
            setLoading(false);
            setDocumentReady(true);
          } catch (urlError) {
            if (urlError.name === 'AbortError') {
              throw new Error('Document fetch timed out. Check if the URL is accessible.');
            }
            throw new Error(`Failed to process document: ${urlError.message}`);
          }
        } else {
          throw new Error('Either url, html, or buffer must be provided');
        }
      } catch (err) {
        console.error('Error loading HTML document:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error loading document';
        setError(errorMessage);
        setLoading(false);
      }
    };

    loadHtmlContent();
  }, [url, html, buffer]);

  // STEP 2: Render HTML content when document is ready
  useEffect(() => {
    if (!documentReady || !documentHtml || !containerRef.current) return;

    try {
      // Clear container
      containerRef.current.innerHTML = '';

      // Sanitize HTML to prevent XSS attacks
      const sanitizedHtml = DOMPurify.sanitize(documentHtml, {
        USE_PROFILES: { html: true },
        ADD_ATTR: ['target'],
        ADD_TAGS: ['iframe'],
        FORBID_TAGS: ['script', 'style', 'link'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
      });

      // Create a wrapper div for the HTML content
      const contentDiv = document.createElement('div');
      contentDiv.className = 'html-content';
      contentDiv.innerHTML = sanitizedHtml;

      // Add IDs to elements for easier highlighting
      const addElementIds = (selector: string, prefix: string) => {
        const elements = contentDiv.querySelectorAll(selector);
        if (elements?.length) {
          elements.forEach((element, index) => {
            if (!element.id) {
              element.id = `${prefix}-${index}`;
            }
          });
        }
      };

      // Add IDs to common HTML elements that might contain text
      addElementIds('p:not([id])', 'p');
      addElementIds('div:not([id]):not(:has(> div, > p))', 'div');
      addElementIds('span:not([id])', 'span');
      addElementIds(
        'h1:not([id]), h2:not([id]), h3:not([id]), h4:not([id]), h5:not([id]), h6:not([id])',
        'h'
      );
      addElementIds('li:not([id])', 'li');
      addElementIds('td:not([id])', 'td');
      addElementIds('th:not([id])', 'th');
      addElementIds('pre:not([id])', 'pre');
      addElementIds('code:not([id])', 'code');
      addElementIds('blockquote:not([id])', 'quote');
      addElementIds('a:not([id])', 'a');

      // Append the content to the container
      containerRef.current.appendChild(contentDiv);

      // Apply base styles to make HTML look better
      const style = document.createElement('style');
      style.textContent = `
        .html-content {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          line-height: 1.6;
          max-width: 100%;
          word-wrap: break-word;
        }
        
        .html-content img {
          max-width: 100%;
          height: auto;
        }
        
        .html-content pre {
          background-color: #f5f5f5;
          padding: 16px;
          border-radius: 4px;
          overflow-x: auto;
        }
        
        .html-content table {
          border-collapse: collapse;
          width: 100%;
          margin-bottom: 16px;
        }
        
        .html-content th, .html-content td {
          border: 1px solid #ddd;
          padding: 8px;
        }
        
        .html-content th {
          background-color: #f2f2f2;
          text-align: left;
        }
      `;

      document.head.appendChild(style);
    } catch (err) {
      console.error('Error rendering HTML document:', err);
      setError(err instanceof Error ? err.message : 'Error rendering HTML document');
    }
  }, [documentReady, documentHtml]);

  // STEP 3: Add highlight styles once
  useEffect(() => {
    if (styleAddedRef.current) return;

    styleAddedRef.current = true;
    createHighlightStyles();
  }, []);

  // Create highlight styles function
  const createHighlightStyles = (): (() => void) | undefined => {
    const styleId = 'html-highlight-styles';

    // Check if style already exists
    if (document.getElementById(styleId)) {
      return undefined;
    }

    // Create style element with enhanced highlighting styles
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Base highlight style */
      .html-highlight {
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
      .html-highlight:hover {
        background-color: rgba(255, 193, 7, 0.6) !important; /* Amber on hover */
        box-shadow: 0 0 0 2px rgba(255, 152, 0, 0.4);
        z-index: 2;
      }
   
      /* Active state */
      .html-highlight-active {
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
      .html-highlight-exact {
        background-color: rgba(255, 235, 59, 0.6) !important; /* Brighter yellow for exact matches */
        border-bottom: 2px solid #FFC107;
      }
      
      .html-highlight-partial {
        background-color: rgba(156, 204, 101, 0.4) !important; /* Light green for partial matches */
        border-bottom: 2px dashed #8BC34A;
      }
      
      .html-highlight-fuzzy {
        background-color: rgba(187, 222, 251, 0.5) !important; /* Light blue for fuzzy matches */
        border-bottom: 2px dotted #2196F3;
      }
      
      /* Make sure highlights preserve line breaks and formatting */
      .html-highlight {
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
      document.querySelectorAll('.html-highlight-active').forEach((el) => {
        el.classList.remove('html-highlight-active');
        el.classList.remove('highlight-pulse');
      });

      // Add active class to this highlight
      element.classList.add('html-highlight-active');
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

  // Find all text nodes within the HTML document that might contain the target text
  const getTextNodes = (root: Element | Document): Node[] => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        // Skip empty text nodes or those with just whitespace
        if (!node.textContent || node.textContent.trim() === '') {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip nodes in scripts, styles, etc.
        const parent = node.parentElement;
        if (
          parent &&
          (parent.tagName === 'SCRIPT' ||
            parent.tagName === 'STYLE' ||
            parent.tagName === 'NOSCRIPT' ||
            parent.getAttribute('aria-hidden') === 'true')
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes: Node[] = [];
    let node = walker.nextNode();

    while (node) {
      nodes.push(node);
      node = walker.nextNode();
    }

    return nodes;
  };

  // Function to find elements that might contain the text to highlight
  const findElementsContainingText = (searchText: string, threshold = 0.8): Element[] => {
    if (!containerRef.current) return [];

    const resultElements: Element[] = [];
    const textNodes = getTextNodes(containerRef.current);
    const normalizedSearch = searchText.toLowerCase().trim();

    // First attempt: Try to find elements with exact match
    const exactMatches = new Set<Element>();

    textNodes.forEach((node) => {
      if (!node.textContent) return;

      if (node.textContent.toLowerCase().includes(normalizedSearch)) {
        // Find the closest parent element that would be suitable for highlighting
        let parent = node.parentElement;
        while (
          parent &&
          [
            'SPAN',
            'P',
            'DIV',
            'LI',
            'TD',
            'TH',
            'H1',
            'H2',
            'H3',
            'H4',
            'H5',
            'H6',
            'BLOCKQUOTE',
          ].indexOf(parent.tagName) === -1
        ) {
          parent = parent.parentElement;
        }

        if (parent) {
          exactMatches.add(parent);
        }
      }
    });

    // Convert the set to an array
    exactMatches.forEach((element) => {
      resultElements.push(element);
    });

    // If exact matches found, return them
    if (resultElements.length > 0) {
      return resultElements;
    }

    // Second attempt: Try fuzzy matching on a broader set of elements
    const potentialElements = containerRef.current.querySelectorAll(
      'p, div, li, td, th, h1, h2, h3, h4, h5, h6, blockquote, span, a'
    );

    const fuzzyMatches: Array<{ element: Element; similarity: number }> = [];

    Array.from(potentialElements).forEach((element) => {
      const content = element.textContent || '';
      if (content.length < 10) return; // Skip very short elements

      const similarity = calculateSimilarity(normalizedSearch, content.toLowerCase());
      if (similarity >= threshold) {
        fuzzyMatches.push({ element, similarity });
      }
    });

    // Sort by similarity (highest first)
    fuzzyMatches.sort((a, b) => b.similarity - a.similarity);

    // Take the top matches
    return fuzzyMatches.slice(0, 5).map((match) => match.element);
  };

  // Function to highlight text within a specific element
  const highlightTextInElement = (
    element: Element,
    text: string,
    highlightId: string,
    matchType: 'exact' | 'partial' | 'fuzzy' = 'exact'
  ): boolean => {
    if (!element || !text) return false;

    try {
      // Find where the text appears in the element
      const elementContent = element.textContent || '';
      const normalizedContent = elementContent.toLowerCase();
      const normalizedText = text.toLowerCase();
      let textIndex = normalizedContent.indexOf(normalizedText);

      // Determine the highlight class based on match type
      const highlightClass = `html-highlight highlight-${highlightId} html-highlight-${matchType}`;

      // If text is not found directly and we're doing a fuzzy match
      if (textIndex === -1 && matchType === 'fuzzy') {
        // For fuzzy matches, wrap the whole element or meaningful parts of it
        try {
          // Check if element has simple structure
          if (element.childNodes.length <= 3) {
            // For simple elements, wrap the entire content
            const wrapper = document.createElement('span');
            wrapper.className = highlightClass;
            wrapper.textContent = elementContent;
            wrapper.dataset.id = highlightId;
            wrapper.dataset.matchType = 'fuzzy';

            // Clear and replace content
            element.textContent = '';
            element.appendChild(wrapper);

            // Store cleanup function
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
            // eslint-disable-next-line
          } else {
            // For complex elements, find text nodes with the highest word overlap
            const textNodes = getTextNodes(element);
            let bestNode: Node | null = null;
            let bestScore = 0;

            const searchWords = new Set(
              normalizedText.split(/\s+/).filter((word) => word.length > 3)
            );

            textNodes.forEach((node) => {
              const content = node.textContent || '';
              const words = content
                .toLowerCase()
                .split(/\s+/)
                .filter((word) => word.length > 3);
              let score = 0;

              words.forEach((word) => {
                if (searchWords.has(word)) score += 1;
              });

              if (score > bestScore) {
                bestScore = score;
                bestNode = node;
              }
            });

            if (bestNode && bestScore > 0) {
              // Wrap the best matching node
              const { parentElement } = bestNode as Text;

              if (!parentElement) return false;

              const wrapper = document.createElement('span');
              wrapper.className = highlightClass;
              wrapper.textContent = (bestNode as Text).textContent;
              wrapper.dataset.id = highlightId;
              wrapper.dataset.matchType = 'fuzzy';

              // Replace the text node with our wrapper
              parentElement.replaceChild(wrapper, bestNode);

              // Store cleanup function
              highlightAppliersRef.current.push(() => {
                try {
                  if (parentElement) {
                    const newTextNode = document.createTextNode(wrapper.textContent || '');
                    parentElement.replaceChild(newTextNode, wrapper);
                  }
                } catch (err) {
                  console.error('Error in cleanup', err);
                }
              });

              // Add click handler
              addHighlightClickHandler(wrapper, highlightId);

              return true;
            }

            return false;
          }
        } catch (e) {
          console.error('Error wrapping element for fuzzy match', e);
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

        // For HTML documents, we need a more robust approach to handle DOM elements
        try {
          // Try using Range API first for more precise highlighting
          const range = document.createRange();
          const textNodes = getTextNodes(element);
          let charCount = 0;
          let startNode: Node | null = null;
          let startOffset = 0;
          let endNode: Node | null = null;
          let endOffset = 0;

          // Find the start and end nodes
          textNodes.reduce((found, node) => {
            if (found) return true; // Skip if we've already found both nodes

            const content = node.textContent || '';
            const contentLength = content.length;

            // Find start node and offset
            if (
              startNode === null &&
              textIndex >= charCount &&
              textIndex < charCount + contentLength
            ) {
              startNode = node;
              startOffset = textIndex - charCount;
            }

            // Find end node and offset
            if (
              endNode === null &&
              textIndex + text.length > charCount &&
              textIndex + text.length <= charCount + contentLength
            ) {
              endNode = node;
              endOffset = textIndex + text.length - charCount;
            }

            // If we found both nodes, exit the loop
            if (startNode !== null && endNode !== null) {
              return true; // equivalent to break
            }

            charCount += contentLength;
            return false; // continue iterating
          }, false);

          // If we found both nodes, create the highlight
          if (startNode !== null && endNode !== null) {
            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);

            const span = document.createElement('span');
            span.className = highlightClass;
            span.dataset.id = highlightId;
            span.dataset.matchType = matchType;

            try {
              range.surroundContents(span);

              // Add click handler
              addHighlightClickHandler(span, highlightId);

              // Store cleanup function
              highlightAppliersRef.current.push(() => {
                try {
                  if (span.parentNode) {
                    const parent = span.parentNode;
                    const textNode = document.createTextNode(span.textContent || '');
                    parent.replaceChild(textNode, span);
                  }
                } catch (err) {
                  console.error('Error in cleanup', err);
                }
              });

              return true;
            } catch (rangeError) {
              console.warn(
                'Range surroundContents failed, falling back to innerHTML replacement:',
                rangeError
              );

              // Fallback: Replace the HTML content directly
              // This approach is less precise but more robust
              const originalHtml = element.innerHTML;
              const normalizedHtml = originalHtml.toLowerCase();

              // Ensure we have the correct case-preserved text
              let highlightText = '';
              if (textIndex >= 0 && textIndex + text.length <= elementContent.length) {
                highlightText = elementContent.substring(textIndex, textIndex + text.length);
              } else {
                highlightText = text; // Fallback to the original text
              }

              // Try to find this text in the innerHTML
              const htmlTextIndex = normalizedHtml.indexOf(highlightText.toLowerCase());

              if (htmlTextIndex >= 0) {
                const before = originalHtml.substring(0, htmlTextIndex);
                const middle = originalHtml.substring(
                  htmlTextIndex,
                  htmlTextIndex + highlightText.length
                );
                const after = originalHtml.substring(htmlTextIndex + highlightText.length);

                element.innerHTML = `${before}<span class="${highlightClass}" data-id="${highlightId}" data-match-type="${matchType}">${middle}</span>${after}`;

                // Find the highlight span we just created
                const highlightSpan = element.querySelector(`[data-id="${highlightId}"]`);
                if (highlightSpan) {
                  addHighlightClickHandler(highlightSpan as HTMLElement, highlightId);
                }

                // Store cleanup function
                highlightAppliersRef.current.push(() => {
                  try {
                    element.innerHTML = originalHtml;
                  } catch (err) {
                    console.error('Error in cleanup', err);
                  }
                });

                return true;
              }
            }
          }

          // If Range API failed or nodes weren't found, fall back to innerHTML approach
          const originalHtml = element.innerHTML;

          // Create a simple text replacement
          // This is less precise but more likely to work across different HTML structures
          let newHtml = originalHtml;

          // Create a case-insensitive regular expression
          // Properly escape special regex characters
          const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const textRegex = new RegExp(`(${escapedText})`, 'i');

          if (textRegex.test(elementContent)) {
            newHtml = originalHtml.replace(
              textRegex,
              `<span class="${highlightClass}" data-id="${highlightId}" data-match-type="${matchType}">$1</span>`
            );

            element.innerHTML = newHtml;

            // Find the highlight span we just created
            const highlightSpan = element.querySelector(`[data-id="${highlightId}"]`);
            if (highlightSpan) {
              addHighlightClickHandler(highlightSpan as HTMLElement, highlightId);
            }

            // Store cleanup function
            highlightAppliersRef.current.push(() => {
              try {
                element.innerHTML = originalHtml;
              } catch (err) {
                console.error('Error in cleanup', err);
              }
            });

            return true;
          }

          return false;
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

  const applyTextHighlights = (citationsArray: ProcessedCitation[]): void => {
    if (!containerRef.current) return;

    // Clear existing highlights
    clearHighlights();

    // Apply new highlights
    citationsArray.forEach((citation) => {
      if (!citation.highlight) return;


      const { text } = citation.highlight.content;

      if (!text || text.length < 4) {
        return;
      }

      try {
        // Find all elements that might contain the target text
        const matchingElements = findElementsContainingText(text);

        if (matchingElements.length > 0) {
          // Try exact match first
          let exactMatchFound = false;

          // Replace first for...of loop with some() to enable early exit with break
          exactMatchFound = matchingElements.some((element) => {
            const elementContent = element.textContent || '';
            if (elementContent.includes(text)) {
              if (
                citation.highlight &&
                highlightTextInElement(element, text, citation.highlight.id, 'exact')
              ) {
                return true; // equivalent to setting exactMatchFound = true and break
              }
            }
            return false; // continue iteration
          });

          // If exact match not found, try normalized/partial matching
          if (!exactMatchFound) {
            // Normalize the citation text
            const normalizedText = text.replace(/\s+/g, ' ').trim();

            let partialMatchFound = false;

            // Replace second for...of loop with some() to enable early exit with break
            partialMatchFound = matchingElements.some((element) => {
              const normalizedContent = (element.textContent || '').replace(/\s+/g, ' ').trim();

              if (normalizedContent.includes(normalizedText)) {
                if (
                  citation.highlight &&
                  highlightTextInElement(element, normalizedText, citation.highlight.id, 'partial')
                ) {
                  return true; // equivalent to setting partialMatchFound = true and break
                }
              }
              return false; // continue iteration
            });

            // If still no match, use fuzzy matching
            if (!partialMatchFound) {
              // Try to break into chunks for longer texts
              if (text.length > 60) {
                const chunks = [
                  text.substring(0, Math.min(100, Math.floor(text.length / 3))),
                  text.substring(Math.floor(text.length / 3), Math.floor((2 * text.length) / 3)),
                  text.substring(Math.floor((2 * text.length) / 3)),
                ];

                let chunkMatchFound = false;
                chunks.forEach((chunk, i) => {
                  if (chunk.length < 15) return; // Skip chunks that are too short

                  const chunkElements = findElementsContainingText(chunk, 0.75);
                  if (chunkElements.length > 0) {
                    chunkMatchFound = true;
                    highlightTextInElement(
                      chunkElements[0],
                      chunk,
                      `${citation?.highlight?.id}-chunk-${i}`,
                      'partial'
                    );
                  }
                });

                if (!chunkMatchFound) {
                  // Last resort: just highlight the best candidate with fuzzy match
                  if (matchingElements.length > 0) {
                    highlightTextInElement(
                      matchingElements[0],
                      matchingElements[0].textContent || '',
                      citation.highlight.id,
                      'fuzzy'
                    );
                  }
                }
              } else if (matchingElements.length > 0) {
                highlightTextInElement(
                  matchingElements[0],
                  matchingElements[0].textContent || '',
                  citation.highlight.id,
                  'fuzzy'
                );
              }
            }
          }
        } else {
          console.log(`No match found for text: "${text.substring(0, 30)}..."`);
        }
      } catch (err) {
        console.error('Error applying highlight:', err);
      }
    });
  };

  // Clear all highlights
  const clearHighlights = (): void => {
    // Get all highlight elements
    const highlightElements = containerRef.current?.querySelectorAll('.html-highlight');
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
      document.querySelectorAll('.html-highlight-active').forEach((el) => {
        el.classList.remove('html-highlight-active');
        el.classList.remove('highlight-pulse');
      });

      // Add active class to this highlight
      highlightElement.classList.add('html-highlight-active');
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
          document.querySelectorAll('.html-highlight-active').forEach((el) => {
            el.classList.remove('html-highlight-active');
            el.classList.remove('highlight-pulse');
          });

          chunkHighlight.classList.add('html-highlight-active');
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
    <HtmlViewerContainer component={Paper} sx={sx}>
      {loading && (
        <LoadingOverlay>
          <CircularProgress size={40} sx={{ mb: 2 }} />
          <Typography variant="body1">Loading document...</Typography>
        </LoadingOverlay>
      )}

      {error && (
        <ErrorOverlay>
          <Icon icon={alertCircleIcon} style={{ fontSize: 40, marginBottom: 16 }} />
          <Typography variant="body1">Error: {error}</Typography>
        </ErrorOverlay>
      )}

      <Box sx={{ display: 'flex', height: '100%' }}>
        {/* HTML document container */}
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
    </HtmlViewerContainer>
  );
};

export default HtmlViewer;
