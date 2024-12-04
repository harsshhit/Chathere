import { doc, onSnapshot } from "firebase/firestore";
import React, { useContext, useEffect, useState } from "react";
import { Clock, MessageCircle } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { ChatContext } from "../context/ChatContext";
import { db } from "../firebase";
import { useUI } from "../context/UIContext";

const Chats = () => {
  const [chats, setChats] = useState({});

  const { currentUser } = useContext(AuthContext);
  const { dispatch } = useContext(ChatContext);
  const { setIsMobileView } = useUI();

  useEffect(() => {
    const getChats = () => {
      const unsub = onSnapshot(doc(db, "userChats", currentUser.uid), (doc) => {
        setChats(doc.data());
      });

      return () => {
        unsub();
      };
    };

    currentUser.uid && getChats();
  }, [currentUser.uid]);

  const handleSelect = (u) => {
    dispatch({ type: "CHANGE_USER", payload: u });
    setIsMobileView(false);
  };

  // Function to format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="bg-white h-full overflow-y-auto">
      <div className="p-4 bg-purple-600 text-white flex items-center sticky top-0 z-10">
        <MessageCircle className="mr-3" />
        <h2 className="text-xl font-bold">Your Chats</h2>
      </div>

      <div className="divide-y divide-gray-100">
        {Object.entries(chats || {})
          .sort((a, b) => b[1].date - a[1].date)
          .map((chat) => (
            <div
              key={chat[0]}
              onClick={() => handleSelect(chat[1].userInfo)}
              className="flex items-center px-4 py-3 hover:bg-gray-50 active:bg-gray-100 
                transition duration-300 cursor-pointer"
            >
              <img
                src={chat[1].userInfo.photoURL}
                alt={chat[1].userInfo.displayName}
                className="w-12 h-12 rounded-full object-cover mr-4 border-2 border-purple-200 
                  transition duration-300"
              />

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-gray-800 truncate">
                    {chat[1].userInfo.displayName}
                  </span>
                  {chat[1].date && (
                    <span className="text-xs text-gray-500 flex items-center flex-shrink-0 ml-2">
                      <Clock className="w-3 h-3 mr-1 text-gray-400" />
                      {formatTimestamp(chat[1].date)}
                    </span>
                  )}
                </div>

                {chat[1].lastMessage && (
                  <p className="text-sm text-gray-500 truncate">
                    {chat[1].lastMessage.text}
                  </p>
                )}
              </div>
            </div>
          ))}
      </div>

      {Object.entries(chats || {}).length === 0 && (
        <div className="text-center p-8 text-gray-500">
          <MessageCircle className="mx-auto mb-4 w-16 h-16 text-purple-300" />
          <p>No chats yet. Start a conversation!</p>
        </div>
      )}
    </div>
  );
};

export default Chats;
