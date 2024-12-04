import { doc, onSnapshot } from "firebase/firestore";
import React, { useContext, useEffect, useState } from "react";
import { ChatContext } from "../context/ChatContext";
import { db } from "../firebase";
import Message from "./Message";

const Messages = () => {
  const [messages, setMessages] = useState([]);
  const { data } = useContext(ChatContext);

  useEffect(() => {
    const unSub = onSnapshot(doc(db, "chats", data.chatId), (doc) => {
      doc.exists() && setMessages(doc.data().messages);
    });

    return () => {
      unSub();
    };
  }, [data.chatId]);

  return (
    <div className="bg-gray-50 h-[calc(100vh-130px)] md:h-[calc(100vh-160px)] overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
      {messages.length === 0 ? (
        <div className="text-center text-gray-500 py-10">
          No messages yet. Start chatting!
        </div>
      ) : (
        messages.map((m, index) => (
          <div
            key={m.id || index}
            className="transition-all duration-300 ease-in-out hover:bg-gray-50"
          >
            <Message message={m} />
          </div>
        ))
      )}
    </div>
  );
};

export default Messages;
