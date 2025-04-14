import React, { createContext, useContext, useState, useCallback } from 'react';

interface ModalContextType {
  openModal: (id: string) => void;
  closeModal: (id: string) => void;
  isModalOpen: (id: string) => boolean;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [openModals, setOpenModals] = useState<Record<string, boolean>>({});

  const openModal = useCallback((id: string) => {
    setOpenModals(prev => ({ ...prev, [id]: true }));
  }, []);

  const closeModal = useCallback((id: string) => {
    // Use a timeout to ensure any state updates have time to propagate
    setTimeout(() => {
      setOpenModals(prev => ({ ...prev, [id]: false }));
    }, 0);
  }, []);

  const isModalOpen = useCallback((id: string) => {
    return !!openModals[id];
  }, [openModals]);

  return (
    <ModalContext.Provider value={{ openModal, closeModal, isModalOpen }}>
      {children}
    </ModalContext.Provider>
  );
};

export default ModalProvider;
