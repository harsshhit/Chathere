import React from "react";
import Navbar from "./Navbar";
import Search from "./Search";
import Chats from "./Chats";
// import { motion } from "framer-motion";

const Sidebar = () => {
  return (
    <div 
      initial={{ x: -300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="h-full flex flex-col bg-white md:shadow-lg md:border-r border-gray-100"
    >
      <div className="sticky top-0 z-10 bg-white">
        <Navbar />
        <Search />
      </div>
      <div 
        className="flex-1 overflow-y-auto"
      >
        <Chats />
      </div>
    </div>
  );
};

export default Sidebar;
