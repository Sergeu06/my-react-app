// components/OpponentHand.jsx
import React from "react";
import "./game.css";

function OpponentHand({ count }) {
  const backImage = "/images/CARDB.jpg"; // путь к рубашке

  return (
    <div className="opponent-hand">
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
