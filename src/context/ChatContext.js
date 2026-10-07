import { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useLocation, matchPath } from "react-router-dom";
import { AuthContext } from "./AuthContext";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export const ChatContext = createContext();

export const ChatContextProvider = ({ children }) => {
  const { currentUser } = useContext(AuthContext);
  const location = useLocation();

  // URL is the single source of truth for the active chatId
  const match = matchPath("/chat/:chatId", location.pathname);
  const urlChatId = match?.params?.chatId || null;

  const [activeUser, setActiveUser] = useState(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatNotFound, setChatNotFound] = useState(false);

  const userChatsRef = useRef({});
  const [userChatsLoaded, setUserChatsLoaded] = useState(false);

  // Subscribe to the current user's userChats collection
  useEffect(() => {
    if (!currentUser?.uid) {
      userChatsRef.current = {};
      setUserChatsLoaded(true);
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
            const userDoc = await getDoc(doc(db, "users", otherUid));
            if (!isCancelled) {
              if (userDoc.exists()) {
                setActiveUser(userDoc.data());
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

  const value = useMemo(
    () => ({
      data: {
        chatId: urlChatId,
        user: activeUser,
      },
      loadingChat,
      chatNotFound,
      dispatch,
    }),
    [urlChatId, activeUser, loadingChat, chatNotFound, dispatch]
  );

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};
