import React, { useState } from "react";

const Avatar = ({ src, alt, className, style }) => {
  const [error, setError] = useState(false);

  const handleError = () => {
    if (!error) {
      setError(true);
    }
  };

  const name = alt && alt.trim() !== "" ? alt : "User";
  const fallbackSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=128`;

  return (
    <img
      src={error ? fallbackSrc : (src || fallbackSrc)}
      alt={alt || "Avatar"}
      className={className}
      style={{ ...style, objectFit: "cover" }}
      onError={handleError}
    />
  );
};

export default Avatar;
