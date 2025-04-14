// Add this to your browser console to debug React event handlers
(function() {
  // Check if React DevTools are available
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log('React DevTools detected. Attempting to debug React events...');
    
    // Get React instance
    const reactInstance = window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers;
    if (reactInstance && reactInstance.size > 0) {
      const firstRenderer = reactInstance.get(1);
      
      if (firstRenderer && firstRenderer.currentDispatcherRef) {
        console.log('React instance found. Debugging React events...');
        
        // Try to monkey patch React's event system
        try {
          const originalDispatchEvent = firstRenderer.currentDispatcherRef.current.useState;
          
          firstRenderer.currentDispatcherRef.current.useState = function(...args) {
            const result = originalDispatchEvent.apply(this, args);
            
            // If the second element is a function (setState), wrap it
            if (typeof result[1] === 'function') {
              const originalSetState = result[1];
              
              result[1] = function(...setStateArgs) {
                console.log('useState setter called with:', setStateArgs);
                console.trace('useState setter stack trace');
                return originalSetState.apply(this, setStateArgs);
              };
            }
            
            return result;
          };
          
          console.log('Successfully patched React useState for debugging');
        } catch (error) {
          console.error('Failed to patch React event system:', error);
        }
      }
    }
  }
  
  // Check for synthetic events
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (listener && listener.name && listener.name.includes('__reactEventHandler')) {
      console.log(`React synthetic event handler for '${type}' added to:`, this);
    }
    
    return originalAddEventListener.call(this, type, listener, options);
  };
  
  console.log('Event debugging for React events enabled.');
})();
