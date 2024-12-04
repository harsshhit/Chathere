import React, { useContext, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { MoreVertical } from "lucide-react";
import { AuthContext } from "../context/AuthContext";

const Navbar = () => {
  const { currentUser } = useContext(AuthContext);
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div className="bg-white border-b py-4 px-6 flex items-center justify-between shadow-sm">
      <h1 className="text-2xl font-bold text-blue-600 tracking-tight">
        ChatHere
      </h1>

      <div className="flex items-center space-x-4">
        <img
          src={currentUser.photoURL}
          alt="User Avatar"
          className="w-10 h-10 rounded-full object-cover border-2 border-purple-200"
        />

        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="p-2 hover:bg-purple-50 rounded-full transition-colors"
          >
            <MoreVertical className="w-5 h-5 text-purple-600" />
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-2 z-10 border border-purple-100">
              <div className="px-4 py-2.5 text-base font-semibold text-gray-800 border-b border-gray-100">
                {currentUser.displayName}
              </div>
              <button
                onClick={() => signOut(auth)}
                className="w-full text-left px-4 py-2.5 text-base font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Navbar;
