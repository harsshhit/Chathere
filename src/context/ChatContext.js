import { useContext, useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useLocation, matchPath } from "react-router-dom";
import { AuthContext } from "./AuthContext";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { cacheUserDocument, getUserDocument } from "../utils/userDocumentCache";

import {
  ChatContext,
  ContactPanelContext,
  ContactPanelActionsContext,
  UserChatsContext,
  UserChatsMetadataContext,
  UserUnreadContext,
  UserDocumentContext,
  UserDocumentLoadedContext,
} from "./ChatContexts";

export {
  ChatContext,
  ContactPanelContext,
  ContactPanelActionsContext,
  UserChatsContext,
  UserChatsMetadataContext,
  UserUnreadContext,
  UserDocumentContext,
  UserDocumentLoadedContext,
};

export const ChatContextProvider = ({ children }) => {
  const { currentUser } = useContext(AuthContext);
  const location = useLocation();

  // URL is the single source of truth for the active chatId
  const match = matchPath("/chat/:chatId", location.pathname);
  const urlChatId = match?.params?.chatId || null;

  const [activeUser, setActiveUser] = useState(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatNotFound, setChatNotFound] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [contactPanel, setContactPanel] = useState({ open: false, userId: null, user: null, history: [] });

  useEffect(() => {
    setReplyingTo(null);
    setEditingMessage(null);
    setForwardingMessage(null);
    setContactPanel({ open: false, userId: null, user: null, history: [] });
  }, [urlChatId]);

  const userChatsRef = useRef({});
  const [userChatsSnapshot, setUserChatsSnapshot] = useState({});
  const [userChatsLoaded, setUserChatsLoaded] = useState(false);
  const [userDocument, setUserDocument] = useState({});
  const [userDocumentLoaded, setUserDocumentLoaded] = useState(null);
  const userChatsMetadataRef = useRef({ signature: null, value: {} });
  const userUnreadRef = useRef({ signature: null, value: {} });

  const userChatsMetadata = useMemo(() => {
    const metadata = Object.fromEntries(
      Object.entries(userChatsSnapshot).map(([chatId, chat]) => {
        const { unread, ...chatMetadata } = chat || {};
        return [chatId, chatMetadata];
      })
    );
    const signature = JSON.stringify(metadata);
    if (signature === userChatsMetadataRef.current.signature) return userChatsMetadataRef.current.value;
    userChatsMetadataRef.current = { signature, value: metadata };
    return metadata;
  }, [userChatsSnapshot]);

  const userUnread = useMemo(() => {
    const unreadByChat = Object.fromEntries(
      Object.entries(userChatsSnapshot).map(([chatId, chat]) => [chatId, Number(chat?.unread) || 0])
    );
    const signature = JSON.stringify(unreadByChat);
    if (signature === userUnreadRef.current.signature) return userUnreadRef.current.value;
    userUnreadRef.current = { signature, value: unreadByChat };
    return unreadByChat;
  }, [userChatsSnapshot]);

  useEffect(() => {
    setUserDocumentLoaded(null);
    if (!currentUser?.uid) {
      setUserDocument({});
      return undefined;
    }

    const unsub = onSnapshot(
      doc(db, "users", currentUser.uid),
      (docSnap) => {
        const userData = docSnap.exists() ? docSnap.data() || {} : {};
        cacheUserDocument(currentUser.uid, userData);
        setUserDocument(userData);
        setUserDocumentLoaded(currentUser.uid);
      },
      (err) => {
        console.error("current user document snapshot error:", err);
      }
    );

    return () => unsub();
  }, [currentUser?.uid]);

  // Subscribe to the current user's userChats collection
  useEffect(() => {
    setUserChatsLoaded(false);
    userChatsRef.current = {};
    setUserChatsSnapshot({});
    if (!currentUser?.uid) {
      return;
    }

    const unsub = onSnapshot(
      doc(db, "userChats", currentUser.uid),
      (docSnap) => {
        if (docSnap.exists()) {
          userChatsRef.current = docSnap.data() || {};
        } else {
          userChatsRef.current = {};
        }
        setUserChatsSnapshot(userChatsRef.current);
        setUserChatsLoaded(true);
      },
      (err) => {
        console.error("userChats snapshot error:", err);
        setUserChatsLoaded(true);
      }
    );

    return () => unsub();
  }, [currentUser?.uid]);

  const activeUserRef = useRef(activeUser);
  activeUserRef.current = activeUser;

  // Derive active chat whenever the URL param or userChats change
  useEffect(() => {
    if (!urlChatId) {
      setActiveUser(null);
      setLoadingChat(false);
      setChatNotFound(false);
      return;
    }

    if (!userChatsLoaded) {
      setLoadingChat(true);
      return;
    }

    // 1. Look up directly in userChats/{uid}
    const chatFromUserChats = userChatsRef.current[urlChatId];
    if (chatFromUserChats?.userInfo) {
      setActiveUser(chatFromUserChats.userInfo);
      setLoadingChat(false);
      setChatNotFound(false);
      return;
    }

    // 2. If activeUser was primed locally right before navigation
    const primedUser = activeUserRef.current;
    if (primedUser) {
      const isMatching1on1 =
        currentUser?.uid &&
        primedUser.uid &&
        (urlChatId === currentUser.uid + primedUser.uid ||
          urlChatId === primedUser.uid + currentUser.uid);
      const isMatchingGroup = primedUser.uid === urlChatId;

      if (isMatching1on1 || isMatchingGroup) {
        setLoadingChat(false);
        setChatNotFound(false);
        return;
      }
    }

    // 3. Fallback / Refresh / Deep Link: fetch info from Firestore
    let isCancelled = false;
    setLoadingChat(true);
    setChatNotFound(false);

    const resolveChat = async () => {
      try {
        // Group chat
        if (urlChatId.startsWith("group_")) {
          const chatDoc = await getDoc(doc(db, "chats", urlChatId));
          if (!isCancelled) {
            if (chatDoc.exists()) {
              const cd = chatDoc.data();
              setActiveUser(
                cd.userInfo || {
                  uid: urlChatId,
                  isGroup: true,
                  displayName: "Group",
                  members: cd.messages?.length ? [] : undefined,
                }
              );
              setChatNotFound(false);
            } else {
              setChatNotFound(true);
            }
            setLoadingChat(false);
          }
          return;
        }

        // 1-on-1 chat: derive the other participant's UID
        if (currentUser?.uid && urlChatId.includes(currentUser.uid)) {
          const otherUid = urlChatId.replace(currentUser.uid, "");
          if (otherUid) {
            const userData = await getUserDocument(otherUid);
            if (!isCancelled) {
              if (userData.uid || userData.displayName || userData.photoURL) {
                setActiveUser(userData);
                setChatNotFound(false);
              } else {
                const chatDoc = await getDoc(doc(db, "chats", urlChatId));
                if (chatDoc.exists()) {
                  setActiveUser({ uid: otherUid, displayName: "User" });
                  setChatNotFound(false);
                } else {
                  setChatNotFound(true);
                }
              }
              setLoadingChat(false);
            }
            return;
          }
        }

        // Generic fallback check
        const chatDoc = await getDoc(doc(db, "chats", urlChatId));
        if (!isCancelled) {
          if (chatDoc.exists()) {
            const cd = chatDoc.data();
            setActiveUser(cd.userInfo || { uid: urlChatId, displayName: "Conversation" });
            setChatNotFound(false);
          } else {
            setChatNotFound(true);
          }
          setLoadingChat(false);
        }
      } catch (err) {
        console.error("Error resolving chat from Firestore:", err);
        if (!isCancelled) {
          setChatNotFound(true);
          setLoadingChat(false);
        }
      }
    };

    resolveChat();

    return () => {
      isCancelled = true;
    };
  }, [urlChatId, userChatsLoaded, currentUser?.uid]);

  const dispatch = useCallback((action) => {
    switch (action.type) {
      case "CHANGE_USER":
        setActiveUser(action.payload);
        setChatNotFound(false);
        break;
      case "SET_CHAT":
        if (action.payload?.user) {
          setActiveUser(action.payload.user);
          setChatNotFound(false);
        }
        break;
      case "RESET":
        setActiveUser(null);
        setChatNotFound(false);
        break;
      default:
        break;
    }
  }, []);

  const openContactPanel = useCallback((user) => {
    if (!user?.uid) return;
    setContactPanel({ open: true, userId: user.uid, user, history: [] });
  }, []);

  const openContactPanelUser = useCallback((user) => {
    if (!user?.uid) return;
    setContactPanel((current) => ({
      open: true,
      userId: user.uid,
      user,
      history: current.open && current.user ? [...current.history, current.user] : [],
    }));
  }, []);

  const backContactPanel = useCallback(() => {
    setContactPanel((current) => {
      const previous = current.history[current.history.length - 1];
      if (!previous) return { open: false, userId: null, user: null, history: [] };
      return { open: true, userId: previous.uid, user: previous, history: current.history.slice(0, -1) };
    });
  }, []);

  const closeContactPanel = useCallback(() => {
    setContactPanel({ open: false, userId: null, user: null, history: [] });
  }, []);

  const value = useMemo(
    () => ({
      data: {
        chatId: urlChatId,
        user: activeUser,
      },
      loadingChat,
      chatNotFound,
      replyingTo,
      setReplyingTo,
      editingMessage,
      setEditingMessage,
      forwardingMessage,
      setForwardingMessage,
      dispatch,
    }),
    [urlChatId, activeUser, loadingChat, chatNotFound, replyingTo, editingMessage, forwardingMessage, dispatch]
  );

  const panelValue = useMemo(() => ({ contactPanel }), [contactPanel]);
  const panelActions = useMemo(() => ({
    openContactPanel,
    openContactPanelUser,
    backContactPanel,
    closeContactPanel,
  }), [openContactPanel, openContactPanelUser, backContactPanel, closeContactPanel]);

  return (
    <ChatContext.Provider value={value}>
      <UserChatsContext.Provider value={userChatsSnapshot}>
        <UserChatsMetadataContext.Provider value={userChatsMetadata}>
          <UserUnreadContext.Provider value={userUnread}>
            <UserDocumentContext.Provider value={userDocument}>
              <UserDocumentLoadedContext.Provider value={userDocumentLoaded}>
                <ContactPanelContext.Provider value={panelValue}>
                  <ContactPanelActionsContext.Provider value={panelActions}>
                    {children}
                  </ContactPanelActionsContext.Provider>
                </ContactPanelContext.Provider>
              </UserDocumentLoadedContext.Provider>
            </UserDocumentContext.Provider>
          </UserUnreadContext.Provider>
        </UserChatsMetadataContext.Provider>
      </UserChatsContext.Provider>
    </ChatContext.Provider>
  );
};
