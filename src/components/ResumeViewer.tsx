import React, { useState, useEffect, useRef } from 'react';
import { Check, X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';

export interface MappedSuggestion {
  id: string;
  originalText: string;
  suggestedText: string;
  reason: string;
  category: 'bullet' | 'skill' | 'summary' | 'experience' | 'other';
  status: 'pending' | 'accepted' | 'rejected' | 'modified';
  modifiedText?: string;
  startPos: number;
  endPos: number;
}

interface ResumeViewerProps {
  htmlContent: string;
  suggestions: MappedSuggestion[];
  onAcceptSuggestion: (suggestionId: string) => void;
  onRejectSuggestion: (suggestionId: string) => void;
  onEditSuggestion?: (suggestionId: string, newText: string) => void;
  showInlineEditor?: boolean;
}

export const ResumeViewer: React.FC<ResumeViewerProps> = ({
  htmlContent,
  suggestions,
  onAcceptSuggestion,
  onRejectSuggestion
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [hoveredSuggestion, setHoveredSuggestion] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [touchStartDistance, setTouchStartDistance] = useState<number | null>(null);

  // Auto-fit content to container width on mount and resize
  useEffect(() => {
    const fitToContainer = () => {
      if (containerRef.current && contentRef.current) {
        const container = containerRef.current;
        const content = contentRef.current;
        
        // Get the first page element from pdf2htmlEX
        const pageElement = content.querySelector('.pf, .pc, [class*="page"]') as HTMLElement;
        if (pageElement) {
          const pageWidth = pageElement.offsetWidth;
          const containerWidth = container.clientWidth - 32; // Subtract padding
          
          if (pageWidth > 0) {
            const fitScale = containerWidth / pageWidth;
            setScale(Math.min(fitScale, 1.5)); // Max 150% scale
          }
        }
      }
    };

    // Fit on mount
    setTimeout(fitToContainer, 100);

    // Fit on window resize
    window.addEventListener('resize', fitToContainer);
    return () => window.removeEventListener('resize', fitToContainer);
  }, [htmlContent]);

  // Inject styles for highlighting suggestions
  useEffect(() => {
    if (!contentRef.current) return;

    // Create style element for suggestion highlights
    const styleId = 'resume-viewer-highlights';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;
    
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    // Generate CSS for each suggestion
    const highlightStyles = suggestions.map(suggestion => {
      const color = suggestion.applied 
        ? 'rgba(34, 197, 94, 0.3)' // green
        : suggestion.rejected 
        ? 'rgba(239, 68, 68, 0.2)' // red
        : 'rgba(29, 224, 221, 0.3)'; // cyan
      
      return `
        .suggestion-${suggestion.id} {
          background-color: ${color};
          cursor: pointer;
          position: relative;
          transition: background-color 0.2s;
        }
        
        .suggestion-${suggestion.id}:hover {
          background-color: ${suggestion.applied 
            ? 'rgba(34, 197, 94, 0.5)' 
            : suggestion.rejected 
            ? 'rgba(239, 68, 68, 0.3)'
            : 'rgba(29, 224, 221, 0.5)'};
        }
      `;
    }).join('\n');

    styleElement.textContent = `
      ${highlightStyles}
      
      /* Ensure pdf2htmlEX content is properly contained */
      .resume-viewer-content {
        transform-origin: top left;
      }
      
      /* Preserve pdf2htmlEX positioning */
      .resume-viewer-content > * {
        position: relative !important;
      }
      
      /* Tooltip styles */
      .suggestion-tooltip {
        position: absolute;
        z-index: 1000;
        pointer-events: none;
        filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));
      }
    `;

    return () => {
      if (styleElement && styleElement.parentNode) {
        styleElement.parentNode.removeChild(styleElement);
      }
    };
  }, [suggestions]);

  // Apply suggestion highlights to the HTML content
  const processedHtmlContent = React.useMemo(() => {
    if (!htmlContent || suggestions.length === 0) return htmlContent;

    let processedHtml = htmlContent;
    
    // Sort suggestions by position (reverse order to avoid position shifts)
    const sortedSuggestions = [...suggestions].sort((a, b) => b.startPos - a.startPos);
    
    // Wrap suggested text with highlight spans
    sortedSuggestions.forEach(suggestion => {
      // Only highlight if not yet applied or rejected
      const textToHighlight = suggestion.originalText;
      const highlightClass = `suggestion-${suggestion.id}`;
      
      // Create a wrapper span with data attributes
      const wrapper = `<span 
        class="${highlightClass}" 
        data-suggestion-id="${suggestion.id}"
        data-original="${encodeURIComponent(suggestion.originalText)}"
        data-suggested="${encodeURIComponent(suggestion.suggestedText)}"
        data-reason="${encodeURIComponent(suggestion.reason)}"
      >${textToHighlight}</span>`;
      
      // Simple replacement - in production, you'd want more sophisticated text matching
      processedHtml = processedHtml.replace(textToHighlight, wrapper);
    });
    
    return processedHtml;
  }, [htmlContent, suggestions]);

  // Handle zoom controls
  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.5));
  const handleZoomReset = () => setScale(1);

  // Handle pinch-to-zoom on mobile
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const getDistance = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        setTouchStartDistance(getDistance(e.touches));
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchStartDistance) {
        e.preventDefault();
        const currentDistance = getDistance(e.touches);
        const scaleFactor = currentDistance / touchStartDistance;
        setScale(prev => Math.min(Math.max(prev * scaleFactor, 0.5), 2));
        setTouchStartDistance(currentDistance);
      }
    };

    const handleTouchEnd = () => {
      setTouchStartDistance(null);
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [touchStartDistance]);

  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Handle click on suggestions
  useEffect(() => {
    const handleSuggestionClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const suggestionElement = target.closest('[data-suggestion-id]') as HTMLElement;
      
      if (suggestionElement) {
        const suggestionId = suggestionElement.dataset.suggestionId;
        if (suggestionId) {
          setSelectedSuggestion(suggestionId);
          e.stopPropagation();
        }
      }
    };

    const handleClickOutside = () => {
      setSelectedSuggestion(null);
    };

    contentRef.current?.addEventListener('click', handleSuggestionClick);
    document.addEventListener('click', handleClickOutside);

    return () => {
      contentRef.current?.removeEventListener('click', handleSuggestionClick);
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Handle hover on suggestions
  useEffect(() => {
    const handleSuggestionHover = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const suggestionElement = target.closest('[data-suggestion-id]') as HTMLElement;
      
      if (suggestionElement) {
        const suggestionId = suggestionElement.dataset.suggestionId;
        setHoveredSuggestion(suggestionId || null);
      } else {
        setHoveredSuggestion(null);
      }
    };

    contentRef.current?.addEventListener('mousemove', handleSuggestionHover);
    
    return () => {
      contentRef.current?.removeEventListener('mousemove', handleSuggestionHover);
    };
  }, []);

  // Get suggestion details
  const getSelectedSuggestion = () => {
    return suggestions.find(s => s.id === selectedSuggestion);
  };

  const getHoveredSuggestion = () => {
    return suggestions.find(s => s.id === hoveredSuggestion);
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-gray-100 dark:bg-gray-800 overflow-hidden"
    >
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-white dark:bg-gray-900 rounded-lg shadow-lg p-1">
        <button
          onClick={handleZoomOut}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomReset}
          className="px-3 py-1 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          title="Reset Zoom"
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          onClick={handleZoomIn}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-700" />
        <button
          onClick={toggleFullscreen}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          title="Fullscreen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Resume Content */}
      <div className="w-full h-full overflow-auto p-4">
        <div 
          ref={contentRef}
          className="resume-viewer-content mx-auto"
          style={{ 
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            width: 'fit-content'
          }}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(processedHtmlContent) }}
        />
      </div>

      {/* Suggestion Tooltip on Hover */}
      <AnimatePresence>
        {hoveredSuggestion && !selectedSuggestion && getHoveredSuggestion() && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="suggestion-tooltip absolute bg-gray-900 text-white text-xs rounded-lg p-3 max-w-xs"
            style={{
              left: '50%',
              bottom: '20px',
              transform: 'translateX(-50%)',
              pointerEvents: 'none'
            }}
          >
            <p className="font-medium mb-1">Suggestion:</p>
            <p className="text-gray-300">{getHoveredSuggestion()?.reason}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Suggestion Action Modal */}
      <AnimatePresence>
        {selectedSuggestion && getSelectedSuggestion() && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black bg-opacity-50 z-30 flex items-center justify-center p-4"
            onClick={() => setSelectedSuggestion(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                AI Suggestion
              </h3>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Original:</p>
                  <p className="text-sm bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-100 p-2 rounded">
                    {getSelectedSuggestion()?.originalText}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Suggested:</p>
                  <p className="text-sm bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-100 p-2 rounded">
                    {getSelectedSuggestion()?.suggestedText}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Reason:</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {getSelectedSuggestion()?.reason}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    onAcceptSuggestion(selectedSuggestion);
                    setSelectedSuggestion(null);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Accept
                </button>
                <button
                  onClick={() => {
                    onRejectSuggestion(selectedSuggestion);
                    setSelectedSuggestion(null);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Reject
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};