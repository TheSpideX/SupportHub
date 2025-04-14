import React, { useEffect } from "react";
import { useModalState } from "@/context/ModalStateContext";
import ModalDiagnostic from "@/components/diagnostic/ModalDiagnostic";

interface TestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * A minimal test modal to isolate the issue
 */
const TestModal: React.FC<TestModalProps> = ({ isOpen, onClose }) => {
  const { openModal, closeModal } = useModalState();

  // Update modal state when isOpen changes
  useEffect(() => {
    if (isOpen) {
      openModal();
    } else {
      closeModal();
    }
  }, [isOpen, openModal, closeModal]);
  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <ModalDiagnostic isOpen={isOpen} />
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
        }}
        onClick={onClose}
      >
        <div
          style={{
            backgroundColor: "#1f2937",
            padding: "20px",
            borderRadius: "8px",
            maxWidth: "500px",
            width: "100%",
            color: "white",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 style={{ marginTop: 0 }}>Test Modal</h2>
          <p>This is a minimal test modal to isolate the issue.</p>
          <p>Can you interact with this modal?</p>
          <input
            type="text"
            placeholder="Type something here..."
            style={{
              width: "100%",
              padding: "8px",
              backgroundColor: "#374151",
              border: "1px solid #4b5563",
              borderRadius: "4px",
              color: "white",
              marginBottom: "16px",
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={onClose}
              style={{
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                padding: "8px 16px",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default TestModal;
