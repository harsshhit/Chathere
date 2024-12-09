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
    

      <div className="divide-y divide-blue-100">
        {Object.entries(chats || {})
          .sort((a, b) => b[1].date - a[1].date)
          .map((chat) => (
            <div
              key={chat[0]}
              onClick={() => handleSelect(chat[1].userInfo)}
              className="flex items-center px-6 py-4 hover:bg-blue-50 active:bg-blue-100 
                transition-all duration-300 cursor-pointer transform hover:scale-[1.01]"
            >
              <img
                src={chat[1].userInfo.photoURL}
                alt={chat[1].userInfo.displayName}
                className="w-14 h-14 rounded-full object-cover mr-4
                  border-[3px] border-gray-300 hover:border-gray-400
                  shadow-lg hover:shadow-xl
                  transition-all duration-300 ease-in-out
                  transform hover:scale-105 hover:rotate-3
                  ring-2 ring-gray-100 hover:ring-gray-200
                  filter hover:brightness-105"
              />

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-bold text-lg text-blue-900 truncate">
                    {chat[1].userInfo.displayName}
                  </span>
                  {chat[1].date && (
                    <span className="text-sm text-blue-600 flex items-center flex-shrink-0 ml-2 font-medium">
                      <Clock className="w-4 h-4 mr-1 text-blue-500" />
                      {formatTimestamp(chat[1].date)}
                    </span>
                  )}
                </div>

                {chat[1].lastMessage && (
                  <p className="text-base text-blue-700 truncate font-medium flex items-center">
                    {chat[1].lastMessage.senderId === currentUser.uid && (
                      <span className="text-blue-500 mr-1">You: </span>
                    )}
                    {chat[1].lastMessage.text}
                  </p>
                )}
              </div>
            </div>
          ))}
      </div>

      {Object.entries(chats || {}).length === 0 && (
        <div className="text-center p-12 text-blue-600">
          <MessageCircle className="mx-auto mb-6 w-20 h-20 text-blue-400 animate-pulse" />
          <p className="text-lg font-semibold">No chats yet. Start a conversation!</p>
        </div>
      )}
    </div>
  );
};

export default Chats;
