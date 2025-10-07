import React, { useState, useEffect } from "react";
import FavoriteIcon from "@mui/icons-material/Favorite";
import "./playerinfo.css";

function HPBar({
  hp,
  maxHp,
  position = "default", // "vertical"
  style = {},
  hasPriority = false,
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  const percent =
    maxHp > 0 ? Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100))) : 0;

  useEffect(() => {
    if (!showTooltip) return;

    const timer = setTimeout(() => setShowTooltip(false), 5000);

    const handleClickOutside = () => setShowTooltip(false);
    window.addEventListener("click", handleClickOutside);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("click", handleClickOutside);
    };
  }, [showTooltip]);

  return (
    <div className={`hp-bar-container ${position}`} style={style}>
      <div className={`hp-bar ${position === "vertical" ? "vertical" : ""}`}>
        <div
          className={`hp-fill ${position === "vertical" ? "vertical" : ""}`}
          style={
            position === "vertical"
              ? { height: `${percent}%` }
              : { width: `${percent}%` }
          }
        />
        {/* Текст поверх бара */}
        <span
          className="hp-text"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)", // центрирование
            color: "rgba(255,255,255,0.8)",
            display: "flex",
            alignItems: "center",
            fontWeight: "bold",
            pointerEvents: "none",
            whiteSpace: "nowrap", // чтобы текст не переносился
          }}
        >
          <FavoriteIcon
            fontSize="small"
            style={{
              color: "rgba(255,255,255,0.8)",
            }}
          />
          {hp}/{maxHp}
        </span>
      </div>

      {hasPriority && (
        <span
          className="priority-label"
          onClick={(e) => {
            e.stopPropagation();
            setShowTooltip(true);
          }}
        >
          П
          {showTooltip && (
            <div
              className={`priority-tooltip ${
                position === "top" ? "tooltip-below" : "tooltip-above"
              }`}
            >
              {position === "bottom" ? (
                <>
                  У вас приоритет: вы начинаете ход.
                  <br />
                  <br />
                  Приоритет даёт преимущество, если
                  <br />
                  у вас и соперника
                  <br />
                  одинаковый приоритет на картах.
                </>
              ) : (
                <>
                  У соперника приоритет:
                  <br />
                  он начинает ход.
                  <br />
                  <br />
                  Приоритет даёт преимущество, если
                  <br />
                  у вас и соперника
                  <br />
                  одинаковый приоритет на картах.
                </>
              )}
            </div>
          )}
        </span>
      )}
    </div>
  );
}

export default HPBar;
