import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface AccessibilityContextType {
  highContrast: boolean;
  toggleHighContrast: () => void;
  largeText: boolean;
  toggleLargeText: () => void;
  reducedMotion: boolean;
  toggleReducedMotion: () => void;
  screenReaderAnnounce: (
    message: string,
    politeness?: "polite" | "assertive"
  ) => void;
  focusableElements: HTMLElement[];
  registerFocusableElement: (element: HTMLElement) => void;
  unregisterFocusableElement: (element: HTMLElement) => void;
}

const AccessibilityContext = createContext<
  AccessibilityContextType | undefined
>(undefined);

interface AccessibilityProviderProps {
  children: ReactNode;
}

export const AccessibilityProvider: React.FC<AccessibilityProviderProps> = ({
  children,
}) => {
  // Load preferences from localStorage
  const [highContrast, setHighContrast] = useState(() => {
    const saved = localStorage.getItem("accessibility_highContrast");
    return saved ? JSON.parse(saved) : false;
  });

  const [largeText, setLargeText] = useState(() => {
    const saved = localStorage.getItem("accessibility_largeText");
    return saved ? JSON.parse(saved) : false;
  });

  const [reducedMotion, setReducedMotion] = useState(() => {
    const saved = localStorage.getItem("accessibility_reducedMotion");
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    return saved ? JSON.parse(saved) : prefersReducedMotion;
  });

  const [focusableElements, setFocusableElements] = useState<HTMLElement[]>([]);

  // Apply high contrast mode
  useEffect(() => {
    if (highContrast) {
      document.documentElement.classList.add("high-contrast");
    } else {
      document.documentElement.classList.remove("high-contrast");
    }
    localStorage.setItem(
      "accessibility_highContrast",
      JSON.stringify(highContrast)
    );
  }, [highContrast]);

  // Apply large text mode
  useEffect(() => {
    if (largeText) {
      document.documentElement.classList.add("large-text");
    } else {
      document.documentElement.classList.remove("large-text");
    }
    localStorage.setItem("accessibility_largeText", JSON.stringify(largeText));
  }, [largeText]);

  // Apply reduced motion mode
  useEffect(() => {
    if (reducedMotion) {
      document.documentElement.classList.add("reduced-motion");
    } else {
      document.documentElement.classList.remove("reduced-motion");
    }
    localStorage.setItem(
      "accessibility_reducedMotion",
      JSON.stringify(reducedMotion)
    );
  }, [reducedMotion]);

  // Create or get the screen reader announcement element
  const getAnnouncementElement = () => {
    let element = document.getElementById("screen-reader-announcement");

    if (!element) {
      element = document.createElement("div");
      element.id = "screen-reader-announcement";
      element.className = "sr-only";
      element.setAttribute("aria-live", "polite");
      element.setAttribute("aria-atomic", "true");
      document.body.appendChild(element);
    }

    return element;
  };

  // Function to announce messages to screen readers
  const screenReaderAnnounce = (
    message: string,
    politeness: "polite" | "assertive" = "polite"
  ) => {
    const element = getAnnouncementElement();
    element.setAttribute("aria-live", politeness);

    // Clear the element first, then set the new message
    // This ensures screen readers will announce the new message
    element.textContent = "";

    // Use setTimeout to ensure the DOM update happens in separate ticks
    setTimeout(() => {
      element.textContent = message;
    }, 50);
  };

  // Register a focusable element
  const registerFocusableElement = (element: HTMLElement) => {
    setFocusableElements((prev) => {
      if (!prev.includes(element)) {
        return [...prev, element];
      }
      return prev;
    });
  };

  // Unregister a focusable element
  const unregisterFocusableElement = (element: HTMLElement) => {
    setFocusableElements((prev) => prev.filter((el) => el !== element));
  };

  // Toggle functions
  const toggleHighContrast = () => setHighContrast((prev) => !prev);
  const toggleLargeText = () => setLargeText((prev) => !prev);
  const toggleReducedMotion = () => setReducedMotion((prev) => !prev);

  // Add keyboard navigation for focusable elements
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Tab key navigation is handled by the browser

      // Add custom keyboard shortcuts
      if (e.altKey && e.key === "c") {
        toggleHighContrast();
        screenReaderAnnounce(
          `High contrast mode ${highContrast ? "disabled" : "enabled"}`
        );
      }

      if (e.altKey && e.key === "t") {
        toggleLargeText();
        screenReaderAnnounce(
          `Large text mode ${largeText ? "disabled" : "enabled"}`
        );
      }

      if (e.altKey && e.key === "m") {
        toggleReducedMotion();
        screenReaderAnnounce(
          `Reduced motion mode ${reducedMotion ? "disabled" : "enabled"}`
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [highContrast, largeText, reducedMotion]);

  return (
    <AccessibilityContext.Provider
      value={{
        highContrast,
        toggleHighContrast,
        largeText,
        toggleLargeText,
        reducedMotion,
        toggleReducedMotion,
        screenReaderAnnounce,
        focusableElements,
        registerFocusableElement,
        unregisterFocusableElement,
      }}
    >
      {children}

      {/* Add global styles for accessibility */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }

        /* High contrast mode styles */
        .high-contrast {
          --background-color: #000;
          --text-color: #fff;
          --primary-color: #ffff00;
          --secondary-color: #00ffff;
          --border-color: #fff;
        }

        .high-contrast body {
          background-color: var(--background-color);
          color: var(--text-color);
        }

        .high-contrast a, .high-contrast button {
          color: var(--primary-color);
        }

        /* Large text mode styles */
        .large-text {
          font-size: 120%;
        }

        .large-text h1 {
          font-size: 2.5rem;
        }

        .large-text h2 {
          font-size: 2rem;
        }

        .large-text h3 {
          font-size: 1.75rem;
        }

        .large-text p, .large-text li, .large-text label, .large-text input, .large-text button {
          font-size: 1.2rem;
        }

        /* Reduced motion mode styles */
        .reduced-motion * {
          animation-duration: 0.001ms !important;
          transition-duration: 0.001ms !important;
        }
      `,
        }}
      />
    </AccessibilityContext.Provider>
  );
};

// Hook to use accessibility features
export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error(
      "useAccessibility must be used within an AccessibilityProvider"
    );
  }
  return context;
};
