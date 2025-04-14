// Add this to your browser console to debug overlay issues
(function() {
  // Find all elements with high z-index
  const allElements = document.querySelectorAll('*');
  const highZIndexElements = [];
  
  allElements.forEach(el => {
    const style = window.getComputedStyle(el);
    const zIndex = parseInt(style.zIndex);
    if (!isNaN(zIndex) && zIndex > 10) {
      highZIndexElements.push({
        element: el,
        zIndex: zIndex,
        position: style.position,
        display: style.display,
        pointerEvents: style.pointerEvents
      });
    }
  });
  
  // Sort by z-index
  highZIndexElements.sort((a, b) => b.zIndex - a.zIndex);
  
  // Log the results
  console.table(highZIndexElements.map(item => ({
    tag: item.element.tagName,
    id: item.element.id,
    class: item.element.className,
    zIndex: item.zIndex,
    position: item.position,
    pointerEvents: item.pointerEvents
  })));
  
  // Highlight the top 3 elements with high z-index
  highZIndexElements.slice(0, 3).forEach((item, index) => {
    const el = item.element;
    const originalBorder = el.style.border;
    const originalOutline = el.style.outline;
    
    // Add a visible border
    el.style.border = `3px solid ${index === 0 ? 'red' : index === 1 ? 'blue' : 'green'}`;
    el.style.outline = `2px dashed ${index === 0 ? 'red' : index === 1 ? 'blue' : 'green'}`;
    
    console.log(`Highlighted element #${index + 1}:`, el);
    
    // Restore original styles after 5 seconds
    setTimeout(() => {
      el.style.border = originalBorder;
      el.style.outline = originalOutline;
    }, 5000);
  });
})();
