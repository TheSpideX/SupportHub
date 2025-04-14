// Add this to your browser console to debug CSS issues
(function() {
  // Find all elements with pointer-events: none
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
  
  // Find all elements that might be covering the entire viewport
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
  
  // Highlight viewport covering elements
  viewportCoveringElements.forEach((item, index) => {
    const el = item.element;
    const originalBackground = el.style.background;
    
    // Add a semi-transparent background
    el.style.background = `rgba(255, 0, 0, 0.2)`;
    
    console.log(`Highlighted viewport covering element #${index + 1}:`, el);
    
    // Restore original styles after 5 seconds
    setTimeout(() => {
      el.style.background = originalBackground;
    }, 5000);
  });
})();
