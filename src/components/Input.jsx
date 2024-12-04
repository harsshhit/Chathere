import React, { useContext, useState } from "react";
import { Image, Send } from "lucide-react"; // Using Lucide icons instead of images
import { AuthContext } from "../context/AuthContext";
import { ChatContext } from "../context/ChatContext";
import {
  arrayUnion,
  doc,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db, storage } from "../firebase";
import { v4 as uuid } from "uuid";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";

const Input = () => {
  const [text, setText] = useState("");
  const [img, setImg] = useState(null);

  const { currentUser } = useContext(AuthContext);
  const { data } = useContext(ChatContext);

  const handleSend = async () => {
    if (img) {
      const storageRef = ref(storage, uuid());

      const uploadTask = uploadBytesResumable(storageRef, img);

      uploadTask.on(
        (error) => {
          //TODO:Handle Error
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then(async (downloadURL) => {
            await updateDoc(doc(db, "chats", data.chatId), {
              messages: arrayUnion({
                id: uuid(),
                text,
                senderId: currentUser.uid,
                date: Timestamp.now(),
                img: downloadURL,
              }),
            });
          });
        }
      );
    } else {
      await updateDoc(doc(db, "chats", data.chatId), {
        messages: arrayUnion({
          id: uuid(),
          text,
          senderId: currentUser.uid,
          date: Timestamp.now(),
        }),
      });
    }

    await updateDoc(doc(db, "userChats", currentUser.uid), {
      [data.chatId + ".lastMessage"]: {
        text,
      },
      [data.chatId + ".date"]: serverTimestamp(),
    });

    await updateDoc(doc(db, "userChats", data.user.uid), {
      [data.chatId + ".lastMessage"]: {
        text,
      },
      [data.chatId + ".date"]: serverTimestamp(),
    });

    setText("");
    setImg(null);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  return (
    <div className="flex items-center bg-blue-50 p-6 rounded-2xl shadow-lg border border-blue-100">
      <input
        type="text"
        placeholder="Type something..."
        className="flex-grow px-6 py-4 text-blue-900 bg-white border-2 border-blue-200 rounded-l-2xl 
          focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-400
          placeholder-blue-400 text-lg font-medium
          transition-all duration-300 ease-in-out"
        onChange={(e) => setText(e.target.value)}
        onKeyPress={handleKeyPress}
        value={text}
      />
      <div className="flex items-center bg-white border-y-2 border-r-2 border-blue-200 rounded-r-2xl">
        <input
          type="file"
          style={{ display: "none" }}
          id="file"
          onChange={(e) => setImg(e.target.files[0])}
        />
        <label
          htmlFor="file"
          className="p-4 cursor-pointer hover:bg-blue-50 transition-all duration-300 rounded-l-xl
            group active:bg-blue-100"
        >
          <Image className="w-7 h-7 text-blue-500 group-hover:text-blue-600 group-hover:scale-110 
            transition-all duration-300" />
        </label>
        <button
          onClick={handleSend}
          className="p-4 bg-blue-600 text-white rounded-r-2xl hover:bg-blue-700 
            active:bg-blue-800 transition-all duration-300 
            flex items-center justify-center group"
        >
          <Send className="w-7 h-7 group-hover:scale-110 group-hover:rotate-12 
            transition-all duration-300" />
        </button>
      </div>
    </div>
  );
};

export default Input;
