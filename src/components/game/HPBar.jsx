import React from "react";
import FavoriteIcon from "@mui/icons-material/Favorite";
import "./playerinfo.css";

function HPBar({ hp, maxHp, position = "default", style = {} }) {
  const percent =
    maxHp > 0 ? Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100))) : 0;

  return (
    <div className={`hp-bar-container ${position}`} style={style}>
      <div className="hp-bar">
        <div className="hp-fill" style={{ width: `${percent}%` }}>
          <span className="hp-text">
            <FavoriteIcon fontSize="small" style={{ marginRight: 4 }} />
            {hp}/{maxHp}
          </span>
        </div>
      </div>
    </div>
  );
}

export default HPBar;
