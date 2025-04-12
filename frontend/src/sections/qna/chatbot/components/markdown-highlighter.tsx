import type { Theme } from '@mui/material';
import type { Components } from 'react-markdown';
import type { CustomCitation } from 'src/types/chat-bot';
import type { DocumentContent } from 'src/sections/knowledgebase/types/search-response';
import type { Position, HighlightType, ProcessedCitation } from 'src/types/pdf-highlighter';

import remarkGfm from 'remark-gfm';
import { Icon } from '@iconify/react';
import ReactMarkdown from 'react-markdown';
import React, { useRef, useState, useEffect, useCallback } from 'react';

import { styled } from '@mui/material/styles';
import { Box, Paper, Typography, CircularProgress } from '@mui/material';

import CitationSidebar from './highlighter-sidebar';

// Props type definition - updated to include buffer
type MarkdownViewerProps = {
  citations: DocumentContent[] | CustomCitation[];
  url: string | null;
  content?: string | null;
  buffer?: ArrayBuffer | null; // Added buffer support
  sx?: Record<string, unknown>;
};

// Styled components
const ViewerContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  height: '100%',
  position: 'relative',
  overflow: 'hidden',
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`, // Added subtle border
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
  backgroundColor: 'rgba(255, 255, 255, 0.8)', // Slightly transparent
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
  backgroundColor: theme.palette.error.lighter,
  color: theme.palette.error.dark,
  padding: theme.spacing(2),
  textAlign: 'center',
  zIndex: 10,
}));

const DocumentContainer = styled(Box)({
  width: '100%',
  height: '100%',
  overflow: 'auto',
  minHeight: '100px',
  padding: '1rem 1.5rem', // Increased padding
  '& p, & li, & blockquote': {
    // Improved readability
    lineHeight: 1.6,
  },
  '& h1, & h2, & h3, & h4, & h5, & h6': {
    // Margin adjustments
    marginTop: '1.5em',
    marginBottom: '0.8em',
  },
});

// Custom renderer to add IDs to elements (kept for potential fallback/structure)
const customRenderers = {
  // Keep existing renderers if they add value beyond IDs, otherwise remove if IDs are handled later
  // Example: If you need specific styling via components prop
} as Components;

// Helper function to generate unique IDs
const getNextId = (): string => `md-hl-${Math.random().toString(36).substring(2, 10)}`;

// Helper type guard
const isDocumentContent = (
  citation: DocumentContent | CustomCitation
): citation is DocumentContent => 'metadata' in citation && citation.metadata !== undefined;

// Process citation
const processTextHighlight = (citation: DocumentContent | CustomCitation): HighlightType | null => {
  try {
    if (
      !citation.content ||
      typeof citation.content !== 'string' ||
      citation.content.trim().length < 5
    ) {
      // Min length check
      // console.warn('Citation missing or has short content, skipping highlight:', citation);
      return null;
    }

    let id: string;
    // Prioritize explicit IDs if available
    if ('highlightId' in citation && citation.highlightId) {
      id = citation.highlightId as string;
    } else if (isDocumentContent(citation) && citation.metadata?._id) {
      id = citation.metadata._id;
    } else if ('id' in citation && citation.id) {
      id = citation.id as string;
    } else if ('_id' in citation && citation._id) {
      id = citation._id as string;
    } else if ('citationId' in citation && citation.citationId) {
      id = citation.citationId as string;
    } else {
      id = getNextId(); // Generate a unique ID if none is found
    }

    // Default Position (less relevant for pure text highlighting)
    const position: Position = {
      pageNumber: 1,
      boundingRect: { x1: 0, y1: 0, x2: 0, y2: 0, width: 0, height: 0 },
      rects: [],
    };

    return {
      content: { text: citation.content.trim() }, // Trim whitespace
      position,
      comment: { text: '', emoji: '' }, // Keep comment structure if needed later
      id,
    };
  } catch (error) {
    console.error('Error processing highlight for citation:', citation, error);
    return null;
  }
};

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  url,
  content: initialContent,
  buffer,
  sx = {},
  citations = [],
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [documentReady, setDocumentReady] = useState<boolean>(false);
  const [processedCitations, setProcessedCitations] = useState<ProcessedCitation[]>([]);

  // Refs to manage state without causing re-renders
  const styleAddedRef = useRef<boolean>(false);
  const processingCitationsRef = useRef<boolean>(false);
  const contentRenderedRef = useRef<boolean>(false);
  const highlightsAppliedRef = useRef<boolean>(false);
  const highlightingInProgressRef = useRef<boolean>(false);
  const cleanupStylesRef = useRef<(() => void) | null>(null);
  const prevCitationsJsonRef = useRef<string>('[]'); // Store stringified version for comparison

  // Create highlight styles function
  const createHighlightStyles = useCallback((): (() => void) | undefined => {
    const styleId = 'markdown-highlight-styles';
    if (document.getElementById(styleId)) return undefined; // Already added

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .markdown-highlight {
        background-color: rgba(255, 224, 130, 0.5); /* Lighter yellow */
        border-radius: 3px;
        padding: 0.1em 0; /* Slight vertical padding */
        margin: -0.1em 0; /* Counteract padding */
        cursor: pointer;
        transition: background-color 0.3s ease, box-shadow 0.3s ease;
        display: inline; /* Ensure it doesn't break block elements */
        box-shadow: 0 0 0 0px rgba(255, 179, 0, 0.3); /* Initial shadow transparent */
        position: relative; /* Needed for z-index */
        z-index: 1;
      }

      .markdown-highlight:hover {
        background-color: rgba(255, 213, 79, 0.7); /* Slightly darker on hover */
        box-shadow: 0 0 0 2px rgba(255, 179, 0, 0.3);
        z-index: 2;
      }

      .markdown-highlight-active {
        background-color: rgba(255, 179, 0, 0.8) !important; /* Amber/Orange for active */
        box-shadow: 0 0 0 3px rgba(255, 111, 0, 0.4) !important;
        font-weight: 600; /* Slightly bolder */
        z-index: 3 !important;
        animation: highlightPulse 1.2s 1 ease-out;
      }

      @keyframes highlightPulse {
        0% { box-shadow: 0 0 0 3px rgba(255, 111, 0, 0.4); }
        50% { box-shadow: 0 0 0 6px rgba(255, 111, 0, 0.1); }
        100% { box-shadow: 0 0 0 3px rgba(255, 111, 0, 0.4); }
      }

      /* Match type styles */
      .markdown-highlight-exact {
         /* Uses base style, maybe slightly different border? */
         /* border-bottom: 1px solid rgba(255, 179, 0, 0.7); */
      }

      .markdown-highlight-fuzzy {
         background-color: rgba(173, 216, 230, 0.5); /* Light blue */
         /* border-bottom: 1px dashed rgba(70, 130, 180, 0.6); */
      }
      .markdown-highlight-fuzzy:hover {
         background-color: rgba(135, 206, 250, 0.7);
      }
      .markdown-highlight-fuzzy.markdown-highlight-active {
         background-color: rgba(70, 130, 180, 0.8) !important; /* Steel Blue */
         box-shadow: 0 0 0 3px rgba(0, 71, 171, 0.4) !important;
      }

      /* Ensure highlights preserve line breaks */
      .markdown-highlight {
        white-space: pre-wrap !important;
      }
    `;
    document.head.appendChild(style);

    const cleanup = (): void => {
      const styleElement = document.getElementById(styleId);
      if (styleElement) {
        document.head.removeChild(styleElement);
        console.log('Removed highlight styles.');
      }
    };
    cleanupStylesRef.current = cleanup; // Store cleanup function
    return cleanup;
  }, []);

  // Helper function to calculate text similarity (simple word overlap)
  const calculateSimilarity = (text1: string, text2: string): number => {
    if (!text1 || !text2) return 0;
    const words1 = new Set(
      text1
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );
    const words2 = new Set(
      text2
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );
    if (words1.size === 0 || words2.size === 0) return 0;
    let intersectionSize = 0;
    words1.forEach((word) => {
      if (words2.has(word)) intersectionSize += 1;
    });
    return intersectionSize / Math.max(words1.size, words2.size); // Jaccard index variant
  };

  const highlightTextInElement = (
    element: Element,
    textToHighlight: string,
    highlightId: string,
    matchType: 'exact' | 'fuzzy' = 'exact'
  ): { success: boolean; cleanup?: () => void } => {
    if (!element || !textToHighlight || textToHighlight.length < 3 || !element.textContent) {
      return { success: false };
    }

    const highlightClass = `markdown-highlight highlight-${highlightId} markdown-highlight-${matchType}`;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodesToWrap: { node: Text; startIndex: number; endIndex: number }[] = [];
    let found = false;

    // Try to find the exact text within text nodes
    // Try to find the exact text within text nodes
    let nodeEl: Node | null; // Declare node outside the loop
    while (true) {
      // Loop indefinitely initially
      nodeEl = walker.nextNode(); // Perform assignment inside the loop body
      if (!nodeEl) {
        // Check if the assignment resulted in null (end of nodes)
        break; // Exit the loop
      }

      // Now 'node' is guaranteed to be a Node, not null
      const textNode = nodeEl as Text; // You might still need the assertion if walker isn't typed precisely
      const nodeText = textNode.nodeValue || '';
      const startIndex = nodeText.indexOf(textToHighlight);

      if (startIndex !== -1) {
        nodesToWrap.push({
          node: textNode,
          startIndex,
          endIndex: startIndex + textToHighlight.length,
        });
        found = true;
        break; // Simple case: found the whole text in one node
      }
      // TODO: Add logic here to handle text split across multiple nodes if needed
    }

    if (found && nodesToWrap.length > 0) {
      const { node: textNode, startIndex, endIndex } = nodesToWrap[0];
      try {
        const range = document.createRange();
        range.setStart(textNode, startIndex);
        range.setEnd(textNode, endIndex);

        const span = document.createElement('span');
        span.className = highlightClass;
        span.dataset.highlightId = highlightId; // Add data attribute

        // --- Click Handler ---
        span.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent triggering clicks on parent elements
          console.log(`Highlight clicked: ${highlightId}`);

          // Remove active class from others
          containerRef.current?.querySelectorAll('.markdown-highlight-active').forEach((el) => {
            el.classList.remove('markdown-highlight-active');
          });

          // Add active class to this one
          span.classList.add('markdown-highlight-active');

          // Optional: Scroll into view smoothly
          span.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

          // Dispatch custom event if needed by other parts of the app
          // document.dispatchEvent(new CustomEvent('highlightactivated', { detail: { highlightId } }));
        });

        range.surroundContents(span); // Wrap the text

        // Return success and a cleanup function
        const cleanup = () => {
          if (span.parentNode) {
            const text = document.createTextNode(span.textContent || '');
            span.parentNode.replaceChild(text, span);
          }
        };
        return { success: true, cleanup };
      } catch (wrapError) {
        console.error(
          `Error wrapping text for highlight ${highlightId}:`,
          wrapError,
          'Text:',
          textToHighlight,
          'Node:',
          textNode
        );
        // Attempt to restore original state if surroundContents failed badly
        // (More complex restoration might be needed depending on the error)
        return { success: false };
      }
    }
    // Fallback for fuzzy: Wrap the whole element if it was deemed the best fuzzy match
    else if (matchType === 'fuzzy') {
      // Only wrap if it doesn't already contain a highlight to avoid nesting issues
      if (element.querySelector('.markdown-highlight')) {
        console.warn(
          `Skipping fuzzy wrap for ${highlightId} as element already contains highlights.`
        );
        return { success: false };
      }
      try {
        const span = document.createElement('span');
        span.className = highlightClass;
        span.dataset.highlightId = highlightId;

        // --- Click Handler (duplicate for fuzzy wrapper) ---
        span.addEventListener('click', (e) => {
          e.stopPropagation();
          console.log(`Highlight clicked (fuzzy wrapper): ${highlightId}`);
          containerRef.current?.querySelectorAll('.markdown-highlight-active').forEach((el) => {
            el.classList.remove('markdown-highlight-active');
          });
          span.classList.add('markdown-highlight-active');
          span.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        });

        // Move all children into the new span
        while (element.firstChild) {
          span.appendChild(element.firstChild);
        }
        element.appendChild(span);

        // Return success and cleanup for the wrapper
        const cleanup = () => {
          if (span.parentNode === element) {
            while (span.firstChild) {
              element.insertBefore(span.firstChild, span);
            }
            element.removeChild(span);
          }
        };
        return { success: true, cleanup };
      } catch (wrapError) {
        console.error(`Error wrapping element for fuzzy highlight ${highlightId}:`, wrapError);
        return { success: false };
      }
    }

    return { success: false }; // Not found or failed
  };

  // Store cleanup functions for applied highlights
  const highlightCleanupsRef = useRef<Map<string, () => void>>(new Map());

  const applyTextHighlights = useCallback(
    (citationsToHighlight: ProcessedCitation[]): void => {
      if (
        !containerRef.current ||
        highlightingInProgressRef.current ||
        !documentReady ||
        !contentRenderedRef.current
      ) {
        console.log('Skipping applyTextHighlights', {
          highlightingInProgress: highlightingInProgressRef.current,
          documentReady,
          contentRendered: contentRenderedRef.current,
        });
        return;
      }

      highlightingInProgressRef.current = true;
      console.log(`Starting applyTextHighlights for ${citationsToHighlight.length} citations.`);

      // 1. Clear existing highlights *before* applying new ones
      clearHighlights(); // Uses the useCallback version

      // Use setTimeout to allow DOM changes from clearHighlights to settle
      setTimeout(() => {
        try {
          if (!containerRef.current) {
            // Check ref again inside timeout
            console.error('Container ref lost during applyTextHighlights timeout.');
            highlightingInProgressRef.current = false;
            return;
          }

          let appliedCount = 0;
          const newCleanups = new Map<string, () => void>();

          // Select candidate elements once
          const selector =
            'p, li, blockquote, h1, h2, h3, h4, h5, h6, span:not(:has(span)), div:not(:has(*))'; // Select text-holding elements
          const textElements = Array.from(containerRef.current.querySelectorAll(selector));

          if (textElements.length === 0) {
            console.warn('No candidate text elements found in container for highlighting.');
          } else {
            // console.log(`Found ${textElements.length} candidate elements.`);
          }

          citationsToHighlight.forEach((citation) => {
            if (!citation.highlight?.content?.text || !citation.highlight.id) return;

            const {text} = citation.highlight.content;
            const highlightId = citation.highlight.id;
            let success = false;

            // --- Exact Match Attempt ---
            // Sort candidates by text length similarity for better targeting
            const sortedElements = [...textElements].sort(
              (a, b) =>
                Math.abs((a.textContent?.length || 0) - text.length) -
                Math.abs((b.textContent?.length || 0) - text.length)
            );

            // Assuming sortedElements is an array or array-like (e.g., NodeList)
            // with a .length property and indexed access.
            for (let i = 0; i < sortedElements.length; i+=1) {
              const element = sortedElements[i]; // Get the current element by index

              // Check if the text is potentially present first
              if (element.textContent?.includes(text)) {
                // Check the conditions that would have caused a 'continue'.
                // We only proceed if NEITHER of these conditions is true.
                const alreadyHighlightedInside = !!element.querySelector(
                  `.highlight-${highlightId}`
                ); // Use !! for explicit boolean
                const parentAlreadyHighlighted = !!(
                  element.parentNode as Element
                )?.classList?.contains(`highlight-${highlightId}`);

                // Proceed only if it's NOT already highlighted inside AND the parent is NOT already highlighted
                if (!alreadyHighlightedInside && !parentAlreadyHighlighted) {
                  // --- This is the block that executes if we DON'T skip ---
                  const result = highlightTextInElement(element, text, highlightId, 'exact');
                  if (result.success) {
                    // console.log(`Exact highlight applied: ${highlightId}`);
                    appliedCount += 1;
                    success = true;
                    if (result.cleanup) newCleanups.set(highlightId, result.cleanup);
                    // Remove element from further consideration? Maybe not needed.
                    // textElements.splice(textElements.indexOf(element), 1);

                    // break still works perfectly in a traditional for loop
                    break; // Found exact match, move to next citation
                  }
                }
              }
            }
            // --- Fuzzy Match Fallback ---
            // (rest of your code)
            // --- Fuzzy Match Fallback ---
            if (!success && textElements.length > 0) {
              const similarityScores = textElements
                .map((el) => ({
                  element: el,
                  score: calculateSimilarity(text, el.textContent || ''),
                }))
                .filter((item) => item.score > 0.4) // Similarity threshold
                .sort((a, b) => b.score - a.score); // Best score first

              if (similarityScores.length > 0) {
                const bestMatch = similarityScores[0];
                // Avoid highlighting if it already contains a highlight span for THIS ID or parent has it
                //  if (bestMatch.element.querySelector(`.highlight-${highlightId}`)) continue;
                //  if ((bestMatch.element.parentNode as Element)?.classList?.contains(`highlight-${highlightId}`)) continue;

                // console.log(`Attempting fuzzy match for ${highlightId} with score ${bestMatch.score.toFixed(2)}`);
                const result = highlightTextInElement(
                  bestMatch.element,
                  text,
                  highlightId,
                  'fuzzy'
                ); // Pass original text for context, but wrap element
                if (result.success) {
                  // console.log(`Fuzzy highlight applied: ${highlightId}`);
                  appliedCount += 1; // Count fuzzy matches too
                  success = true;
                  if (result.cleanup) newCleanups.set(highlightId, result.cleanup);
                  // Remove element?
                  // textElements.splice(textElements.indexOf(bestMatch.element), 1);
                }
              }
            }

            // if (!success) {
            //     console.warn(`Could not find suitable location for highlight: ${highlightId} (Text: ${text.substring(0, 50)}...)`);
            // }
          });

          // Update the cleanup refs
          highlightCleanupsRef.current = newCleanups;

          console.log(`Finished applyTextHighlights. Applied ${appliedCount} highlights.`);
          highlightsAppliedRef.current = appliedCount > 0; // Mark as applied only if some were successful

          // Dispatch event after highlights are potentially added
          document.dispatchEvent(new CustomEvent('highlightsapplied'));
        } catch (e) {
          console.error('Error during applyTextHighlights execution:', e);
          highlightsAppliedRef.current = false; // Ensure flag is false on error
        } finally {
          highlightingInProgressRef.current = false; // Ensure flag is reset
        }
      }, 100); // Delay to allow DOM updates after clearHighlights
    },
    // eslint-disable-next-line
    [documentReady, contentRenderedRef.current]
  ); // Dependencies

  const clearHighlights = useCallback(() => {
    if (!containerRef.current) return;
    highlightingInProgressRef.current = true; // Prevent application while clearing
    console.log('Clearing highlights...');

    // Use the stored cleanup functions
    highlightCleanupsRef.current.forEach((cleanup, id) => {
      try {
        // console.log(`Running cleanup for highlight: ${id}`);
        cleanup();
      } catch (e) {
        console.error(`Error running cleanup for highlight ${id}:`, e);
      }
    });
    highlightCleanupsRef.current.clear(); // Clear the map after running cleanups

    // Fallback: Force remove any remaining highlight spans if cleanup failed
    const remainingSpans = containerRef.current.querySelectorAll('.markdown-highlight');
    if (remainingSpans.length > 0) {
      console.warn(
        `Found ${remainingSpans.length} highlights remaining after cleanup, attempting force removal.`
      );
      remainingSpans.forEach((span) => {
        if (span.parentNode) {
          const textContent = span.textContent || '';
          try {
            span.parentNode.replaceChild(document.createTextNode(textContent), span);
          } catch (replaceError) {
            console.error('Error during force removal of span:', replaceError, span);
            // As a last resort, just remove the node if replacement fails
            if (span.parentNode) span.parentNode.removeChild(span);
          }
        }
      });
    }

    // Remove active classes just in case
    containerRef.current.querySelectorAll('.markdown-highlight-active').forEach((el) => {
      el.classList.remove('markdown-highlight-active');
    });

    highlightsAppliedRef.current = false;
    highlightingInProgressRef.current = false;
    console.log('Finished clearing highlights.');
  }, []); // No dependencies needed as it operates on refs and DOM

  const attemptScrollToHighlight = useCallback(
    (highlight: HighlightType | null) => {
      if (!containerRef.current || !highlight || !highlight.id) {
        console.log('AttemptScrollToHighlight: Invalid input or container ref.');
        return;
      }

      const highlightId = highlight.id;
      const selector = `.highlight-${highlightId}`; // Target the specific highlight span
      console.log(
        `Attempting to find and scroll to highlight ID: ${highlightId} using selector: ${selector}`
      );

      const highlightElement = containerRef.current.querySelector(selector);

      if (highlightElement) {
        console.log(
          `Found highlight element for ID ${highlightId}. Scrolling...`,
          highlightElement
        );

        // Deactivate previously active highlight
        containerRef.current.querySelectorAll('.markdown-highlight-active').forEach((el) => {
          el.classList.remove('markdown-highlight-active');
        });

        // Activate the target highlight
        highlightElement.classList.add('markdown-highlight-active');

        // Scroll into view
        highlightElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center', // Try 'center' for better visibility
          inline: 'nearest',
        });
      } else {
        console.warn(
          `Highlight element with ID ${highlightId} not found using selector "${selector}".`
        );
        // Optional: List available highlight IDs for debugging
        const availableHighlights = Array.from(
          containerRef.current.querySelectorAll('.markdown-highlight')
        )
          .map((el) => el.classList.toString()) // Get class list
          .join(', ');
        console.log('Available highlight classes in container:', availableHighlights || 'None');

        // Maybe trigger re-application if not found? Be careful of loops.
        // Consider if this should only happen once.
        // if (!highlightingInProgressRef.current) {
        //    console.log(`Highlight ${highlightId} not found, attempting to re-apply all highlights.`);
        //    applyTextHighlights(processedCitations);
        //    // Setup listener to try scrolling again AFTER re-application
        //     const onApplied = () => {
        //         document.removeEventListener('highlightsapplied', onApplied);
        //         console.log(`Highlights re-applied, retrying scroll for ${highlightId}`);
        //         setTimeout(() => attemptScrollToHighlight(highlight), 100); // Slight delay after event
        //     };
        //     document.addEventListener('highlightsapplied', onApplied);
        // }
      }
    },
    // eslint-disable-next-line
    [processedCitations]
  ); // Re-create if processedCitations changes

  const scrollToHighlight = useCallback(
    (highlight: HighlightType | null): void => {
      if (!containerRef.current || !highlight || !highlight.id) {
        console.log('ScrollToHighlight: Invalid input.');
        return;
      }
      console.log('ScrollToHighlight called for ID:', highlight.id);

      // If highlights haven't been applied yet, or we suspect they might be missing
      if (
        !highlightsAppliedRef.current &&
        processedCitations.length > 0 &&
        !highlightingInProgressRef.current
      ) {
        console.log('Highlights not marked as applied. Applying before scrolling...');

        // Define the listener first
        const onHighlightsApplied = () => {
          document.removeEventListener('highlightsapplied', onHighlightsApplied);
          console.log(
            `'highlightsapplied' event received. Proceeding with scroll for ${highlight.id}`
          );
          // Use a small timeout to let rendering potentially finish after the event
          setTimeout(() => attemptScrollToHighlight(highlight), 50);
        };

        // Add the listener *before* potentially triggering the application
        document.addEventListener('highlightsapplied', onHighlightsApplied);

        // Apply highlights (which will dispatch 'highlightsapplied' when done)
        applyTextHighlights(processedCitations);
      } else if (highlightingInProgressRef.current) {
        // If highlights are currently being applied, wait for them to finish
        console.log("Highlighting is in progress. Waiting for 'highlightsapplied' event...");
        const onHighlightsApplied = () => {
          document.removeEventListener('highlightsapplied', onHighlightsApplied);
          console.log(
            `'highlightsapplied' event received after waiting. Proceeding with scroll for ${highlight.id}`
          );
          setTimeout(() => attemptScrollToHighlight(highlight), 50);
        };
        document.addEventListener('highlightsapplied', onHighlightsApplied);
      } else {
        // Highlights seem to be applied, attempt scrolling directly
        console.log('Highlights marked as applied or none exist. Attempting scroll directly...');
        attemptScrollToHighlight(highlight);
      }
    },
    [processedCitations, applyTextHighlights, attemptScrollToHighlight]
  ); // Dependencies

  // Process citations function (mostly unchanged, ensure it uses the correct state)
  const processCitations = useCallback(() => {
    // Avoid processing if already processing or no citations
    const currentCitationsJson = JSON.stringify(citations?.map((c) => c?.content ?? '').sort());
    if (
      processingCitationsRef.current ||
      !citations ||
      citations.length === 0 ||
      currentCitationsJson === prevCitationsJsonRef.current
    ) {
      // console.log("Skipping processCitations", { processing: processingCitationsRef.current, length: citations?.length, changed: currentCitationsJson !== prevCitationsJsonRef.current });
      if (currentCitationsJson !== prevCitationsJsonRef.current && citations.length > 0) {
        prevCitationsJsonRef.current = currentCitationsJson; // Update if citations changed but processing was skipped before
      }
      return;
    }

    processingCitationsRef.current = true;
    console.log('Processing citations started...');

    try {
      const processed: ProcessedCitation[] = citations
        .map((citation) => {
          const highlight = processTextHighlight(citation);
          if (highlight) {
            // Ensure the ProcessedCitation type includes the highlight
            // (Assuming CustomCitation also has fields like DocumentContent or can be cast)
            return { ...citation, highlight } as ProcessedCitation;
          }
          return null;
        })
        .filter((item): item is ProcessedCitation => item !== null); // Type guard filter

      console.log(`Processed ${processed.length} citations into highlight objects.`);
      setProcessedCitations(processed);
      prevCitationsJsonRef.current = currentCitationsJson; // Update ref after processing

      // Mark highlights as needing application
      highlightsAppliedRef.current = false;

      // Trigger application if content is ready
      if (
        processed.length > 0 &&
        containerRef.current &&
        documentReady &&
        contentRenderedRef.current
      ) {
        console.log('Content ready, triggering highlight application from processCitations.');
        // Use setTimeout to ensure this runs after state update and current execution context
        setTimeout(() => applyTextHighlights(processed), 0);
      } else {
        console.log('Content not ready, skipping automatic highlight application trigger.', {
          docReady: documentReady,
          contentRendered: contentRenderedRef.current,
        });
      }
    } catch (err) {
      console.error('Error processing citations:', err);
    } finally {
      processingCitationsRef.current = false;
      console.log('Processing citations finished.');
    }
    // eslint-disable-next-line
  }, [citations, documentReady, contentRenderedRef.current, applyTextHighlights]); // Add dependencies

  // STEP 1: Load markdown content
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    setMarkdownContent('');
    setDocumentReady(false);
    contentRenderedRef.current = false; // Reset content rendered flag on new load
    highlightsAppliedRef.current = false; // Reset highlight applied flag

    const loadContent = async () => {
      try {
        let loadedMd = '';
        if (initialContent) {
          loadedMd = initialContent;
        } else if (buffer) {
          loadedMd = new TextDecoder().decode(buffer);
        } else if (url) {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
          loadedMd = await response.text();
        } else {
          // No content source, maybe display a message or default text?
          setError('No content source provided (URL, content, or buffer).');
          setLoading(false);
          return; // Exit early
        }

        if (isMounted) {
          setMarkdownContent(loadedMd);
          setDocumentReady(true); // Mark document structure as ready
          setLoading(false);
          console.log('Markdown content loaded and ready.');
        }
      } catch (err: any) {
        console.error('Error loading markdown:', err);
        if (isMounted) {
          setError(err.message || 'Failed to load markdown content.');
          setLoading(false);
        }
      }
    };

    loadContent();

    return () => {
      isMounted = false; // Prevent state updates on unmounted component
    };
  }, [url, initialContent, buffer]); // Re-run if source changes

  // STEP 2: Add highlight styles
  useEffect(() => {
    if (!styleAddedRef.current) {
      createHighlightStyles();
      styleAddedRef.current = true;
      console.log('Highlight styles added.');
    }
    // Return the cleanup function stored in the ref
    return () => {
      if (cleanupStylesRef.current) {
        cleanupStylesRef.current();
        styleAddedRef.current = false; // Reset for potential remount?
      }
    };
  }, [createHighlightStyles]); // Run only once

  // STEP 3: Mark content as rendered after ReactMarkdown finishes
  // This relies on ReactMarkdown rendering synchronously after `markdownContent` updates.
  // We use a short timeout to increase the chance the DOM is updated.
  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined; // Use appropriate type for timeout ID

    // Condition to run the effect's main logic
    if (documentReady && !contentRenderedRef.current) {
      timerId = setTimeout(() => {
        // Assign the timer ID
        if (containerRef.current?.querySelector('p, h1, li')) {
          // Check if content exists
          console.log('Content appears rendered in DOM.');
          contentRenderedRef.current = true;
          // Now that content is rendered, process citations if they exist
          if (!processingCitationsRef.current && citations.length > 0) {
            console.log('Content rendered, triggering citation processing.');
            processCitations();
          }
        } else if (documentReady) {
          console.warn('Document ready, but content not detected in DOM yet.');
          // Might need a more robust check or longer timeout if markdown is very large
        }
      }, 100); // Adjust timeout if needed, 0 might work too
    }

    // Reset logic can run regardless of the timer setup
    if (!documentReady) {
      contentRenderedRef.current = false;
    }

    // Always return a cleanup function.
    // This function will only clear the timeout if timerId was actually set.
    return () => {
      if (timerId) {
        // Check if the timeout was created in this effect run
        if (timerId) {
          clearTimeout(timerId);
        }
      }
    };
    // Add processingCitationsRef to dependencies if its value changing should trigger re-processing
  }, [
    documentReady,
    markdownContent,
    citations,
    processCitations,
    containerRef,
    processingCitationsRef,
  ]);

  // STEP 4: Re-process citations if the `citations` prop changes
  useEffect(() => {
    const currentCitationsJson = JSON.stringify(citations?.map((c) => c?.content ?? '').sort());
    // Process only if document is ready, content is rendered, and citations actually changed
    if (
      documentReady &&
      contentRenderedRef.current &&
      currentCitationsJson !== prevCitationsJsonRef.current
    ) {
      console.log('Citations prop changed, re-processing...');
      clearHighlights(); // Clear old highlights before processing new ones
      processCitations();
    }
    // eslint-disable-next-line
  }, [citations, documentReady, contentRenderedRef.current, processCitations, clearHighlights]);

  // Ensure highlights are cleared on unmount
  useEffect(
    () => () => {
      console.log('MarkdownViewer unmounting, clearing highlights.');
      clearHighlights();
    },
    [clearHighlights]
  ); // Depend on the memoized clearHighlights

  return (
    <ViewerContainer component={Paper} sx={sx}>
      {loading && (
        <LoadingOverlay>
          <CircularProgress size={40} sx={{ mb: 2 }} />
          <Typography variant="body1">Loading Document...</Typography>
        </LoadingOverlay>
      )}

      {error && !loading && (
        <ErrorOverlay>
          <Icon icon="mdi:alert-circle-outline" style={{ fontSize: 40, marginBottom: 16 }} />
          <Typography variant="h6">Loading Error</Typography>
          <Typography variant="body1">{error}</Typography>
        </ErrorOverlay>
      )}

      {/* Use visibility hidden instead of conditional rendering for containerRef stability */}
      <Box
        sx={{
          display: 'flex',
          height: '100%',
          visibility: loading || error ? 'hidden' : 'visible',
        }}
      >
        <Box
          sx={{
            height: '100%',
            // Adjust width based on whether sidebar will be shown
            width: processedCitations.length > 0 ? 'calc(100% - 280px)' : '100%', // Example width calculation
            transition: 'width 0.3s ease-in-out', // Smooth transition if sidebar appears/disappears
            position: 'relative', // Needed for potential internal absolute positioning
            borderRight:
              processedCitations.length > 0
                ? `1px solid ${(theme: Theme) => theme.palette.divider}`
                : 'none',
          }}
        >
          <DocumentContainer ref={containerRef}>
            {/* Render markdown only when ready to ensure containerRef is stable */}
            {documentReady && markdownContent && (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={customRenderers}>
                {markdownContent}
              </ReactMarkdown>
            )}
            {/* Show message if no content and not loading/error */}
            {!loading && !error && !markdownContent && (
              <Typography sx={{ p: 3, color: 'text.secondary' }}>
                No document content available.
              </Typography>
            )}
          </DocumentContainer>
        </Box>

        {/* Conditionally render sidebar */}
        {processedCitations.length > 0 && !loading && !error && (
          <CitationSidebar
            citations={processedCitations}
            // Pass the memoized scrollToHighlight function
            scrollViewerTo={scrollToHighlight}
          />
        )}
      </Box>
    </ViewerContainer>
  );
};

export default MarkdownViewer;
