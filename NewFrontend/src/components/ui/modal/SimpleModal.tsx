import React, { useEffect, useState, useRef } from "react";
import { useModalState } from "@/context/ModalStateContext";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/buttons/Button";

interface SimpleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  maxWidth?: string;
}

/**
 * A simple modal component that doesn't use Radix UI Dialog
 * This should avoid any potential issues with the Dialog component
 */
export const SimpleModal: React.FC<SimpleModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  className = "",
  maxWidth = "max-w-lg",
}) => {
  const [mounted, setMounted] = useState(false);
  const { openModal, closeModal } = useModalState();

  // Track whether this modal has been opened
  const hasOpenedRef = useRef(false);

  // Update modal state when isOpen changes
  useEffect(() => {
    // Only handle state changes when the isOpen prop actually changes
    if (isOpen && !hasOpenedRef.current) {
      hasOpenedRef.current = true;
      openModal();
      console.log("SimpleModal: Opened modal");
    } else if (!isOpen && hasOpenedRef.current) {
      hasOpenedRef.current = false;
      closeModal();
      console.log("SimpleModal: Closed modal");
    }

    // Cleanup function to ensure modal state is reset when component unmounts
    return () => {
      if (hasOpenedRef.current) {
        hasOpenedRef.current = false;
        closeModal();
        console.log("SimpleModal: Cleanup - closed modal");
      }
    };
  }, [isOpen, openModal, closeModal]);

  // Mount the component
  useEffect(() => {
    setMounted(true);

    // When modal is open, prevent body scrolling
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Handle clicking outside the modal
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!mounted || !isOpen) {
    return null;
  }

  return createPortal(
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={handleBackdropClick}
    >
      <div
        className={`relative bg-gray-900 text-white border border-gray-800 rounded-lg shadow-lg ${maxWidth} w-full max-h-[90vh] overflow-y-auto ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <Button
          className="absolute right-4 top-4 h-8 w-8 p-0 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </Button>

        {/* Header */}
        {(title || description) && (
          <div className="p-6 pb-0">
            {title && <h2 className="text-xl font-semibold mb-2">{title}</h2>}
            {description && (
              <p className="text-gray-400 text-sm">{description}</p>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body
  );
};

export default SimpleModal;
