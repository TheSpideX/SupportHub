import React, { useEffect, useState, useRef } from "react";
import FocusTrap from "@/components/ui/FocusTrap";
import { useAccessibility } from "@/components/providers/AccessibilityProvider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface SafeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  className?: string;
  showCloseButton?: boolean;
  footer?: React.ReactNode;
}

/**
 * SafeModal - A wrapper around Dialog that handles state management more robustly
 * to prevent UI freezing and interaction issues.
 */
export const SafeModal: React.FC<SafeModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  className = "",
  showCloseButton = true,
  footer,
}) => {
  // Internal state to manage modal visibility
  const [internalOpen, setInternalOpen] = useState(false);
  const initialFocusRef = useRef<HTMLDivElement>(null);
  const { screenReaderAnnounce } = useAccessibility();

  // Sync internal state with external state
  useEffect(() => {
    if (isOpen) {
      setInternalOpen(true);
      // Announce to screen readers that a modal has opened
      screenReaderAnnounce(`Dialog opened: ${title || "Modal dialog"}`);
    } else {
      // Delay closing to ensure animations complete
      const timer = setTimeout(() => {
        setInternalOpen(false);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, title, screenReaderAnnounce]);

  // Handle close with debounce to prevent multiple triggers
  const handleClose = React.useCallback(() => {
    // Set a flag to prevent multiple close calls
    if (!isOpen) return;

    // Directly call onClose without any delays
    // This ensures we don't have any race conditions
    onClose();
  }, [isOpen, onClose]);

  return (
    <Dialog
      open={internalOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent
        className={`bg-gray-900 text-white border-gray-800 max-h-[85vh] overflow-y-auto py-8 ${className}`}
        aria-labelledby={title ? "dialog-title" : undefined}
        aria-describedby={description ? "dialog-description" : undefined}
      >
        <FocusTrap active={internalOpen} initialFocus={initialFocusRef}>
          <DialogHeader>
            <DialogTitle id="dialog-title" className="text-xl font-semibold">
              {title || <span className="sr-only">Dialog</span>}
            </DialogTitle>
            {description && (
              <DialogDescription
                id="dialog-description"
                className="text-gray-400"
              >
                {description}
              </DialogDescription>
            )}
          </DialogHeader>

          <div ref={initialFocusRef} tabIndex={-1} className="outline-none">
            {children}
          </div>

          {footer && <DialogFooter>{footer}</DialogFooter>}
        </FocusTrap>
      </DialogContent>
    </Dialog>
  );
};

export default SafeModal;
