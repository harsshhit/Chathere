import { createContext } from "react";

export const ChatContext = createContext();
export const ContactPanelContext = createContext({});
export const ContactPanelActionsContext = createContext({});
export const UserChatsContext = createContext({});
export const UserChatsMetadataContext = createContext({});
export const UserUnreadContext = createContext({});
export const UserDocumentContext = createContext({});
export const UserDocumentLoadedContext = createContext(null);
export const UserChatsLoadedContext = createContext(null);
