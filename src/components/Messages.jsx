import { doc, onSnapshot } from "firebase/firestore";
import React, { useContext, useEffect, useState, useRef } from "react";
import { ChatContext } from "../context/ChatContext";
import { db } from "../firebase";
import Message from "./Message";

const Messages = () => {
  const [messages, setMessages] = useState([]);
  const { data } = useContext(ChatContext);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const unSub = onSnapshot(doc(db, "chats", data.chatId), (doc) => {
      doc.exists() && setMessages(doc.data().messages);
    });

    return () => {
      unSub();
    };
  }, [data.chatId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div
      className="bg-blue-50 h-[calc(100vh-130px)] md:h-[calc(100vh-160px)] overflow-y-auto p-6 space-y-6 
      scrollbar-thin scrollbar-thumb-blue-400 scrollbar-track-blue-100 
      shadow-inner border border-blue-100 rounded-lg"
    >
      {messages.length === 0 ? (
        <div className="text-center text-gray-600 py-12 px-4  bg-opacity-60  rounded-xl   ">
          <p className="text-xl "> Start chatting!</p>
        </div>
      ) : (
        messages.map((m, index) => (
          <div
            key={m.id || index}
            className="transition-all duration-300 ease-in-out  
              rounded-lg hover:-translate-y-0.5"
          >
            <Message message={m} />
          </div>
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default Messages;
