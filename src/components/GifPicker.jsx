import React, { useState, useEffect } from "react";
import { Loader2, Search } from "lucide-react";

const GifPicker = ({ onGifSelect }) => {
  const [gifs, setGifs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  const TENOR_API_KEY = "LIVDSRZULELA"; // Public Tenor API Key

  const fetchGifs = async (query = "") => {
    setLoading(true);
    try {
      const url = query.trim()
        ? `https://g.tenor.com/v1/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&limit=20`
        : `https://g.tenor.com/v1/trending?key=${TENOR_API_KEY}&limit=20`;
      
      const res = await fetch(url);
      const data = await res.json();
      setGifs(data.results || []);
    } catch (err) {
      console.error("Error fetching GIFs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchGifs(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  return (
    <div className="w-[300px] h-[380px] flex flex-col rounded-xl overflow-hidden" style={{ background: "var(--surface-3)", border: "1px solid var(--border)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)"}}>
      <div className="p-3 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="Search GIFs..."
            autoFocus
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg outline-none"
            style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        {loading && gifs.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center">
             <Loader2 size={24} className="animate-spin text-indigo-400" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {gifs.map((gif) => (
              <img
                key={gif.id}
                src={gif.media[0].tinygif.url}
                alt="GIF"
                onClick={() => onGifSelect(gif.media[0].gif.url)}
                className="w-full h-auto rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                style={{ objectFit: "cover" }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GifPicker;
