// Add this to your browser console for comprehensive root cause analysis
(function() {
  console.log('Starting comprehensive root cause analysis...');
  
  // 1. Check for event blockers
  console.log('Checking for event blockers...');
  
  // Find elements with pointer-events: none
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
  
  // 2. Check for viewport-covering elements
  console.log('Checking for viewport-covering elements...');
  
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
  
  // 3. Check for high z-index elements
  console.log('Checking for high z-index elements...');
  
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
  
  // 4. Check for event listeners
  console.log('Checking for event listeners...');
  
  // This is a simplified version since getEventListeners is only available in DevTools
  const bodyClickListeners = document.body._events?.click?.length || 0;
  const documentClickListeners = document._events?.click?.length || 0;
  const windowClickListeners = window._events?.click?.length || 0;
  
  console.log('Click listeners count - Body:', bodyClickListeners, 'Document:', documentClickListeners, 'Window:', windowClickListeners);
  
  // 5. Check for React portals
  console.log('Checking for React portals...');
  
  const possiblePortalContainers = document.querySelectorAll('[data-reactroot], [data-reactid], [data-react-portal]');
  
  console.log('Possible React portal containers:', possiblePortalContainers);
  
  // 6. Check for modal elements
  console.log('Checking for modal elements...');
  
  const possibleModalElements = document.querySelectorAll('[role="dialog"], [aria-modal="true"], .modal, .dialog, [class*="modal"], [class*="dialog"]');
  
  console.log('Possible modal elements:', possibleModalElements);
  
  // 7. Check for body/html modifications
  console.log('Checking for body/html modifications...');
  
  const bodyStyle = window.getComputedStyle(document.body);
  const htmlStyle = window.getComputedStyle(document.documentElement);
  
  console.log('Body styles - overflow:', bodyStyle.overflow, 'position:', bodyStyle.position);
  console.log('HTML styles - overflow:', htmlStyle.overflow, 'position:', htmlStyle.position);
  
  // 8. Test click event propagation
  console.log('Testing click event propagation...');
  
  const testClickPropagation = () => {
    const testDiv = document.createElement('div');
    testDiv.style.position = 'fixed';
    testDiv.style.top = '50%';
    testDiv.style.left = '50%';
    testDiv.style.transform = 'translate(-50%, -50%)';
    testDiv.style.width = '200px';
    testDiv.style.height = '200px';
    testDiv.style.backgroundColor = 'red';
    testDiv.style.zIndex = '99999';
    testDiv.style.display = 'flex';
    testDiv.style.alignItems = 'center';
    testDiv.style.justifyContent = 'center';
    testDiv.style.color = 'white';
    testDiv.style.fontWeight = 'bold';
    testDiv.textContent = 'Click Me';
    
    testDiv.addEventListener('click', (e) => {
      console.log('Test div clicked!');
      console.log('Event propagation stopped:', e.cancelBubble);
      console.log('Default prevented:', e.defaultPrevented);
      
      // Remove after 1 second
      setTimeout(() => {
        document.body.removeChild(testDiv);
      }, 1000);
    });
    
    document.body.appendChild(testDiv);
    console.log('Test div added. Please click the red box.');
  };
  
  // Uncomment to test click propagation
  // testClickPropagation();
  
  console.log('Root cause analysis complete. Check the console for results.');
})();
