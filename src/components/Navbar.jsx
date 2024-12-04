import React, { useContext } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { LogOut } from "lucide-react";
import { AuthContext } from "../context/AuthContext";

const Navbar = () => {
  const { currentUser } = useContext(AuthContext);

  return (
    <div className="bg-white shadow-md py-4 px-6 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <h1 className="text-2xl font-bold text-purple-600">ChatHere</h1>
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-3">
          <img
            src={currentUser.photoURL}
            alt="User Avatar"
            className="w-10 h-10 rounded-full object-cover border-2 border-purple-200"
          />
          <span className="text-gray-700 font-medium">
            {currentUser.displayName}
          </span>
        </div>

        <button
          onClick={() => signOut(auth)}
          className="flex items-center justify-center bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition duration-300 group"
        >
          <LogOut className="mr-2 w-5 h-5 group-hover:rotate-180 transition duration-300" />
          Logout
        </button>
      </div>
    </div>
  );
};

export default Navbar;
