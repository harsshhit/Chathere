import { createContext, useContext } from 'react';

// UIContext is kept minimal — navigation is URL-driven.
// isMobileView state has been removed; layout is determined by CSS breakpoints + URL.
// Components should use useNavigate() for navigation and read the :chatId param from the URL.
export const UIContext = createContext({});

export const UIProvider = ({ children }) => (
  <UIContext.Provider value={{}}>
    {children}
  </UIContext.Provider>
);

export const useUI = () => useContext(UIContext);
