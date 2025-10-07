import React, { useEffect, useState } from "react";
import "./playerinfo.css";

function PlayerInfo({
  uid,
  avatarUrl: externalAvatar,
  nickname,
  lvl,
  position,
  fallbackDataUri,
}) {
  const initials = (nickname || "U").trim().slice(0, 1).toUpperCase();
  const fallbackSvg =
    fallbackDataUri ||
    `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'>
        <rect width='100%' height='100%' fill='#2b2b2b'/>
        <circle cx='64' cy='64' r='62' fill='#3a3a3a'/>
        <text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle'
              font-family='Arial' font-size='56' fill='#ffa500'>${initials}</text>
      </svg>
    `)}`;

  const [avatarUrl, setAvatarUrl] = useState(externalAvatar || fallbackSvg);

  useEffect(() => {
    if (externalAvatar) {
      setAvatarUrl(externalAvatar);
    } else {
      setAvatarUrl(fallbackSvg);
    }
  }, [externalAvatar, fallbackSvg]);

  return (
    <div className={`info-container ${position}`}>
      <div className="avatar-wrapper">
        <img
          src={avatarUrl}
          alt="avatar"
          className="player-avatar"
          onError={() => setAvatarUrl(fallbackSvg)}
          draggable={false}
          data-position={position}
        />
      </div>
    </div>
  );
}

export default PlayerInfo;
