import React, { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const Navbar = () => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();

  return (
    <div className="bg-gradient-to-br min-h-[10vh] from-blue-50 to-indigo-50 border-b py-4 px-6 flex items-center justify-between shadow-sm">
      <h1
        onClick={() => navigate("/")}
        className="text-2xl font-bold text-blue-600 tracking-wider cursor-pointer hover:text-blue-700 
          transition-colors duration-300 font-righteous"
      >
        ChatHere
      </h1>

      <div className="flex items-center space-x-4">
        <span className="text-gray-700 font-medium">
          {currentUser.displayName}
        </span>

        <img
          src={currentUser.photoURL}
          alt="User Avatar"
          onClick={() => navigate("/profile")}
          className="w-10 h-10 rounded-full object-cover 
            border-2 border-purple-200/80 hover:border-purple-300
            shadow-lg hover:shadow-xl
            transform hover:scale-105 hover:-rotate-3
            transition-all duration-300 ease-out
            bg-gradient-to-br from-white to-purple-50
            hover:translate-y-[-2px]
            cursor-pointer"
        />
      </div>
    </div>
  );
};

export default Navbar;
