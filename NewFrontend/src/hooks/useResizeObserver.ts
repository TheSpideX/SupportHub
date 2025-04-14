import { useEffect, useState, useRef } from 'react';

interface ResizeObserverEntry {
  contentRect: DOMRectReadOnly;
  target: Element;
}

export function useResizeObserver<T extends HTMLElement>() {
  const [dimensions, setDimensions] = useState<DOMRectReadOnly | null>(null);
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ref.current) return;
    
    const observeTarget = ref.current;
    const resizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]) => {
      entries.forEach(entry => {
        setDimensions(entry.contentRect);
      });
    });

    resizeObserver.observe(observeTarget);
    
    return () => {
      resizeObserver.unobserve(observeTarget);
    };
  }, [ref]);

  return { ref, dimensions };
}
