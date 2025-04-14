import React, { useEffect, useRef } from 'react';

interface FocusTrapProps {
  children: React.ReactNode;
  active?: boolean;
  initialFocus?: React.RefObject<HTMLElement>;
}

const FocusTrap: React.FC<FocusTrapProps> = ({ 
  children, 
  active = true,
  initialFocus
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!active) return;
    
    // Get all focusable elements
    const getFocusableElements = () => {
      if (!rootRef.current) return [];
      
      return Array.from(
        rootRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ) as HTMLElement[];
    };
    
    // Set initial focus
    const setInitialFocus = () => {
      if (initialFocus && initialFocus.current) {
        initialFocus.current.focus();
      } else {
        const focusableElements = getFocusableElements();
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        }
      }
    };
    
    // Handle tab key to trap focus
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;
      
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      
      // If shift+tab and on first element, move to last element
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } 
      // If tab and on last element, move to first element
      else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };
    
    // Save the previously focused element
    const previouslyFocused = document.activeElement as HTMLElement;
    
    // Set initial focus after a small delay to ensure DOM is ready
    setTimeout(setInitialFocus, 50);
    
    // Add event listener
    document.addEventListener('keydown', handleKeyDown);
    
    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      
      // Restore focus when unmounted
      if (previouslyFocused && previouslyFocused.focus) {
        previouslyFocused.focus();
      }
    };
  }, [active, initialFocus]);
  
  return (
    <div ref={rootRef} style={{ outline: 'none' }}>
      {children}
    </div>
  );
};

export default FocusTrap;
