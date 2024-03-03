import React, { useContext, useState } from "react";
import Cam from "../img/cam.png";
import call from "../img/call.png";
import back from "../img/back.png";
import More from "../img/more.png";
import Messages from "./Messages";
import Input from "./Input";
import Sidebar from "./Sidebar";
import { ChatContext } from "../context/ChatContext";

const Chat = () => {
  const { data } = useContext(ChatContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="chat">
      <div className="chatInfo">
        <div className="userBadge0">
          <img className="bck" src={back} alt="" onClick={toggleSidebar} />
          <div className="userBadge">
            <img src={data.user?.photoURL} alt="" />
            <span>{data.user?.displayName}</span>
          </div>
        </div>

        <div className="chatIcons">
          <img src={call} alt="" />
          <img src={Cam} alt="" />
          <img src={More} alt="" />
        </div>
      </div>
      <Messages />
      <Input />
      {isSidebarOpen && <Sidebar />}
    </div>
  );
};

export default Chat;
