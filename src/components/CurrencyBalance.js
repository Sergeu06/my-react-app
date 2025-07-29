import React from "react";
import { useLocation } from "react-router-dom";
import { useUser } from "./UserContext";

function CurrencyBalance({ forceShow = false }) {
  const { userData } = useUser();
  const location = useLocation();

  if (!userData) return null;

  const path = location.pathname.toLowerCase();

  // Страницы, на которых баланс **не должен отображаться**
  const hiddenPaths = ["/raid", "/game", "/profile", "/open-box"];

  if (!forceShow && hiddenPaths.includes(path)) return null;

  const showMystery = path === "/upgrade" || forceShow;

  const balanceStyle = {
    position: "fixed",
    top: 110,
    left: 0,
    backgroundColor: "#282c34",
    color: "white",
    padding: "8px 24px 8px 20px",
    borderTop: "2px solid #ffa500",
    borderBottom: "2px solid #ffa500",
    borderRight: "2px solid #ffa500",
    zIndex: 10001,
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    fontWeight: "bold",
    fontSize: "14px",
    whiteSpace: "nowrap",
    minHeight: "40px",
    clipPath:
      "polygon(0 0, 100% 0, 100% calc(50% - 20px), calc(100% - 20px) 50%, 100% calc(50% + 20px), 100% 100%, 0 100%)",
  };

  const iconStyle = { width: 20, height: 20 };

  return (
    <>
      <div style={{ ...balanceStyle, top: 110 }}>
        <img src="/moneta.png" alt="coin" style={iconStyle} />
        <span>{(userData.balance ?? 0).toFixed(2)}</span>
      </div>

      {showMystery && (
        <div style={{ ...balanceStyle, top: 160 }}>
          <img
            src="/Secret Recipes.png"
            alt="Secret Recipes"
            style={iconStyle}
          />
          <span>{userData.SecretRecipes ?? 0}</span>
        </div>
      )}
    </>
  );
}

export default CurrencyBalance;
