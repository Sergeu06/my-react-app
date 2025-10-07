// components/OpponentHand.jsx
import React from "react";
import "./game.css";

function OpponentHand({ count, style }) {
  const backImage = "/CARDB.jpg";

  return (
    <div className="opponent-hand" style={style}>
      {Array.from({ length: count }).map((_, idx) => (
        <img
          key={idx}
          src={backImage}
          alt="card back"
          className="opponent-card-back"
          draggable={false}
        />
      ))}
    </div>
  );
}

export default OpponentHand;
