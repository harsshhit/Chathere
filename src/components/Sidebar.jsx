import React from "react";
import Navbar from "./Navbar";
import Search from "./Search";
import Chats from "./Chats";

const Sidebar = () => {
  return (
    <div className="h-full flex flex-col bg-white md:shadow-lg md:border-r border-gray-200">
      <div className="sticky top-0 z-10 bg-white">
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
