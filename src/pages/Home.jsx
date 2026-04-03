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
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "var(--surface)" }}
    >
      {/* Sidebar */}
      <div
        className={`
          flex-shrink-0 h-full
          ${(!isMobileView && data.chatId) ? "hidden md:block" : "w-full md:w-auto"}
          md:w-[320px] lg:w-[360px] xl:w-[380px]
          transition-all duration-300 ease-in-out
        `}
        style={{ borderRight: "1px solid var(--border)" }}
      >
        <Sidebar />
      </div>

      {/* Main chat */}
      <div
        className={`
          flex-1 h-full min-w-0
          ${isMobileView || !data.chatId ? "hidden md:block" : "block"}
          transition-all duration-300 ease-in-out
        `}
      >
        <Chat />
      </div>
    </div>
  );
};

export default Home;
