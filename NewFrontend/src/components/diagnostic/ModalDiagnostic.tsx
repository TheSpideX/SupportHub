import React, { useEffect } from 'react';

interface ModalDiagnosticProps {
  isOpen: boolean;
}

/**
 * A diagnostic component that helps identify modal interaction issues
 */
const ModalDiagnostic: React.FC<ModalDiagnosticProps> = ({ isOpen }) => {
  useEffect(() => {
    if (isOpen) {
      console.log('ModalDiagnostic: Running diagnostics...');
      
      // Check for event blockers
      const allElements = document.querySelectorAll('*');
      const pointerEventsNoneElements = [];
      
      allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.pointerEvents === 'none') {
          pointerEventsNoneElements.push({
            element: el,
            tag: el.tagName,
            id: el.id,
            class: el.className
          });
        }
      });
      
      console.log('Elements with pointer-events: none:', pointerEventsNoneElements);
      
      // Check for viewport-covering elements
      const viewportCoveringElements = [];
      
      allElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        
        // Check if element covers most of the viewport
        if (
          rect.width >= window.innerWidth * 0.9 &&
          rect.height >= window.innerHeight * 0.9 &&
          style.position !== 'static' &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        ) {
          viewportCoveringElements.push({
            element: el,
            tag: el.tagName,
            id: el.id,
            class: el.className,
            zIndex: style.zIndex,
            position: style.position
          });
        }
      });
      
      console.log('Elements potentially covering the viewport:', viewportCoveringElements);
      
      // Check for high z-index elements
      const highZIndexElements = [];
      
      allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        const zIndex = parseInt(style.zIndex);
        if (!isNaN(zIndex) && zIndex > 10) {
          highZIndexElements.push({
            element: el,
            tag: el.tagName,
            id: el.id,
            class: el.className,
            zIndex: zIndex,
            position: style.position,
            pointerEvents: style.pointerEvents
          });
        }
      });
      
      // Sort by z-index
      highZIndexElements.sort((a, b) => b.zIndex - a.zIndex);
      
      console.log('High z-index elements:', highZIndexElements);
      
      // Check body and html styles
      const bodyStyle = window.getComputedStyle(document.body);
      const htmlStyle = window.getComputedStyle(document.documentElement);
      
      console.log('Body styles - overflow:', bodyStyle.overflow, 'position:', bodyStyle.position);
      console.log('HTML styles - overflow:', htmlStyle.overflow, 'position:', htmlStyle.position);
      
      console.log('ModalDiagnostic: Diagnostics complete');
    }
  }, [isOpen]);
  
  // This component doesn't render anything
  return null;
};

export default ModalDiagnostic;
