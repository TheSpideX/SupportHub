// Add this to your browser console to debug event propagation issues
(function() {
  // Track all click events
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
  
  // Override addEventListener
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (type === 'click' || type === 'mousedown' || type === 'mouseup') {
      const wrappedListener = function(event) {
        console.log(`Event '${type}' on:`, this);
        console.log(`Event propagation stopped:`, event.cancelBubble);
        console.log(`Default prevented:`, event.defaultPrevented);
        return listener.apply(this, arguments);
      };
      
      return originalAddEventListener.call(this, type, wrappedListener, options);
    } else {
      return originalAddEventListener.call(this, type, listener, options);
    }
  };
  
  // Log all stopPropagation calls
  const originalStopPropagation = Event.prototype.stopPropagation;
  Event.prototype.stopPropagation = function() {
    console.warn('Event propagation stopped at:', this.currentTarget);
    console.trace('Stack trace for stopPropagation');
    return originalStopPropagation.apply(this, arguments);
  };
  
  // Log all preventDefault calls
  const originalPreventDefault = Event.prototype.preventDefault;
  Event.prototype.preventDefault = function() {
    console.warn('Default prevented at:', this.currentTarget);
    console.trace('Stack trace for preventDefault');
    return originalPreventDefault.apply(this, arguments);
  };
  
  console.log('Event debugging enabled. Click on elements to see event propagation.');
})();
