// Add this to your browser console to debug global event handlers
(function() {
  // Check for global click handlers
  const globalHandlers = [];
  
  // Check document handlers
  const documentEvents = getEventListeners(document);
  if (documentEvents.click) {
    globalHandlers.push({
      element: 'document',
      handlers: documentEvents.click.length
    });
  }
  
  // Check window handlers
  const windowEvents = getEventListeners(window);
  if (windowEvents.click) {
    globalHandlers.push({
      element: 'window',
      handlers: windowEvents.click.length
    });
  }
  
  // Check body handlers
  const bodyEvents = getEventListeners(document.body);
  if (bodyEvents.click) {
    globalHandlers.push({
      element: 'body',
      handlers: bodyEvents.click.length
    });
  }
  
  console.table(globalHandlers);
  
  // Check for event capturing at the document level
  const originalAddEventListener = document.addEventListener;
  document.addEventListener = function(type, listener, options) {
    if (options === true || (options && options.capture)) {
      console.warn(`Capturing event listener added for '${type}' on document`);
      console.trace('Stack trace for capturing event listener');
    }
    return originalAddEventListener.apply(this, arguments);
  };
  
  console.log('Global event handler debugging enabled.');
})();
