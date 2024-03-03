import React, { useContext } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import More from "../img/more.png";

import { AuthContext } from "../context/AuthContext";

const Navbar = () => {
  const { currentUser } = useContext(AuthContext);
  return (
    <div className="navbar">
      <span className="logo">ChatHere</span>
      <div className="user">
        <img src={currentUser.photoURL} alt="" />
        <span>{currentUser.displayName}</span>
        <button onClick={() => signOut(auth)}>logout</button>
      </div>
      {/* <img src={More} alt="" /> */}
    </div>
  );
};

export default Navbar;
