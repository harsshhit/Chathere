import React from "react";
import Navbar from "./Navbar";
import Search from "./Search";
import Chats from "./Chats";

const Sidebar = () => {
  return (
    <div
      className="h-full flex flex-col"
      style={{ background: "var(--surface-2)" }}
    >
      <div className="flex-shrink-0">
        <Navbar />
        <Search />
      </div>
      <div className="flex-1 overflow-y-auto">
        <Chats />
      </div>
    </div>
  );
};

export default Sidebar;
