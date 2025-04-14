import React, { useEffect, useState } from "react";
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
  title?: string;
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

  // Sync internal state with external state
  useEffect(() => {
    if (isOpen) {
      setInternalOpen(true);
    } else {
      // Delay closing to ensure animations complete
      const timer = setTimeout(() => {
        setInternalOpen(false);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

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
      >
        {title && (
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
            {description && (
              <DialogDescription className="text-gray-400">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>
        )}

        {children}

        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
};

export default SafeModal;
