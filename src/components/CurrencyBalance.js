import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useUser } from "./UserContext";

function CurrencyBalance({ forceShow = false }) {
  const { userData } = useUser();
  const location = useLocation();
  const [showHint, setShowHint] = useState(false);
  const [showHintRecipes, setShowHintRecipes] = useState(false);
  const hintRef = useRef(null);
  const hintRecipesRef = useRef(null);

  const path = location.pathname.toLowerCase();
  const hiddenPaths = ["/raid", "/game", "/profile", "/open-box"];
  const showMystery = path === "/upgrade" || forceShow;
  const [showHintTickets, setShowHintTickets] = useState(false);
  const hintTicketsRef = useRef(null);

  useEffect(() => {
    if (!showHint) return;

    const hideHint = () => setShowHint(false);

    document.addEventListener("click", hideHint, { once: true });
    document.addEventListener("touchstart", hideHint, { once: true });
    document.addEventListener("scroll", hideHint, { once: true });

    return () => {
      document.removeEventListener("click", hideHint);
      document.removeEventListener("touchstart", hideHint);
      document.removeEventListener("scroll", hideHint);
    };
  }, [showHint]);
  useEffect(() => {
    if (!showHintTickets) return;

    const hideHint = () => setShowHintTickets(false);

    document.addEventListener("click", hideHint, { once: true });
    document.addEventListener("touchstart", hideHint, { once: true });
    document.addEventListener("scroll", hideHint, { once: true });

    return () => {
      document.removeEventListener("click", hideHint);
      document.removeEventListener("touchstart", hideHint);
      document.removeEventListener("scroll", hideHint);
    };
  }, [showHintTickets]);

  useEffect(() => {
    if (!showHintRecipes) return;

    const hideHint = () => setShowHintRecipes(false);

    document.addEventListener("click", hideHint, { once: true });
    document.addEventListener("touchstart", hideHint, { once: true });
    document.addEventListener("scroll", hideHint, { once: true });

    return () => {
      document.removeEventListener("click", hideHint);
      document.removeEventListener("touchstart", hideHint);
      document.removeEventListener("scroll", hideHint);
    };
  }, [showHintRecipes]);

  if (!userData) return null;
  if (!forceShow && hiddenPaths.includes(path)) return null;

  const balanceStyle = {
    position: "fixed",
    top: 7,
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
      {/* Монеты */}
      <div
        style={{ ...balanceStyle, top: "21vh", cursor: "pointer" }}
        onClick={(e) => {
          e.stopPropagation();
          setShowHint(true);
        }}
      >
        <img src="/moneta.png" alt="coin" style={iconStyle} />
        <span>{(userData.balance ?? 0).toFixed(2)}</span>
      </div>

      {/* Подсказка по монетам */}
      {showHint && (
        <div
          ref={hintRef}
          style={{
            position: "fixed",
            top: "21vh",
            right: "5%",
            left: "auto",
            backgroundColor: "#1e1e1e",
            color: "#fff",
            padding: "12px 16px",
            borderRadius: "8px",
            border: "1px solid #ffa500",
            fontSize: "12px",
            zIndex: 10002,
            width: "100%",
            maxWidth: "240px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
          }}
        >
          <strong>Золото:</strong> <br />
          Получение: участие в сражениях, открытие сундуков, награды за миссии.{" "}
          <br />
          Трата: покупка карт, участие в рейдах, прокачка. <br />
          Нажмите в любом месте, чтобы скрыть.
        </div>
      )}
      {/* Билеты (Tickets) */}
      {path === "/fight" && (
        <div
          style={{ ...balanceStyle, top: "26vh", cursor: "pointer" }}
          onClick={(e) => {
            e.stopPropagation();
            setShowHintTickets(true);
          }}
        >
          <img src="/ticket.png" alt="Tickets" style={iconStyle} />
          <span>{userData.tickets ?? 0}</span>
        </div>
      )}

      {/* Подсказка по Tickets */}
      {path === "/fight" && showHintTickets && (
        <div
          ref={hintTicketsRef}
          style={{
            position: "fixed",
            top: "26vh",
            right: "5%",
            left: "auto",
            backgroundColor: "#1e1e1e",
            color: "#fff",
            padding: "12px 16px",
            borderRadius: "8px",
            border: "1px solid #ffa500",
            fontSize: "12px",
            zIndex: 10002,
            width: "100%",
            maxWidth: "240px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
          }}
        >
          <strong>Билеты:</strong> <br />
          Используются для участия в боях с легендарными монстрани с другими
          игроками. <br />
          Нажмите в любом месте, чтобы скрыть.
        </div>
      )}

      {/* Secret Recipes */}
      {showMystery && (
        <div
          style={{ ...balanceStyle, top: "26vh", cursor: "pointer" }}
          onClick={(e) => {
            e.stopPropagation();
            setShowHintRecipes(true);
          }}
        >
          <img src="/666666.png" alt="Secret Recipes" style={iconStyle} />
          <span>{userData.SecretRecipes ?? 0}</span>
        </div>
      )}

      {/* Подсказка по Secret Recipes */}
      {showHintRecipes && (
        <div
          ref={hintRecipesRef}
          style={{
            position: "fixed",
            top: "26vh",
            right: "5%",
            left: "auto",
            backgroundColor: "#1e1e1e",
            color: "#fff",
            padding: "12px 16px",
            borderRadius: "8px",
            border: "1px solid #ffa500",
            fontSize: "12px",
            zIndex: 10002,
            width: "100%",
            maxWidth: "240px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
          }}
        >
          <strong>Рецеты:</strong> <br />
          Получение: выполнение уникальных миссий, участие в ивентах, награды за
          достижения. <br />
          Трата: специальные улучшения, крафт редких карт. <br />
          Нажмите в любом месте, чтобы скрыть.
        </div>
      )}
    </>
  );
}

export default CurrencyBalance;
