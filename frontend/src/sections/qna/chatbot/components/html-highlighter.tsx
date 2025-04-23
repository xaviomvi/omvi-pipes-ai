import type { Theme } from '@mui/material'; // Added Theme for styling access
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

// Props type definition (Unchanged)
type HtmlViewerProps = {
  citations: DocumentContent[] | CustomCitation[];
  url: string | null;
  html?: string | null;
  buffer?: ArrayBuffer | null;
  sx?: Record<string, unknown>;
};

// --- Styled components (Minor adjustments possible) ---
const HtmlViewerContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  height: '100%',
  position: 'relative',
  overflow: 'hidden', // Important: child elements handle scrolling
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`, // Consistent border
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
  backgroundColor: 'rgba(255, 255, 255, 0.8)', // Match Markdown viewer
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
  backgroundColor: theme.palette.error.lighter, // Match Markdown viewer
  color: theme.palette.error.dark,
  padding: theme.spacing(2),
  textAlign: 'center',
  zIndex: 10,
}));

// Renamed from DocumentContainer in MarkdownViewer to avoid naming clash if used together
const HtmlContentContainer = styled(Box)({
  width: '100%',
  height: '100%',
  overflow: 'auto', // This element handles the scrolling
  minHeight: '100px',
  padding: '1rem 1.5rem', // Match Markdown viewer padding
  // Base styles for HTML content will be added via JS or within the rendered content itself
  '& .html-rendered-content': {
    // Target the div we inject HTML into
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
    lineHeight: 1.6,
    maxWidth: '100%',
    wordWrap: 'break-word', // Ensure long words break
    '& img': {
      maxWidth: '100%',
      height: 'auto',
    },
    '& pre': {
      backgroundColor: 'rgba(0, 0, 0, 0.05)', // Match code style
      padding: '1em',
      borderRadius: '3px',
      overflowX: 'auto',
      fontFamily: 'monospace',
    },
    '& code:not(pre > code)': {
      fontFamily: 'monospace',
      backgroundColor: 'rgba(0, 0, 0, 0.05)',
      padding: '0.2em 0.4em',
      borderRadius: '3px',
    },
    '& table': {
      borderCollapse: 'collapse',
      marginBottom: '1em',
      width: 'auto', // Let tables size naturally or be styled by source HTML
    },
    '& th, & td': {
      border: '1px solid #ddd',
      padding: '0.5em',
      textAlign: 'left',
    },
    '& th': {
      backgroundColor: '#f2f2f2',
    },
    '& a': {
      color: '#007bff', // Example link color
      textDecoration: 'underline',
    },
    '& blockquote': {
      borderLeft: '4px solid #ccc',
      paddingLeft: '1em',
      marginLeft: 0,
      color: '#666',
    },
    '& h1, & h2, & h3, & h4, & h5, & h6': {
      marginTop: '1.5em',
      marginBottom: '0.8em',
    },
    // Add other common HTML element styles as needed
  },
});
// --- End Styled components ---

// --- Helper functions ---
const getNextId = (): string => `html-hl-${Math.random().toString(36).substring(2, 10)}`;

const isDocumentContent = (
  citation: DocumentContent | CustomCitation
): citation is DocumentContent => 'metadata' in citation && citation.metadata !== undefined;

// *** ADDED: Text normalization helper (from MarkdownViewer) ***
const normalizeText = (text: string | null | undefined): string => {
  if (!text) return '';
  // Trim, replace multiple whitespace characters (including newlines) with a single space
  return text.trim().replace(/\s+/g, ' ');
};

// *** UPDATED: Process citation to use normalized text (from MarkdownViewer) ***
const processTextHighlight = (citation: DocumentContent | CustomCitation): HighlightType | null => {
  try {
    const rawContent = citation.content;
    // *** Normalize content here and check length of normalized content ***
    const normalizedContent = normalizeText(rawContent);

    if (!normalizedContent || normalizedContent.length < 5) {
      // Ignore very short/empty citations
      // console.log('Skipping short/empty citation content:', rawContent);
      return null;
    }

    let id: string;
    // Simplified ID assignment (prioritize existing IDs) - Copied from MarkdownViewer
    if ('highlightId' in citation && citation.highlightId) id = citation.highlightId as string;
    else if ('id' in citation && citation.id) id = citation.id as string;
    else if ('citationId' in citation && citation.citationId) id = citation.citationId as string;
    else if (isDocumentContent(citation) && citation.metadata?._id) id = citation.metadata._id;
    else if ('_id' in citation && citation._id) id = citation._id as string;
    else id = getNextId(); // Fallback to random ID

    const position: Position = {
      pageNumber: -10, // Indicates it's not from a PDF page
      boundingRect: { x1: 0, y1: 0, x2: 0, y2: 0, width: 0, height: 0 },
      rects: [], // Ensure rects is always an array
    };

    return {
      // *** Store the *normalized* text for matching ***
      content: { text: normalizedContent }, // Use normalized for reliable matching
      position,
      comment: { text: '', emoji: '' }, // Ensure comment structure
      id,
    };
  } catch (error) {
    console.error('Error processing highlight for citation:', citation, error);
    return null;
  }
};
// --- End Helper functions ---

const HtmlViewer: React.FC<HtmlViewerProps> = ({
  url,
  html: initialHtml,
  buffer,
  sx = {},
  citations = [],
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null); // Ref for the scrollable container
  const contentWrapperRef = useRef<HTMLDivElement | null>(null); // Ref for the div holding the sanitized HTML
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [documentHtml, setDocumentHtml] = useState<string>('');
  const [documentReady, setDocumentReady] = useState<boolean>(false); // Tracks if HTML is loaded AND sanitized/rendered
  const [processedCitations, setProcessedCitations] = useState<ProcessedCitation[]>([]);

  // --- Refs for state management (Adopted from MarkdownViewer) ---
  const styleAddedRef = useRef<boolean>(false);
  const processingCitationsRef = useRef<boolean>(false);
  const contentRenderedRef = useRef<boolean>(false); // Tracks if HTML is in the DOM
  const highlightsAppliedRef = useRef<boolean>(false);
  const highlightingInProgressRef = useRef<boolean>(false);
  const cleanupStylesRef = useRef<(() => void) | null>(null);
  const prevCitationsJsonRef = useRef<string>('[]');
  const highlightCleanupsRef = useRef<Map<string, () => void>>(new Map()); // Keep track of cleanup functions

  // --- Highlighting logic functions (Adapted from MarkdownViewer) ---

  // *** UPDATED: Highlight Styles (Adopted from MarkdownViewer, adapted class names) ***
  const createHighlightStyles = useCallback((): (() => void) | undefined => {
    const styleId = 'html-highlight-styles'; // Keep HTML specific ID
    if (document.getElementById(styleId)) return undefined; // Already added

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Base highlight style */
      .html-highlight {
        background-color: rgba(255, 224, 130, 0.5); /* Lighter yellow */
        border-radius: 3px;
        padding: 0.1em 0;
        margin: -0.1em 0;
        cursor: pointer;
        transition: background-color 0.3s ease, box-shadow 0.3s ease;
        display: inline; /* Try to keep flow */
        box-shadow: 0 0 0 0px rgba(255, 179, 0, 0.3);
        position: relative; /* Needed for z-index */
        z-index: 1;
        /* *** ADDED: Ensure whitespace/breaks within highlight are preserved *** */
        white-space: pre-wrap !important;
        /* Ensure text color isn't overridden unintentionally */
        color: inherit !important;
        /* Remove potential underlines from parent links */
        text-decoration: none !important;
      }

      .html-highlight:hover {
        background-color: rgba(255, 213, 79, 0.7);
        box-shadow: 0 0 0 2px rgba(255, 179, 0, 0.3);
        z-index: 2;
      }

      .html-highlight-active {
        background-color: rgba(255, 179, 0, 0.8) !important; /* Amber/Orange for active */
        box-shadow: 0 0 0 3px rgba(255, 111, 0, 0.4) !important;
        /* font-weight: 600; */ /* Optional: bolding might interfere with source formatting */
        z-index: 3 !important;
        animation: htmlHighlightPulse 1.2s 1 ease-out;
      }

      @keyframes htmlHighlightPulse {
        0% { box-shadow: 0 0 0 3px rgba(255, 111, 0, 0.4); }
        50% { box-shadow: 0 0 0 6px rgba(255, 111, 0, 0.1); }
        100% { box-shadow: 0 0 0 3px rgba(255, 111, 0, 0.4); }
      }

      /* *** ADDED: Distinct style for fuzzy matches *** */
      .html-highlight-fuzzy {
         background-color: rgba(173, 216, 230, 0.6); /* Light blue */
         /* border-bottom: 2px dotted #2196F3; */ /* Optional: Border instead/as well */
      }
      .html-highlight-fuzzy:hover {
         background-color: rgba(135, 206, 250, 0.8);
      }
      .html-highlight-fuzzy.html-highlight-active {
         background-color: rgba(70, 130, 180, 0.9) !important; /* Steel Blue */
         box-shadow: 0 0 0 3px rgba(0, 71, 171, 0.5) !important; /* Darker blue shadow */
         animation: htmlHighlightPulseFuzzy 1.2s 1 ease-out; /* Optional distinct pulse */
      }

       @keyframes htmlHighlightPulseFuzzy {
        0% { box-shadow: 0 0 0 3px rgba(0, 71, 171, 0.5); }
        50% { box-shadow: 0 0 0 6px rgba(0, 71, 171, 0.2); }
        100% { box-shadow: 0 0 0 3px rgba(0, 71, 171, 0.5); }
      }
    `;
    document.head.appendChild(style);

    const cleanup = (): void => {
      const styleElement = document.getElementById(styleId);
      if (styleElement) {
        try {
          document.head.removeChild(styleElement);
          // console.log('Removed HTML highlight styles.');
        } catch (e) {
          console.error('Error removing HTML highlight styles:', e);
        }
      }
    };
    cleanupStylesRef.current = cleanup;
    return cleanup;
  }, []);

  // *** UPDATED: Similarity calculation (Using adapted MarkdownViewer version for consistency) ***
  const calculateSimilarity = useCallback((text1: string, text2: string | null): number => {
    const normalized1 = normalizeText(text1); // Use normalized text
    const normalized2 = normalizeText(text2);
    if (!normalized1 || !normalized2) return 0;

    // Use Jaccard Index based on words (good for varying lengths and finding common concepts)
    const words1 = new Set(
      normalized1
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2) // Ignore very short words
    );
    const words2 = new Set(
      normalized2
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );
    if (words1.size === 0 || words2.size === 0) return 0;

    let intersectionSize = 0;
    words1.forEach((word) => {
      if (words2.has(word)) intersectionSize += 1;
    });
    const unionSize = words1.size + words2.size - intersectionSize;
    return unionSize === 0 ? 0 : intersectionSize / unionSize;

    // --- Alternative: Levenshtein distance (better for exact phrase similarity/typos) ---
    /*
    const s1 = normalized1.toLowerCase();
    const s2 = normalized2.toLowerCase();
    const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
    for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;
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
    const distance = track[s2.length][s1.length];
    const maxLength = Math.max(s1.length, s2.length);
    if (maxLength === 0) return 1.0;
    return 1.0 - distance / maxLength;
    */
  }, []);

  // *** REPLACED: highlightTextInElement (Adapted from MarkdownViewer) ***
  const highlightTextInElement = useCallback(
    (
      element: Element, // The container element (e.g., p, div, li) where the text node lives
      normalizedTextToHighlight: string, // Expect normalized text from citation
      highlightId: string,
      matchType: 'exact' | 'fuzzy' = 'exact'
    ): { success: boolean; cleanup?: () => void } => {
      // Ensure we're searching within the content wrapper if it exists
      const searchRoot = contentWrapperRef.current || element;
      if (!searchRoot || !normalizedTextToHighlight || normalizedTextToHighlight.length < 3) {
        return { success: false };
      }

      const highlightBaseClass = 'html-highlight';
      const highlightIdClass = `highlight-${highlightId}`;
      const highlightTypeClass = `html-highlight-${matchType}`;
      const fullHighlightClass = `${highlightBaseClass} ${highlightIdClass} ${highlightTypeClass}`;

      const walker = document.createTreeWalker(
        searchRoot, // Search within the specific element or the whole wrapper
        NodeFilter.SHOW_TEXT,
        // Optional node filter: Skip text nodes inside script/style or already highlighted spans
        (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName))
            return NodeFilter.FILTER_REJECT;
          // Avoid re-highlighting inside an existing highlight span for the *same* ID
          if (parent.closest(`.${highlightBaseClass}.${highlightIdClass}`))
            return NodeFilter.FILTER_REJECT;
          if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT; // Skip empty/whitespace only
          return NodeFilter.FILTER_ACCEPT;
        }
      );

      let node: Node | null;
      const nodesToWrap: { node: Text; startIndex: number; endIndex: number }[] = [];
      let found = false;

      // --- Exact Match Search (using normalized text) ---
      while (true && !found) {
        node = walker.nextNode();
        if (!node) break;
        const textNode = node as Text;
        const nodeText = textNode.nodeValue || '';
        const normalizedNodeText = normalizeText(nodeText); // Normalize node content for matching

        // Find the *normalized* citation text within the *normalized* node content
        let startIndexInNormalized = -1;
        let searchIndex = 0;
        while (searchIndex < normalizedNodeText.length && !found) {
          startIndexInNormalized = normalizedNodeText.indexOf(
            normalizedTextToHighlight,
            searchIndex
          );
          if (startIndexInNormalized === -1) break; // Not found in the rest of the node

          // --- Map normalized index back to original index (Approximate) ---
          // This is the tricky part. We iterate through the original string, skipping whitespace
          // sequences that were collapsed during normalization, until we match the character count
          // of the normalized string up to the startIndex.
          let originalIndex = -1;
          let normalizedCharsCount = 0;
          let originalCharsCount = 0;
          let inWhitespaceSequence = false;

          while (
            originalCharsCount < nodeText.length &&
            normalizedCharsCount < startIndexInNormalized
          ) {
            const isWhitespace = /\s/.test(nodeText[originalCharsCount]);
            if (isWhitespace) {
              if (!inWhitespaceSequence) {
                normalizedCharsCount += 1; // Count the first whitespace char in a sequence
                inWhitespaceSequence = true;
              }
            } else {
              normalizedCharsCount += 1;
              inWhitespaceSequence = false;
            }
            originalCharsCount += 1;
          }
          // Adjust if the match starts right after whitespace
          while (originalCharsCount < nodeText.length && /\s/.test(nodeText[originalCharsCount])) {
            originalCharsCount += 1;
          }

          // If we successfully counted up, originalCharsCount should be the approximate start index
          if (normalizedCharsCount === startIndexInNormalized) {
            originalIndex = originalCharsCount;
          }
          // --- End Mapping Back ---

          if (originalIndex !== -1) {
            // Calculate approximate end index based on *original text* length that corresponds to normalized length
            // This requires finding the substring in original that normalizes to our target
            let approxEndIndex = originalIndex;
            let normalizedLenCount = 0;
            inWhitespaceSequence = false;
            while (
              approxEndIndex < nodeText.length &&
              normalizedLenCount < normalizedTextToHighlight.length
            ) {
              const isWhitespace = /\s/.test(nodeText[approxEndIndex]);
              if (isWhitespace) {
                if (!inWhitespaceSequence) {
                  normalizedLenCount += 1;
                  inWhitespaceSequence = true;
                }
              } else {
                normalizedLenCount += 1;
                inWhitespaceSequence = false;
              }
              approxEndIndex += 1;
            }

            // Verify: Does the extracted original substring normalize to the target?
            const originalSubstring = nodeText.substring(originalIndex, approxEndIndex);
            if (normalizeText(originalSubstring) === normalizedTextToHighlight) {
              // Check if this exact range overlaps with an *existing* highlight for *this* ID
              const rangeToCheck = document.createRange();
              try {
                rangeToCheck.setStart(textNode, originalIndex);
                rangeToCheck.setEnd(textNode, approxEndIndex);
                const intersectingHighlights = searchRoot.querySelectorAll(`.${highlightIdClass}`);
                let overlaps = false;
                intersectingHighlights.forEach((existingSpan) => {
                  const existingRange = document.createRange();
                  existingRange.selectNodeContents(existingSpan);
                  if (
                    rangeToCheck.intersectsNode(existingSpan) || // Crude check
                    (rangeToCheck.compareBoundaryPoints(Range.START_TO_START, existingRange) >= 0 &&
                      rangeToCheck.compareBoundaryPoints(Range.END_TO_END, existingRange) <= 0) || // Fully contained
                    (rangeToCheck.compareBoundaryPoints(Range.START_TO_START, existingRange) <= 0 &&
                      rangeToCheck.compareBoundaryPoints(Range.END_TO_END, existingRange) >= 0) // Contains existing
                    // Add more boundary comparisons if needed for partial overlaps
                  ) {
                    overlaps = true;
                  }
                });

                if (!overlaps) {
                  nodesToWrap.push({
                    node: textNode,
                    startIndex: originalIndex,
                    endIndex: approxEndIndex,
                  });
                  found = true; // Found a valid, non-overlapping match
                } else {
                  // console.log(`Skipping highlight for ${highlightId} due to overlap.`);
                  searchIndex = startIndexInNormalized + 1; // Continue searching in the same node
                }
              } catch (rangeError) {
                console.error('Range error during overlap check:', rangeError);
                searchIndex = startIndexInNormalized + 1; // Continue search on error
              }
            } else {
              // Mismatch after normalization - indicates mapping issue or complex content
              // console.warn(`Normalized match found, but original substring mismatch for ID ${highlightId}. Trying next occurrence.`);
              searchIndex = startIndexInNormalized + 1; // Continue searching in the same node
            }
          } else {
            // console.warn(`Could not map normalized index back to original for ${highlightId}`);
            searchIndex = startIndexInNormalized + 1; // Continue searching in same node
          }
        } // End while loop for searching within a single node
      } // End while loop for walking through nodes

      // --- Wrap the found text ---
      if (found && nodesToWrap.length > 0) {
        // Currently only handles matches within a single text node.
        // A more complex implementation would handle ranges spanning multiple nodes.
        const { node: textNode, startIndex, endIndex } = nodesToWrap[0];

        // Ensure endIndex doesn't exceed node length
        const safeEndIndex = Math.min(endIndex, textNode.nodeValue?.length ?? startIndex);
        if (startIndex >= safeEndIndex) {
          // console.warn(`Invalid range calculated for highlight ${highlightId} (start >= end). Skipping.`);
          return { success: false };
        }

        try {
          const range = document.createRange();
          range.setStart(textNode, startIndex);
          range.setEnd(textNode, safeEndIndex);

          const span = document.createElement('span');
          span.className = fullHighlightClass;
          span.dataset.highlightId = highlightId; // Keep raw ID for easy selection

          span.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent clicks bubbling up e.g., if inside a link
            const container = containerRef.current; // Use the main scrollable container
            if (!container) return;

            container.querySelectorAll(`.${highlightBaseClass}-active`).forEach((el) => {
              el.classList.remove(`${highlightBaseClass}-active`);
              // Optional: remove animation class if needed el.classList.remove('htmlHighlightPulse');
            });
            span.classList.add(`${highlightBaseClass}-active`);
            span.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          });

          // *** Robustness: Catch errors during DOM manipulation ***
          range.surroundContents(span);

          // *** Return a cleanup function ***
          const cleanup = () => {
            // Check if the span still exists and has a parent before attempting removal
            if (span.parentNode) {
              const text = document.createTextNode(span.textContent || '');
              try {
                // Replace the span with its text content
                span.parentNode.replaceChild(text, span);
                // Normalize the parent node to merge adjacent text nodes (optional but good practice)
                // text.parentNode?.normalize();
              } catch (replaceError) {
                console.error(
                  `Error replacing highlight span during cleanup (ID: ${highlightId}):`,
                  replaceError
                );
                // Attempt simple removal if replace failed (less ideal as text is lost)
                if (span.parentNode)
                  try {
                    span.parentNode.removeChild(span);
                  } catch (_) {
                    /* ignore */
                  }
              }
            }
          };
          return { success: true, cleanup };
        } catch (wrapError) {
          // Log detailed error if surroundContents fails (e.g., range crosses element boundaries)
          console.error(
            `Error surrounding content for highlight ${highlightId} (matchType: ${matchType}):`,
            wrapError,
            'Normalized Text:',
            normalizedTextToHighlight,
            'Node Content:',
            `${textNode.nodeValue?.substring(0, 100)}...`, // Log snippet
            'Range:',
            `[${startIndex}, ${safeEndIndex}]`
          );
          return { success: false };
        }
      }
      // --- Fuzzy Match Fallback (Wrap Element - Use with caution) ---
      // Only wrap the *whole* target 'element' if matchType is 'fuzzy' AND no exact match was found *inside* it
      else if (matchType === 'fuzzy' && !found && element !== searchRoot) {
        // Avoid wrapping the entire document body
        // Check if the element ALREADY has this highlight ID class from a previous attempt or contains it
        if (
          element.classList.contains(highlightIdClass) ||
          element.querySelector(`.${highlightIdClass}`)
        ) {
          // console.log(`Skipping fuzzy wrap for ${highlightId}, element already highlighted.`);
          return { success: false };
        }

        // console.log(`Attempting fuzzy wrap for element (ID: ${highlightId})`);
        try {
          // Wrap the element itself. This is broad.
          const wrapperSpan = document.createElement('span');
          // Assign classes for fuzzy match
          wrapperSpan.className = fullHighlightClass; // Includes fuzzy class
          wrapperSpan.dataset.highlightId = highlightId;

          // Move element's children into the wrapper
          while (element.firstChild) {
            wrapperSpan.appendChild(element.firstChild);
          }
          // Put the wrapper inside the element
          element.appendChild(wrapperSpan);

          // Add click listener to the wrapper span
          wrapperSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            const container = containerRef.current;
            if (!container) return;
            container
              .querySelectorAll(`.${highlightBaseClass}-active`)
              .forEach((el) => el.classList.remove(`${highlightBaseClass}-active`));
            wrapperSpan.classList.add(`${highlightBaseClass}-active`);
            wrapperSpan.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          });

          // Return cleanup function for the wrapper
          const cleanup = () => {
            if (wrapperSpan.parentNode === element) {
              // Move children back out before removing wrapper
              while (wrapperSpan.firstChild) {
                element.insertBefore(wrapperSpan.firstChild, wrapperSpan);
              }
              try {
                element.removeChild(wrapperSpan);
              } catch (removeError) {
                console.error(
                  `Error removing fuzzy wrapper during cleanup (ID: ${highlightId}):`,
                  removeError
                );
              }
            }
          };
          return { success: true, cleanup };
        } catch (wrapError) {
          console.error(`Error wrapping element for fuzzy highlight ${highlightId}:`, wrapError);
          return { success: false };
        }
      }

      // If no match found or fuzzy wrap failed/skipped
      return { success: false };
    },
    [containerRef, contentWrapperRef] // Include refs if used inside
  );

  // *** REPLACED: clearHighlights (Adopted from MarkdownViewer) ***
  const clearHighlights = useCallback(() => {
    // Use contentWrapperRef as the scope if available, otherwise containerRef
    const scope = contentWrapperRef.current || containerRef.current;
    if (!scope || highlightingInProgressRef.current) {
      // console.log("Skipping clearHighlights (no scope or already in progress)");
      return;
    }
    highlightingInProgressRef.current = true; // Prevent concurrent modification
    // console.log(`Clearing HTML highlights. ${highlightCleanupsRef.current.size} cleanups registered.`);

    // Run registered cleanup functions
    highlightCleanupsRef.current.forEach((cleanup, id) => {
      try {
        cleanup();
      } catch (e) {
        console.error(`Error running cleanup for highlight ${id}:`, e);
      }
    });
    highlightCleanupsRef.current.clear(); // Clear the map after running

    // Fallback: Find any remaining highlight spans (shouldn't happen if cleanup works)
    const remainingSpans = scope.querySelectorAll('.html-highlight');
    if (remainingSpans.length > 0) {
      console.warn(
        `Found ${remainingSpans.length} HTML highlight spans remaining after cleanup. Forcing removal.`
      );
      remainingSpans.forEach((span) => {
        if (span.parentNode) {
          const textContent = span.textContent || '';
          try {
            // Replace span with its text content
            span.parentNode.replaceChild(document.createTextNode(textContent), span);
            // span.parentNode?.normalize(); // Optional: merge text nodes
          } catch (replaceError) {
            console.error('Error during fallback removal of span:', replaceError, span);
            // If replace fails, just try removing the node
            if (span.parentNode)
              try {
                span.parentNode.removeChild(span);
              } catch (_) {
                /* ignore */
              }
          }
        }
      });
    }

    // Remove active classes separately
    scope.querySelectorAll('.html-highlight-active').forEach((el) => {
      el.classList.remove('html-highlight-active');
    });

    highlightsAppliedRef.current = false;
    highlightingInProgressRef.current = false; // Release lock
    // console.log('Finished clearing HTML highlights.');
  }, []); // No dependencies needed, operates on refs

  // *** REPLACED: applyTextHighlights (Adapted from MarkdownViewer) ***
  const applyTextHighlights = useCallback(
    (citationsToHighlight: ProcessedCitation[]): void => {
      // Use contentWrapperRef as the primary scope for querySelectorAll
      const scope = contentWrapperRef.current;
      if (
        !scope || // Must have the rendered content div
        !containerRef.current || // Still need the main container for scrolling etc.
        highlightingInProgressRef.current ||
        !documentReady || // Ensure HTML is loaded and rendered
        !contentRenderedRef.current // Ensure it's in the DOM
      ) {
        // console.log("Skipping applyTextHighlights: conditions not met", { scope: !!scope, container: !!containerRef.current, highlighting: highlightingInProgressRef.current, docReady: documentReady, contentRendered: contentRenderedRef.current });
        return;
      }

      // console.log("Applying HTML text highlights...");
      highlightingInProgressRef.current = true;
      clearHighlights(); // Clear previous ones first
      highlightingInProgressRef.current = true; // Re-acquire lock immediately after clear

      // Use requestAnimationFrame for smoother rendering
      requestAnimationFrame(() => {
        try {
          // Re-check scope in case it becomes null during the rAF delay
          if (!contentWrapperRef.current) {
            console.error('Content wrapper ref lost during applyTextHighlights delay.');
            highlightingInProgressRef.current = false;
            return;
          }
          const currentScope = contentWrapperRef.current;

          let appliedCount = 0;
          const newCleanups = new Map<string, () => void>();

          // Define candidate elements within the rendered HTML content
          // Broad selector targeting elements likely to contain text content. Exclude script/style.
          // Prefer block elements or spans that don't contain other blocks.
          const selector =
            'p, li, blockquote, h1, h2, h3, h4, h5, h6, td, th, pre, span:not(:has(p, li, blockquote, h1, h2, h3, h4, h5, h6, td, th, pre, div)), div:not(:has(p, li, blockquote, h1, h2, h3, h4, h5, h6, td, th, pre, div))';
          const candidateElements = Array.from(currentScope.querySelectorAll(selector));

          if (candidateElements.length === 0) {
            console.warn(
              'No candidate text elements found in HTML content using selector:',
              selector
            );
            // Fallback: Try searching the entire content wrapper directly if no specific candidates found
            if (currentScope.hasChildNodes()) {
              candidateElements.push(currentScope); // Add the wrapper itself as a last resort
              console.log('Using content wrapper as fallback candidate element.');
            }
          }

          citationsToHighlight.forEach((citation) => {
            const normalizedText = citation.highlight?.content?.text; // Expect normalized text
            const highlightId = citation.highlight?.id;

            if (!normalizedText || !highlightId) {
              // console.log("Skipping citation with no text or ID:", citation);
              return;
            }

            let matchFoundInIteration = false; // Track if any highlight (exact/fuzzy) was applied for this citation

            // --- Attempt Exact Match First ---
            const exactMatchApplied = candidateElements.some((element) => {
              // Check if element itself is already highlighted or contains the highlight to prevent nesting issues
              if (
                element.classList.contains(`highlight-${highlightId}`) ||
                element.querySelector(`.highlight-${highlightId}`)
              ) {
                return false; // Already done, continue to next element
              }

              const normalizedElementText = normalizeText(element.textContent);

              // Check if the *normalized* element text contains the *normalized* citation text
              if (normalizedElementText.includes(normalizedText)) {
                // Attempt to highlight using the precise method
                const result = highlightTextInElement(
                  element,
                  normalizedText,
                  highlightId,
                  'exact'
                );
                if (result.success) {
                  appliedCount += 1;
                  if (result.cleanup) newCleanups.set(highlightId, result.cleanup);
                  matchFoundInIteration = true; // Mark as found
                  return true; // Found exact match, stop searching elements for *this* citation
                }
              }
              return false; // Continue searching in next element
            });

            // --- Fuzzy Match Fallback (if no exact match applied) ---
            if (!matchFoundInIteration && candidateElements.length > 0) {
              // console.log(`Exact match failed for ${highlightId}. Attempting fuzzy match...`);
              // Calculate similarity scores for all candidate elements
              const similarityScores = candidateElements
                .map((el) => {
                  // Avoid calculating similarity if element already contains the highlight
                  if (
                    el.classList.contains(`highlight-${highlightId}`) ||
                    el.querySelector(`.highlight-${highlightId}`)
                  ) {
                    return { element: el, score: -1 }; // Ignore already highlighted
                  }
                  return {
                    element: el,
                    score: calculateSimilarity(normalizedText, el.textContent),
                  };
                })
                .filter((item) => item.score >= 0.7) // Similarity threshold (adjust as needed)
                .sort((a, b) => b.score - a.score); // Sort by highest similarity

              if (similarityScores.length > 0) {
                const bestMatch = similarityScores[0];
                // console.log(`Best fuzzy match for ${highlightId}: score ${bestMatch.score.toFixed(2)}`);

                // Attempt fuzzy highlight on the best matching element
                // highlightTextInElement handles the 'fuzzy' logic (e.g., wrap element)
                const result = highlightTextInElement(
                  bestMatch.element,
                  normalizedText, // Pass normalized text for potential internal use by fuzzy logic
                  highlightId,
                  'fuzzy'
                );
                if (result.success) {
                  appliedCount += 1;
                  if (result.cleanup) newCleanups.set(highlightId, result.cleanup);
                  matchFoundInIteration = true; // Mark as found (fuzzy)
                }
              }
            }

            if (!matchFoundInIteration) {
              // console.warn(`Could not find/apply highlight for ID: ${highlightId}`);
            }
          });

          highlightCleanupsRef.current = newCleanups; // Store the new cleanup functions
          highlightsAppliedRef.current = appliedCount > 0;
          // console.log(`Applied ${appliedCount} HTML highlights. Total cleanups stored: ${newCleanups.size}`);
          // Dispatch event *after* highlights are applied (or attempted)
          document.dispatchEvent(new CustomEvent('highlightsapplied'));
        } catch (e) {
          console.error('Error during applyTextHighlights execution:', e);
          highlightsAppliedRef.current = false; // Ensure flag is false on error
        } finally {
          highlightingInProgressRef.current = false; // Release lock
          // console.log("Finished applyTextHighlights.");
        }
      });
    },
    [
      documentReady,
      contentRenderedRef, // Depend on content being in DOM
      clearHighlights,
      highlightTextInElement,
      calculateSimilarity,
      // Note: Do not include containerRef/contentWrapperRef here as they are refs
      // and don't trigger re-creation of the callback. Access them directly inside.
    ]
  );

  // *** UPDATED: Scrolling Logic (Adopted from MarkdownViewer) ***
  const attemptScrollToHighlight = useCallback(
    (highlight: HighlightType | null) => {
      const scope = contentWrapperRef.current || containerRef.current; // Search within content first
      if (!scope || !highlight || !highlight.id) return;

      const highlightId = highlight.id;
      // Target the specific ID class added by highlightTextInElement
      const selector = `.highlight-${highlightId}`;
      const highlightElement = scope.querySelector(selector); // Find the *specific* span

      if (highlightElement) {
        // console.log(`Scrolling to HTML highlight ID: ${highlightId}`);
        // Deactivate other highlights
        scope.querySelectorAll('.html-highlight-active').forEach((el) => {
          el.classList.remove('html-highlight-active');
          el.classList.remove('htmlHighlightPulse'); // Remove pulse if active
          el.classList.remove('htmlHighlightPulseFuzzy');
        });
        // Activate the target highlight
        highlightElement.classList.add('html-highlight-active');
        // Add pulse animation based on type
        if (highlightElement.classList.contains('html-highlight-fuzzy')) {
          highlightElement.classList.add('htmlHighlightPulseFuzzy');
        } else {
          highlightElement.classList.add('htmlHighlightPulse');
        }

        // Use scrollIntoView - options ensure visibility within the scrollable container
        highlightElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      } else {
        console.warn(
          `HTML highlight element with ID ${highlightId} not found for scrolling using selector "${selector}". It might not have been successfully applied or was cleared.`
        );
        // Option: Trigger re-highlighting if element is missing? Be careful...
        if (!highlightingInProgressRef.current && processedCitations.length > 0) {
          console.log('Attempting re-highlight on scroll failure.');
          applyTextHighlights(processedCitations);
        }
      }
    },
    [processedCitations, applyTextHighlights] // Include processedCitations if re-highlight logic is added
  );

  const scrollToHighlight = useCallback(
    (highlight: HighlightType | null): void => {
      if (!containerRef.current || !highlight || !highlight.id) return;
      // console.log('ScrollToHighlight called for ID:', highlight.id);

      const attemptScroll = () => attemptScrollToHighlight(highlight);

      // Check if highlighting is in progress or hasn't been applied yet
      if (highlightingInProgressRef.current || !highlightsAppliedRef.current) {
        // console.log("Highlighting pending/in progress, waiting for 'highlightsapplied' event.");
        const onHighlightsApplied = () => {
          document.removeEventListener('highlightsapplied', onHighlightsApplied);
          // console.log(`'highlightsapplied' received. Scrolling for ${highlight.id}`);
          // Use a small timeout to allow DOM updates after event? Might not be needed with rAF.
          setTimeout(attemptScroll, 50); // Small delay can sometimes help rendering
        };
        // Add listener for the custom event dispatched by applyTextHighlights
        document.addEventListener('highlightsapplied', onHighlightsApplied);

        // If highlights *definitely* haven't been applied yet, and we're not busy, *trigger* them.
        // This is important if the sidebar click happens before initial highlights are done.
        if (
          !highlightsAppliedRef.current &&
          !highlightingInProgressRef.current &&
          processedCitations.length > 0
        ) {
          // console.log("Triggering highlight application before scroll.");
          applyTextHighlights(processedCitations);
        }
      } else {
        // Highlights should be ready, scroll directly.
        // console.log('Highlights should be ready. Scrolling directly.');
        attemptScroll();
      }
    },
    [processedCitations, applyTextHighlights, attemptScrollToHighlight] // Include dependencies
  );
  // --- End Highlighting logic functions ---

  // --- Process citations function (Adapted from MarkdownViewer) ---
  const processCitations = useCallback(() => {
    // Create a stable representation of citation content for comparison
    const currentCitationsContent = JSON.stringify(
      citations?.map((c) => normalizeText(c?.content)).sort() ?? []
    );

    // Check if already processing, no citations, or content hasn't changed AND highlights are applied
    if (
      processingCitationsRef.current ||
      !citations ||
      citations.length === 0 ||
      (currentCitationsContent === prevCitationsJsonRef.current && highlightsAppliedRef.current)
    ) {
      if (currentCitationsContent !== prevCitationsJsonRef.current) {
        // Content changed, update ref and mark for re-highlighting even if skipping processing now
        prevCitationsJsonRef.current = currentCitationsContent;
        highlightsAppliedRef.current = false;
        // console.log("HTML citation content changed, marked for re-highlighting.");
      }
      return;
    }

    processingCitationsRef.current = true;
    // console.log('Processing HTML citations...');

    try {
      const processed: ProcessedCitation[] = citations
        .map((citation) => {
          const highlight = processTextHighlight(citation); // Uses normalization
          if (highlight) {
            return { ...citation, highlight } as ProcessedCitation;
          }
          return null;
        })
        .filter((item): item is ProcessedCitation => item !== null);

      // console.log(`Processed ${processed.length} valid HTML citations for highlighting.`);
      setProcessedCitations(processed); // Update state
      prevCitationsJsonRef.current = currentCitationsContent; // Store processed content signature
      highlightsAppliedRef.current = false; // Reset flag, highlights need to be (re)applied

      // Trigger apply highlights *if* content is rendered and ready
      if (
        processed.length > 0 &&
        contentWrapperRef.current && // Check the content wrapper
        documentReady &&
        contentRenderedRef.current &&
        !highlightingInProgressRef.current
      ) {
        // console.log('HTML content rendered, triggering highlight application after processing citations.');
        // Apply immediately using rAF or minimal delay
        requestAnimationFrame(() => applyTextHighlights(processed));
        // setTimeout(() => applyTextHighlights(processed), 0);
      } else {
        // console.log('HTML content not ready or no citations, skipping automatic highlight application trigger.');
      }
    } catch (err) {
      console.error('Error processing HTML citations:', err);
    } finally {
      processingCitationsRef.current = false;
      // console.log('Processing HTML citations finished.');
    }
  }, [citations, documentReady, contentRenderedRef, applyTextHighlights]); // Dependencies

  // --- useEffect Hooks (Structured like MarkdownViewer) ---

  // STEP 1: Load and Sanitize HTML Content
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    setDocumentHtml('');
    setDocumentReady(false); // Mark as not ready initially
    contentRenderedRef.current = false; // Reset flags
    highlightsAppliedRef.current = false;
    prevCitationsJsonRef.current = '[]';
    clearHighlights(); // Clear previous highlights/cleanups

    if (contentWrapperRef.current) {
      contentWrapperRef.current.innerHTML = ''; // Clear previous rendered HTML
    }

    const loadAndProcessHtml = async () => {
      try {
        let rawHtml = '';
        if (initialHtml) {
          rawHtml = initialHtml;
        } else if (buffer) {
          if (buffer instanceof ArrayBuffer) {
            rawHtml = new TextDecoder().decode(buffer);
          } else {
            throw new Error('Provided buffer is not an ArrayBuffer.');
          }
        } else if (url) {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Fetch failed: ${response.statusText} (URL: ${url})`);
          rawHtml = await response.text();
        } else {
          console.log('No HTML content source provided, viewer will be empty.');
          rawHtml = ''; // Treat as empty content
        }

        // Sanitize HTML
        const sanitizedHtml = DOMPurify.sanitize(rawHtml, {
          USE_PROFILES: { html: true },
          // Allow common attributes, potentially target for links
          ADD_ATTR: ['target', 'id', 'class', 'style', 'href', 'src', 'alt', 'title'],
          // Allow basic formatting and structural tags
          ADD_TAGS: ['iframe', 'figure', 'figcaption'], // Add tags if needed
          // Forbid dangerous tags and attributes
          FORBID_TAGS: ['script', 'style', 'link', 'base'], // Keep style forbidden to avoid conflicts
          FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'autofocus'], // Forbid event handlers
          // Allow specific protocols for href/src
          ALLOWED_URI_REGEXP:
            /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
        });

        if (isMounted) {
          setDocumentHtml(sanitizedHtml); // Store sanitized HTML
          setLoading(false);
          // Don't set documentReady yet, wait for DOM rendering effect
        }
      } catch (err: any) {
        console.error('Error loading/sanitizing HTML:', err);
        if (isMounted) {
          setError(err.message || 'Failed to load or process HTML content.');
          setDocumentHtml('');
          setDocumentReady(false);
          setLoading(false);
        }
      }
    };

    loadAndProcessHtml();

    return () => {
      isMounted = false;
      // console.log("HTML source loading effect cleanup.");
    };
  }, [url, initialHtml, buffer, clearHighlights]); // Depend on sources and clearHighlights

  // STEP 2: Render Sanitized HTML into the DOM
  useEffect(() => {
    if (loading || error || !containerRef.current || documentReady) {
      // Don't render if loading, errored, container not ready, or already rendered
      return;
    }

    const container = containerRef.current;
    // Ensure container is empty before rendering
    // While it might be cleared in STEP 1, double-check here before adding new content
    if (contentWrapperRef.current && contentWrapperRef.current.parentNode === container) {
      container.removeChild(contentWrapperRef.current);
    }
    contentWrapperRef.current = null;

    try {
      // Create the wrapper div that will hold the content
      const contentDiv = document.createElement('div');
      contentDiv.className = 'html-rendered-content'; // Add class for styling via styled component
      contentDiv.innerHTML = documentHtml; // Inject the sanitized HTML

      // Append the content wrapper to the main container
      container.appendChild(contentDiv);
      contentWrapperRef.current = contentDiv; // Store ref to the content div

      // Now mark the document as ready for citation processing
      setDocumentReady(true);
      contentRenderedRef.current = true; // Mark content as being in the DOM
      // console.log('HTML content rendered into DOM. Document ready.');
    } catch (renderError) {
      console.error('Error rendering sanitized HTML to DOM:', renderError);
      setError('Failed to display HTML content.');
      setDocumentReady(false);
      contentRenderedRef.current = false;
    }

    // No cleanup needed here specifically for rendering,
    // STEP 1 handles clearing when dependencies change.
  }, [documentHtml, loading, error, documentReady]); // Depend on sanitized HTML, loading/error state

  // STEP 3: Add highlight styles
  useEffect(() => {
    if (!styleAddedRef.current) {
      createHighlightStyles();
      styleAddedRef.current = true;
      // console.log('HTML highlight styles added.');
    }
    // Cleanup managed by cleanupStylesRef
    return () => {
      if (cleanupStylesRef.current) {
        cleanupStylesRef.current();
        cleanupStylesRef.current = null;
        styleAddedRef.current = false;
        // console.log("HTML highlight styles cleanup executed.");
      }
    };
  }, [createHighlightStyles]); // Dependency on the memoized function

  // STEP 4: Process citations when content is ready OR citations change
  useEffect(() => {
    // Check if the document is ready (loaded and rendered)
    if (documentReady && contentRenderedRef.current) {
      // console.log("Document ready, processing citations (initial or change)...");
      processCitations();
    } else {
      // console.log("Document not ready, deferring citation processing.");
    }

    // This effect runs when:
    // 1. The document becomes ready (initial load/render complete).
    // 2. The citations prop itself changes identity.
    // 3. The processCitations function identity changes (should be stable due to useCallback).
    // The processCitations function internally checks if the *content* of citations changed.
  }, [documentReady, contentRenderedRef, citations, processCitations]);

  // STEP 5: Ensure highlights and styles are cleared on unmount
  useEffect(
    () => () => {
      // console.log('HtmlViewer unmounting, ensuring highlights and styles are cleared.');
      clearHighlights();
      // Ensure styles are removed if component unmounts before style effect cleanup runs
      if (cleanupStylesRef.current) {
        cleanupStylesRef.current();
        cleanupStylesRef.current = null;
        styleAddedRef.current = false;
      }
    },
    [clearHighlights] // Depend only on clearHighlights for cleanup
  );

  // --- Render logic ---
  return (
    <HtmlViewerContainer component={Paper} sx={sx}>
      {loading && (
        <LoadingOverlay>
          <CircularProgress size={40} sx={{ mb: 2 }} />
          <Typography variant="body1">Loading Document...</Typography>
        </LoadingOverlay>
      )}

      {error && !loading && (
        <ErrorOverlay>
          <Icon icon={alertCircleIcon} style={{ fontSize: 40, marginBottom: '16px' }} />
          <Typography variant="h6">Loading Error</Typography>
          <Typography variant="body1">{error}</Typography>
        </ErrorOverlay>
      )}

      {/* Container for main content and sidebar */}
      <Box
        sx={{
          display: 'flex',
          height: '100%',
          width: '100%',
          visibility: loading || error ? 'hidden' : 'visible', // Hide container until ready
        }}
      >
        {/* HTML Content Area */}
        <Box
          sx={{
            height: '100%',
            flexGrow: 1,
            // Adjust width based on sidebar presence (only after loading/error check)
            width:
              !loading && !error && processedCitations.length > 0 ? 'calc(100% - 280px)' : '100%',
            transition: 'width 0.3s ease-in-out',
            position: 'relative', // Needed for potential absolute positioned elements within HTML
            borderRight:
              !loading && !error && processedCitations.length > 0
                ? (theme: Theme) => `1px solid ${theme.palette.divider}`
                : 'none',
            overflow: 'hidden', // Prevent this box from scrolling, let child handle it
          }}
        >
          {/* The actual scrollable container with rendered HTML */}
          <HtmlContentContainer ref={containerRef}>
            {/* The contentWrapperRef div will be appended here by STEP 2 useEffect */}
            {/* Show message if loading finished without error but content is empty */}
            {!loading && !error && !documentHtml && documentReady && (
              <Typography sx={{ p: 3, color: 'text.secondary', textAlign: 'center', mt: 4 }}>
                No document content available to display.
              </Typography>
            )}
          </HtmlContentContainer>
        </Box>

        {/* Sidebar Area (Conditional) */}
        {!loading && !error && processedCitations.length > 0 && (
          <Box
            sx={{
              width: '280px', // Fixed width for the sidebar
              height: '100%',
              flexShrink: 0, // Prevent sidebar from shrinking
              overflowY: 'auto', // Allow sidebar itself to scroll if its content overflows
              // borderLeft: (theme: Theme) => `1px solid ${theme.palette.divider}`, // Border handled by content Box now
            }}
          >
            <CitationSidebar
              citations={processedCitations}
              scrollViewerTo={scrollToHighlight} // Pass the stable callback
            />
          </Box>
        )}
      </Box>
    </HtmlViewerContainer>
  );
};

export default HtmlViewer;
