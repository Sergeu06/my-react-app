import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useUser } from "../UserContext";
import CurrencyBalance from "../CurrencyBalance";

function calculateLevel(xp) {
  const baseXp = 100;
  const multiplier = 1.5;
  let level = 0;
  let xpNeeded = baseXp;

  while (xp >= xpNeeded) {
    level++;
    xp -= xpNeeded;
    xpNeeded = Math.floor(xpNeeded * multiplier);
  }
  return level;
}

function calculateXpToNextLevel(currentXp) {
  const baseXp = 100;
  const multiplier = 1.5;
  let level = 0;
  let xpNeeded = baseXp;

  while (currentXp >= xpNeeded) {
    currentXp -= xpNeeded;
    level++;
    xpNeeded = Math.floor(xpNeeded * multiplier);
  }

  return { level, xpInLevel: currentXp, xpNeeded };
}

function RaidEndScreen({ totalDamage = 0, cardsUsed = 0 }) {
  const navigate = useNavigate();
  const { userData } = useUser();
  const uid = userData?.uid || null;

  const moneyEarned = Math.floor(totalDamage / 10 + (totalDamage * 0.08) / 2);
  const extraCurrency = Math.max(0, Math.floor(cardsUsed / 5) - 2);
  const xpGained = moneyEarned + extraCurrency * 10 + 50;

  const [animatedMoney, setAnimatedMoney] = useState(0);
  const [animatedSecret, setAnimatedSecret] = useState(0);
  const [showBonus, setShowBonus] = useState(true);
  const [xpData, setXpData] = useState(null);
  const [xpVisible, setXpVisible] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const userRef = doc(db, "users", uid);

    getDoc(userRef).then((userSnap) => {
      if (!userSnap.exists()) return;
      const data = userSnap.data();
      const oldBalance = data.balance || 0;
      const oldSecret = data.SecretRecipes || 0;
      const oldXp = data.stats?.xp || 0;
      const newXp = oldXp + xpGained;
      const newLvl = calculateLevel(newXp);

      updateDoc(userRef, {
        balance: oldBalance + moneyEarned,
        SecretRecipes: oldSecret + extraCurrency,
        stats: {
          ...(data.stats || {}),
          xp: newXp,
          lvl: newLvl,
          raid_count: (data.stats?.raid_count || 0) + 1,
          total_damage_raid: (data.stats?.total_damage_raid || 0) + totalDamage,
          total_cards_used: (data.stats?.total_cards_used || 0) + cardsUsed,
        },
      });

      animateValue(
        setAnimatedMoney,
        oldBalance,
        oldBalance + moneyEarned,
        1000
      );
      animateValue(
        setAnimatedSecret,
        oldSecret,
        oldSecret + extraCurrency,
        1000
      );
      setXpData({ oldXp, newXp });

      setTimeout(() => setShowBonus(false), 3000);
      setTimeout(() => setXpVisible(false), 4000);
    });
  }, []);

  function animateValue(setter, start, end, duration) {
    const startTime = performance.now();
    function update(time) {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const value = Math.floor(start + (end - start) * progress);
      setter(value);
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  const xpProgress = (() => {
    if (!xpData) return null;
    const { level, xpInLevel, xpNeeded } = calculateXpToNextLevel(xpData.newXp);
    return {
      level,
      percent: Math.min((xpInLevel / xpNeeded) * 100, 100).toFixed(1),
      nextLvl: level + 1,
    };
  })();

  function handleExit() {
    navigate(`/fight?start=${uid}`);
  }

  return (
    <>
      <style>{`
        @keyframes fade-move {
          0% { opacity: 0; transform: translateX(0); }
          20% { opacity: 1; transform: translateX(5px); }
          80% { opacity: 1; transform: translateX(10px); }
          100% { opacity: 0; transform: translateX(20px); }
        }
        .bonus-amount {
          font-size: 14px;
          color: #0f0;
          font-weight: bold;
          margin-left: 4px;
          animation: fade-move 3s ease-out forwards;
        }
        .xp-bar {
          position: fixed;
          top: 0;
          left: 0;
          height: 6px;
          width: 100%;
          background: rgba(0, 191, 255, 0.1);
          z-index: 10000;
          transition: opacity 1s ease 3s;
        }
        .xp-bar-inner {
          height: 100%;
          background: linear-gradient(to right, #00bfff, #87cefa);
          transition: width 1s ease;
        }
        .xp-label {
          position: fixed;
          top: 8px;
          font-size: 12px;
          color: white;
          z-index: 10001;
        }
      `}</style>

      <CurrencyBalance
        forceShow
        balanceOverride={animatedMoney}
        secretOverride={animatedSecret}
      />

      {showBonus && (
        <>
          <div style={{ position: "fixed", top: 15, left: 100, zIndex: 10001 }}>
            <span className="bonus-amount">+{moneyEarned}</span>
          </div>
          <div style={{ position: "fixed", top: 67, left: 100, zIndex: 10001 }}>
            <span className="bonus-amount">+{extraCurrency}</span>
          </div>
        </>
      )}

      {xpVisible && xpProgress && (
        <>
          <div className="xp-bar" style={{ opacity: xpVisible ? 1 : 0 }}>
            <div
              className="xp-bar-inner"
              style={{ width: `${xpProgress.percent}%` }}
            />
          </div>
          <div className="xp-label" style={{ left: 10 }}>
            Ур. {xpProgress.level}
          </div>
          <div className="xp-label" style={{ right: 10 }}>
            {xpProgress.nextLvl}
          </div>
        </>
      )}

      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.85)",
          color: "#ffa500",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          fontFamily: "Arial, sans-serif",
          fontSize: 20,
          padding: 20,
          zIndex: 9999,
          textAlign: "center",
        }}
      >
        <h2>Бой завершён</h2>
        <p>
          Общий нанесённый урон: <strong>{totalDamage}</strong>
        </p>
        <p>
          Разыграно карт: <strong>{cardsUsed}</strong>
        </p>
        <p>
          Получено золота: <strong>{moneyEarned}</strong>
        </p>
        <p>
          Получено рецептов: <strong>{extraCurrency}</strong>
        </p>
        <p>
          Получено XP: <strong>{xpGained}</strong>
        </p>

        <button
          onClick={handleExit}
          style={{
            marginTop: 30,
            padding: "10px 30px",
            fontSize: 18,
            backgroundColor: "#ffa500",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: "bold",
            color: "#222",
            boxShadow: "0 0 10px #ffa500",
            transition: "background-color 0.3s ease",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "#ffb733")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "#ffa500")
          }
        >
          Выйти
        </button>
      </div>
    </>
  );
}

export default RaidEndScreen;
