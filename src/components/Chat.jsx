import React, { useContext } from "react";
import { Phone, Video, MoreVertical, ArrowLeft } from "lucide-react";
import Messages from "./Messages";
import Input from "./Input";
import { ChatContext } from "../context/ChatContext";
import { useUI } from "../context/UIContext";

const Chat = () => {
  const { data } = useContext(ChatContext);
  const { setIsMobileView } = useUI();

  const handleBack = () => {
    setIsMobileView(true);
  };

  return (
    <div className="h-full flex flex-col bg-white md:bg-transparent">
      {/* Chat Header */}
      <div className="bg-white shadow-md border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-4">
          {/* Back button - only on mobile */}
          <button 
            className="md:hidden text-gray-600 hover:text-purple-600 p-2 -ml-2 rounded-full hover:bg-gray-100"
            onClick={handleBack}
          >
            <ArrowLeft size={24} />
          </button>

          {data.user?.photoURL && (
            <div className="flex items-center space-x-3">
              <img
                src={data.user?.photoURL}
                alt={data.user?.displayName}
                className="w-10 h-10 rounded-full object-cover border-2 border-purple-200"
              />
              <span className="font-semibold text-gray-800 line-clamp-1">
                {data.user?.displayName}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2 md:space-x-4">
          <Phone className="w-8 h-8 p-1.5 text-gray-600 hover:text-green-500 cursor-pointer transition duration-300 hover:bg-gray-100 rounded-full" />
          <Video className="w-8 h-8 p-1.5 text-gray-600 hover:text-blue-500 cursor-pointer transition duration-300 hover:bg-gray-100 rounded-full" />
          <MoreVertical className="w-8 h-8 p-1.5 text-gray-600 hover:text-purple-600 cursor-pointer transition duration-300 hover:bg-gray-100 rounded-full" />
        </div>
      </div>

      {/* Messages Area */}
      {data.chatId ? (
        <>
          <div className="flex-1 overflow-y-auto bg-gray-50">
            <Messages />
          </div>
          <div className="bg-white border-t border-gray-200">
            <Input />
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center text-gray-500">
            <p className="text-xl">Select a chat to start messaging</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
