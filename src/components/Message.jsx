import React, { useContext, useEffect, useRef } from "react";
import { AuthContext } from "../context/AuthContext";
import { ChatContext } from "../context/ChatContext";

const Message = ({ message }) => {
  const { currentUser } = useContext(AuthContext);
  const { data } = useContext(ChatContext);

  const ref = useRef();

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  }, [message]);

  const isOwner = message.senderId === currentUser.uid;

  return (
    <div
      ref={ref}
      className={`flex items-end gap-3 mb-4 ${
        isOwner ? "flex-row-reverse" : ""
      }`}
    >
      {/* User Avatar */}
      <div className="shrink-0">
        <img
          src={isOwner ? currentUser.photoURL : data.user.photoURL}
          alt="User avatar"
          className="w-10 h-10 rounded-full object-cover"
        />
      </div>

      {/* Message Content */}
      <div
        className={`
        max-w-[70%] 
        ${
          isOwner
            ? "bg-blue-500 text-white rounded-l-xl rounded-br-xl"
            : "bg-gray-200 text-black rounded-r-xl rounded-bl-xl"
        } 
        p-3 
        shadow-sm
      `}
      >
        {/* Text Message */}
        {message.text && <p className="break-words">{message.text}</p>}

        {/* Image Message */}
        {message.img && (
          <div className="mt-2 rounded-lg overflow-hidden">
            <img
              src={message.img}
              alt="Shared content"
              className="max-w-full h-auto object-cover rounded-lg"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Message;
