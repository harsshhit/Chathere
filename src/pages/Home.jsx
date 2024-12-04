import React from "react";
import Sidebar from "../components/Sidebar";
import Chat from "../components/Chat";
import { useUI } from "../context/UIContext";
import { useContext } from "react";
import { ChatContext } from "../context/ChatContext";

const Home = () => {
  const { isMobileView } = useUI();
  const { data } = useContext(ChatContext);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div 
        className={`
          ${(!isMobileView && data.chatId) ? 'hidden md:block' : 'w-full'} 
          md:w-[350px] lg:w-[400px]
          h-full transition-all duration-300 ease-in-out
        `}
      >
        <Sidebar />
      </div>

      {/* Main Chat Area */}
      <div 
        className={`
          ${(isMobileView || !data.chatId) ? 'hidden md:block' : 'w-full fixed inset-0 md:static'} 
          md:flex-1 bg-white
          transition-all duration-300 ease-in-out
        `}
      >
        <Chat />
      </div>
    </div>
  );
};

export default Home;
