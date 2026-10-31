import { createContext, useContext } from "react";

export const ScrollRootContext = createContext(null);

export const ScrollRootProvider = ({ rootRef, children }) => (
  <ScrollRootContext.Provider value={rootRef}>
    {children}
  </ScrollRootContext.Provider>
);

export const useScrollRoot = () => useContext(ScrollRootContext);
