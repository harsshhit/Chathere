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
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 h-full overflow-y-auto shadow-inner">
      <div className="divide-y divide-blue-200/50">
        {Object.entries(chats || {})
          .sort((a, b) => b[1].date - a[1].date)
          .map((chat) => (
            <div
              key={chat[0]}
              onClick={() => handleSelect(chat[1].userInfo)}
              className="flex items-center px-6 py-4 hover:bg-white/70 active:bg-blue-100 
                backdrop-blur-sm transition-all duration-500 cursor-pointer 
                transform hover:scale-[1.02] hover:shadow-lg rounded-lg mx-2 my-1"
            >
              <img
                src={chat[1].userInfo.photoURL}
                alt={chat[1].userInfo.displayName}
                className="w-14 h-14 rounded-full object-cover mr-4
                  border-[3px] border-indigo-200 hover:border-indigo-400
                  shadow-xl hover:shadow-2xl
                  transition-all duration-500 ease-in-out
                  transform hover:scale-110 hover:rotate-6
                  ring-4 ring-white/50 hover:ring-indigo-200
                  filter hover:brightness-110 "
              />

              <div className="flex-1 min-w-0 group">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-bold text-lg bg-gradient-to-r from-blue-900 to-indigo-800 
                    bg-clip-text text-transparent group-hover:scale-105 transition-transform duration-300 truncate">
                    {chat[1].userInfo.displayName}
                  </span>
                  {chat[1].date && (
                    <span className="text-sm text-indigo-600 flex items-center flex-shrink-0 ml-2 
                      font-medium backdrop-blur-sm px-2 py-1 rounded-full bg-white/30 
                      group-hover:bg-white/50 transition-all duration-300">
                      <Clock className="w-4 h-4 mr-1 text-indigo-500 animate-spin-slow" />
                      {formatTimestamp(chat[1].date)}
                    </span>
                  )}
                </div>

                {chat[1].lastMessage && (
                  <p className="text-base text-indigo-700 truncate font-medium flex items-center
                    group-hover:translate-x-2 transition-transform duration-300">
                    {chat[1].lastMessage.senderId === currentUser.uid && (
                      <span className="text-indigo-500 mr-1 font-semibold">You: </span>
                    )}
                    {chat[1].lastMessage.text}
                  </p>
                )}
              </div>
            </div>
          ))}
      </div>

      {Object.entries(chats || {}).length === 0 && (
        <div className="text-center p-12 bg-white/30 backdrop-blur-sm rounded-xl m-4 
          shadow-xl hover:shadow-2xl transition-all duration-500 hover:scale-105">
          <MessageCircle className="mx-auto mb-6 w-24 h-24 text-indigo-400 
            animate-bounce hover:animate-ping" />
          <p className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 
            bg-clip-text text-transparent">
            No chats yet. Start a conversation!
          </p>
        </div>
      )}
    </div>
  );
};

export default Chats;
