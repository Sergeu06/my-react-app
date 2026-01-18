import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  arrayUnion,
  collection,
  database,
  databaseRef,
  db,
  doc,
  getDoc,
  getDocs,
  set as rtdbSet,
  updateDoc,
} from "../firebase";
import { useUser } from "../UserContext";
import CurrencyBalance from "../CurrencyBalance";
import "./RaidEndScreen.css";

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

const ROULETTE_CONFIG = {
  spinDurationMs: 2600,
  itemHeight: 64,
  visibleItems: 5,
  reelItems: 30,
  rewardTable: [
    {
      type: "coins",
      label: "Монеты",
      min: 10,
      max: 500,
      weight: 40,
    },
    {
      type: "recipes",
      label: "Рецепты",
      min: 1,
      max: 10,
      weight: 25,
    },
    {
      type: "tickets",
      label: "Билеты",
      min: 1,
      max: 5,
      weight: 20,
    },
    {
      type: "card",
      label: "Случайная карта",
      weight: 15,
    },
  ],
};

const pickWeightedReward = (table) => {
  const totalWeight = table.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const item of table) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return table[table.length - 1];
};

const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

function RaidEndScreen({ totalDamage = 0, cardsUsed = 0 }) {
  const navigate = useNavigate();
  const { userData } = useUser();
  const uid = userData?.uid || null;

  const moneyEarned = Math.floor(totalDamage * 0.23);
  const extraCurrency = Math.max(0, Math.floor(cardsUsed / 5) - 2);
  const xpGained = moneyEarned + extraCurrency * 10 + 50;

  const [animatedMoney, setAnimatedMoney] = useState(0);
  const [animatedSecret, setAnimatedSecret] = useState(0);
  const [showBonus, setShowBonus] = useState(false);
  const [xpData, setXpData] = useState(null);
  const [xpVisible, setXpVisible] = useState(true);
  const [rouletteItems, setRouletteItems] = useState([]);
  const [rouletteOffset, setRouletteOffset] = useState(0);
  const [roulettePhase, setRoulettePhase] = useState("spinning");
  const [rouletteSummary, setRouletteSummary] = useState(null);
  const [winningIndex, setWinningIndex] = useState(0);

  const rouletteWindowHeight = useMemo(
    () => ROULETTE_CONFIG.itemHeight * ROULETTE_CONFIG.visibleItems,
    []
  );
  const rouletteCenterOffset = useMemo(
    () =>
      (ROULETTE_CONFIG.visibleItems / 2 - 0.5) * ROULETTE_CONFIG.itemHeight,
    []
  );

  useEffect(() => {
    if (!uid) return;
    let isActive = true;
    const userRef = doc(db, "users", uid);
    const timeouts = [];

    const buildDisplayItem = (reward, isWinner = false) => {
      if (reward.type === "card") {
        return {
          type: reward.type,
          label: reward.label,
          value: "Любая",
          isWinner,
        };
      }
      const amount =
        reward.min && reward.max ? randomInt(reward.min, reward.max) : null;
      return {
        type: reward.type,
        label: reward.label,
        value: amount,
        isWinner,
      };
    };

    const spinRoulette = async () => {
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists() || !isActive) return;
      const data = userSnap.data();
      const oldBalance = data.balance || 0;
      const oldSecret = data.SecretRecipes || 0;
      const oldXp = data.stats?.xp || 0;

      const baseReward = pickWeightedReward(ROULETTE_CONFIG.rewardTable);
      const resultReward = buildDisplayItem(baseReward, true);

      const items = Array.from({ length: ROULETTE_CONFIG.reelItems }, () =>
        buildDisplayItem(pickWeightedReward(ROULETTE_CONFIG.rewardTable))
      );
      const targetIndex = Math.max(0, ROULETTE_CONFIG.reelItems - 3);
      items[targetIndex] = resultReward;

      setRouletteItems(items);
      setWinningIndex(targetIndex);
      requestAnimationFrame(() => {
        setRouletteOffset(
          targetIndex * ROULETTE_CONFIG.itemHeight - rouletteCenterOffset
        );
      });

      timeouts.push(
        setTimeout(async () => {
          if (!isActive) return;
          const summary = {
            coins: 0,
            recipes: 0,
            tickets: 0,
            cardName: null,
          };
          let cardRewardTemplate = null;

          if (resultReward.type === "coins") {
            summary.coins = resultReward.value;
          }
          if (resultReward.type === "recipes") {
            summary.recipes = resultReward.value;
          }
          if (resultReward.type === "tickets") {
            summary.tickets = resultReward.value;
          }
          if (resultReward.type === "card") {
            const cardsSnapshot = await getDocs(collection(db, "cards"));
            const templates = cardsSnapshot.docs;
            if (templates.length) {
              const picked =
                templates[Math.floor(Math.random() * templates.length)];
              cardRewardTemplate = {
                id: picked.id,
                data: picked.data(),
              };
              summary.cardName = picked.data()?.name || "Без имени";
            }
          }

          const totalCoins = moneyEarned + summary.coins;
          const totalRecipes = extraCurrency + summary.recipes;
          const totalTickets = summary.tickets;
          const newXp = oldXp + xpGained;
          const newLvl = calculateLevel(newXp);

          const updates = {
            balance: oldBalance + totalCoins,
            SecretRecipes: oldSecret + totalRecipes,
            tickets: (data.tickets ?? 0) + totalTickets,
            stats: {
              ...(data.stats || {}),
              xp: newXp,
              lvl: newLvl,
              raid_count: (data.stats?.raid_count || 0) + 1,
              total_damage_raid:
                (data.stats?.total_damage_raid || 0) + totalDamage,
              total_cards_used: (data.stats?.total_cards_used || 0) + cardsUsed,
            },
          };

          if (cardRewardTemplate) {
            const newId = crypto.randomUUID();
            await rtdbSet(databaseRef(database, `cards/${newId}`), {
              ...cardRewardTemplate.data,
              lvl: 1,
              owner: uid,
              fleet: parseFloat(Math.random().toFixed(10)),
              sell: false,
              original_id: cardRewardTemplate.id,
              upgradeBonus: 0,
              increase: cardRewardTemplate.data?.increase ?? 1,
            });
            updates.cards = arrayUnion(newId);
          }

          await updateDoc(userRef, updates);

          animateValue(
            setAnimatedMoney,
            oldBalance,
            oldBalance + totalCoins,
            1000
          );
          animateValue(
            setAnimatedSecret,
            oldSecret,
            oldSecret + totalRecipes,
            1000
          );
          setXpData({ oldXp, newXp });
          setRouletteSummary(summary);
          setRoulettePhase("results");
          setShowBonus(true);

          timeouts.push(setTimeout(() => setShowBonus(false), 3000));
          timeouts.push(setTimeout(() => setXpVisible(false), 4000));
        }, ROULETTE_CONFIG.spinDurationMs)
      );
    };

    spinRoulette();

    return () => {
      isActive = false;
      timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    };
  }, [uid, moneyEarned, extraCurrency, cardsUsed, totalDamage, xpGained]);

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
            <span className="bonus-amount">
              +{moneyEarned + (rouletteSummary?.coins || 0)}
            </span>
          </div>
          <div style={{ position: "fixed", top: 67, left: 100, zIndex: 10001 }}>
            <span className="bonus-amount">
              +{extraCurrency + (rouletteSummary?.recipes || 0)}
            </span>
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

      {roulettePhase === "spinning" && (
        <div className="raid-roulette-overlay">
          <h2 className="raid-roulette-title">Награда рейда</h2>
          <p className="raid-roulette-subtitle">
            Рулетка определяет бонусную награду
          </p>
          <div
            className="raid-roulette-window"
            style={{ height: rouletteWindowHeight }}
          >
            <div className="raid-roulette-highlight" />
            <div
              className="raid-roulette-reel"
              style={{
                transform: `translateY(-${rouletteOffset}px)`,
                transition: `transform ${ROULETTE_CONFIG.spinDurationMs}ms cubic-bezier(0.17, 0.84, 0.44, 1)`,
              }}
            >
              {rouletteItems.map((item, index) => (
                <div
                  className={`raid-roulette-item${
                    index === winningIndex ? " winner" : ""
                  }`}
                  key={`${item.type}-${index}`}
                  style={{ height: ROULETTE_CONFIG.itemHeight }}
                >
                  <span className="raid-roulette-item-label">
                    {item.label}
                  </span>
                  <span className="raid-roulette-item-value">
                    {item.value ?? "?"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <p className="raid-roulette-note">
            Шансы можно настроить в ROULETTE_CONFIG в коде.
          </p>
        </div>
      )}

      {roulettePhase === "results" && (
        <div className="raid-result-overlay">
          <h2>Бой завершён</h2>
          <p>
            Общий нанесённый урон: <strong>{totalDamage}</strong>
          </p>
          <p>
            Разыграно карт: <strong>{cardsUsed}</strong>
          </p>
          <p>
            Получено золота:{" "}
            <strong>
              {moneyEarned + (rouletteSummary?.coins || 0)}
            </strong>
          </p>
          <p>
            Получено рецептов:{" "}
            <strong>
              {extraCurrency + (rouletteSummary?.recipes || 0)}
            </strong>
          </p>
          <p>
            Получено билетов: <strong>{rouletteSummary?.tickets || 0}</strong>
          </p>
          <p>
            Получено XP: <strong>{xpGained}</strong>
          </p>
          {rouletteSummary?.cardName && (
            <p>
              Карта из рулетки: <strong>{rouletteSummary.cardName}</strong>
            </p>
          )}

          <button
            onClick={handleExit}
            className="raid-result-exit"
            onMouseEnter={(e) =>
              (e.currentTarget.style.background =
                "linear-gradient(160deg, #444, #2f2f2f)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background =
                "linear-gradient(160deg, #3a3a3a, #2a2a2a)")
            }
          >
            Выйти
          </button>
        </div>
      )}
    </>
  );
}

export default RaidEndScreen;
