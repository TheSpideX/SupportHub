import React, { createContext, useContext, useState } from "react";

interface ModalStateContextType {
  isAnyModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

const ModalStateContext = createContext<ModalStateContextType>({
  isAnyModalOpen: false,
  openModal: () => {},
  closeModal: () => {},
});

export const useModalState = () => {
  return useContext(ModalStateContext);
};

export const ModalStateProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isAnyModalOpen, setIsAnyModalOpen] = useState(false);

  const openModal = () => {
    setIsAnyModalOpen(true);
  };

  const closeModal = () => {
    setIsAnyModalOpen(false);
  };

  return (
    <ModalStateContext.Provider
      value={{ isAnyModalOpen, openModal, closeModal }}
    >
      {/* Hidden debug element to expose modal state to DOM for cross-component access */}
      <div
        id="modal-state-debug"
        data-is-open={isAnyModalOpen.toString()}
        style={{ display: "none" }}
        aria-hidden="true"
      />
      {children}
    </ModalStateContext.Provider>
  );
};

export default ModalStateProvider;
