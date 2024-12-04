import { createContext, useState, useContext } from 'react';

export const UIContext = createContext();

export const UIProvider = ({ children }) => {
  const [isMobileView, setIsMobileView] = useState(true);

  return (
    <UIContext.Provider value={{ isMobileView, setIsMobileView }}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => useContext(UIContext); 