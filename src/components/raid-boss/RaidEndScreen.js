import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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

const ROULETTE_PHASES = {
  spinning: "spinning",
  reveal: "reveal",
  confirm: "confirm",
  results: "results",
};

const SPIN_STAGES = {
  kick: "kick",
  main: "main",
};

const ROULETTE_CONFIG = {
  spinDurationMs: 2600,
  kickDurationMs: 240,
  revealMinMs: 500,
  revealMaxMs: 900,
  itemHeight: 64,
  visibleItems: 5,
  reelItems: 30,
  itemGap: 6,
  rewardTable: [
    {
      type: "coins",
      label: "Монеты",
      min: 10,
      max: 500,
      weight: 46,
    },
    {
      type: "recipes",
      label: "Рецепты",
      min: 1,
      max: 10,
      weight: 30,
    },
    {
      type: "tickets",
      label: "Билеты",
      min: 1,
      max: 5,
      weight: 25,
    },
    {
      type: "card",
      label: "Случайная карта",
      weight: 1,
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

const rewardIcons = {
  coins: "/moneta.png",
  recipes: "/666666.png",
  tickets: "/ticket.png",
};

const fallbackCardImage = "/CARDB.jpg";

const buildOverlayVariants = (prefersReducedMotion) => ({
  initial: {
    opacity: 0,
    scale: prefersReducedMotion ? 1 : 0.98,
    filter: prefersReducedMotion ? "none" : "blur(6px)",
  },
  animate: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: prefersReducedMotion ? 0.15 : 0.25 },
  },
  exit: {
    opacity: 0,
    scale: prefersReducedMotion ? 1 : 1.02,
    filter: prefersReducedMotion ? "none" : "blur(4px)",
    transition: { duration: prefersReducedMotion ? 0.15 : 0.2 },
  },
});

const buildResultsVariants = (prefersReducedMotion) => ({
  container: {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        duration: prefersReducedMotion ? 0.1 : 0.2,
        staggerChildren: prefersReducedMotion ? 0 : 0.08,
      },
    },
  },
  item: {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 6 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: prefersReducedMotion ? 0.1 : 0.25 },
    },
  },
});

const RaidConfetti = ({ active }) => {
  const prefersReducedMotion = useReducedMotion();
  const pieces = useMemo(() => {
    return Array.from({ length: 16 }, (_, index) => ({
      id: `confetti-${index}-${Math.random().toString(16).slice(2)}`,
      x: randomInt(-120, 120),
      y: randomInt(-160, -60),
      delay: randomInt(0, 200),
      duration: randomInt(900, 1400),
      size: randomInt(6, 10),
      rotation: randomInt(-180, 180),
      hue: randomInt(40, 60),
    }));
  }, []);

  if (!active || prefersReducedMotion) return null;

  return (
    <div className="raid-confetti" aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="raid-confetti-piece"
          style={{
            "--x": `${piece.x}px`,
            "--y": `${piece.y}px`,
            "--delay": `${piece.delay}ms`,
            "--duration": `${piece.duration}ms`,
            "--rotation": `${piece.rotation}deg`,
            "--hue": piece.hue,
            width: `${piece.size}px`,
            height: `${piece.size * 1.5}px`,
          }}
        />
      ))}
    </div>
  );
};

function RaidEndScreen({ totalDamage = 0, cardsUsed = 0 }) {
  const navigate = useNavigate();
  const { userData } = useUser();
  const uid = userData?.uid || null;
  const prefersReducedMotion = useReducedMotion();

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
  const [roulettePhase, setRoulettePhase] = useState(ROULETTE_PHASES.spinning);
  const [rouletteSummary, setRouletteSummary] = useState(null);
  const [winningIndex, setWinningIndex] = useState(0);
  const [rewardPreview, setRewardPreview] = useState(null);
  const [spinStage, setSpinStage] = useState(SPIN_STAGES.main);
  const [bonusJitter, setBonusJitter] = useState({
    coins: { x: 0, y: 0 },
    recipes: { x: 0, y: 0 },
    tickets: { x: 0, y: 0 },
  });
  const [showConfetti, setShowConfetti] = useState(false);
  const userSnapshotRef = useRef(null);

  const rouletteWindowHeight = useMemo(
    () => ROULETTE_CONFIG.itemHeight * ROULETTE_CONFIG.visibleItems,
    []
  );
  const rouletteCenterOffset = useMemo(() => {
    const halfVisible = ROULETTE_CONFIG.visibleItems / 2 - 0.5;
    return halfVisible * (ROULETTE_CONFIG.itemHeight + ROULETTE_CONFIG.itemGap);
  }, []);

  useEffect(() => {
    if (!uid) return;
    let isActive = true;
    const userRef = doc(db, "users", uid);
    const timeouts = [];

    const buildDisplayItem = (reward, cardTemplates, isWinner = false) => {
      if (reward.type === "card") {
        const pickedTemplate = cardTemplates.length
          ? cardTemplates[Math.floor(Math.random() * cardTemplates.length)]
          : null;
        return {
          type: reward.type,
          label: reward.label,
          value: pickedTemplate?.data?.name || "Любая",
          imageUrl: pickedTemplate?.data?.image_url || fallbackCardImage,
          cardTemplate: pickedTemplate,
          isWinner,
        };
      }
      const amount =
        reward.min && reward.max ? randomInt(reward.min, reward.max) : null;
      return {
        type: reward.type,
        label: reward.label,
        value: amount,
        imageUrl: rewardIcons[reward.type] || null,
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
      const oldTickets = data.tickets ?? 0;

      const cardsSnapshot = await getDocs(collection(db, "cards"));
      const cardTemplates = cardsSnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        data: docSnap.data(),
      }));

      userSnapshotRef.current = {
        oldBalance,
        oldSecret,
        oldXp,
        oldTickets,
        stats: data.stats || {},
      };

      const baseReward = pickWeightedReward(ROULETTE_CONFIG.rewardTable);
      const resultReward = buildDisplayItem(baseReward, cardTemplates, true);

      const items = Array.from({ length: ROULETTE_CONFIG.reelItems }, () =>
        buildDisplayItem(
          pickWeightedReward(ROULETTE_CONFIG.rewardTable),
          cardTemplates
        )
      );
      const targetIndex = Math.max(0, ROULETTE_CONFIG.reelItems - 3);
      items[targetIndex] = resultReward;

      const targetOffset =
        targetIndex *
          (ROULETTE_CONFIG.itemHeight + ROULETTE_CONFIG.itemGap) -
        rouletteCenterOffset;
      const kickDistance = Math.min(
        targetOffset,
        (ROULETTE_CONFIG.itemHeight + ROULETTE_CONFIG.itemGap) * 2
      );

      setRouletteItems(items);
      setWinningIndex(targetIndex);
      setRouletteOffset(0);

      if (prefersReducedMotion) {
        setSpinStage(SPIN_STAGES.main);
        setRouletteOffset(targetOffset);
      } else {
        requestAnimationFrame(() => {
          setSpinStage(SPIN_STAGES.kick);
          setRouletteOffset(kickDistance);
        });

        timeouts.push(
          setTimeout(() => {
            if (!isActive) return;
            setSpinStage(SPIN_STAGES.main);
            setRouletteOffset(targetOffset);
          }, ROULETTE_CONFIG.kickDurationMs)
        );
      }

      const totalSpinDuration = prefersReducedMotion
        ? 0
        : ROULETTE_CONFIG.spinDurationMs + ROULETTE_CONFIG.kickDurationMs;
      const revealDuration = randomInt(
        ROULETTE_CONFIG.revealMinMs,
        ROULETTE_CONFIG.revealMaxMs
      );

      timeouts.push(
        setTimeout(() => {
          if (!isActive) return;
          setRewardPreview(resultReward);
          setRoulettePhase(ROULETTE_PHASES.reveal);
        }, totalSpinDuration)
      );

      timeouts.push(
        setTimeout(() => {
          if (!isActive) return;
          setRoulettePhase(ROULETTE_PHASES.confirm);
        }, totalSpinDuration + revealDuration)
      );
    };

    spinRoulette();

    return () => {
      isActive = false;
      timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    };
  }, [
    uid,
    moneyEarned,
    extraCurrency,
    cardsUsed,
    totalDamage,
    xpGained,
    rouletteCenterOffset,
    prefersReducedMotion,
  ]);

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

  const handleConfirmReward = async () => {
    if (!uid || !rewardPreview) return;
    const snapshot = userSnapshotRef.current;
    if (!snapshot) return;

    const summary = {
      coins: 0,
      recipes: 0,
      tickets: 0,
      cardName: null,
    };
    let cardRewardTemplate = null;

    if (rewardPreview.type === "coins") {
      summary.coins = rewardPreview.value || 0;
    }
    if (rewardPreview.type === "recipes") {
      summary.recipes = rewardPreview.value || 0;
    }
    if (rewardPreview.type === "tickets") {
      summary.tickets = rewardPreview.value || 0;
    }
    if (rewardPreview.type === "card" && rewardPreview.cardTemplate) {
      cardRewardTemplate = rewardPreview.cardTemplate;
      summary.cardName = rewardPreview.value || "Без имени";
    }

    const totalCoins = moneyEarned + summary.coins;
    const totalRecipes = extraCurrency + summary.recipes;
    const totalTickets = summary.tickets;
    const newXp = snapshot.oldXp + xpGained;
    const oldLevel = calculateLevel(snapshot.oldXp);
    const newLvl = calculateLevel(newXp);

    const updates = {
      balance: snapshot.oldBalance + totalCoins,
      SecretRecipes: snapshot.oldSecret + totalRecipes,
      tickets: snapshot.oldTickets + totalTickets,
      stats: {
        ...(snapshot.stats || {}),
        xp: newXp,
        lvl: newLvl,
        raid_count: (snapshot.stats?.raid_count || 0) + 1,
        total_damage_raid:
          (snapshot.stats?.total_damage_raid || 0) + totalDamage,
        total_cards_used: (snapshot.stats?.total_cards_used || 0) + cardsUsed,
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

    await updateDoc(doc(db, "users", uid), updates);

    animateValue(
      setAnimatedMoney,
      snapshot.oldBalance,
      snapshot.oldBalance + totalCoins,
      1000
    );
    animateValue(
      setAnimatedSecret,
      snapshot.oldSecret,
      snapshot.oldSecret + totalRecipes,
      1000
    );
    setXpData({ oldXp: snapshot.oldXp, newXp, oldLevel, newLevel: newLvl });
    setRouletteSummary(summary);
    setRoulettePhase(ROULETTE_PHASES.results);
    setShowBonus(true);
    setBonusJitter({
      coins: { x: randomInt(-4, 4), y: randomInt(-4, 4) },
      recipes: { x: randomInt(-4, 4), y: randomInt(-4, 4) },
      tickets: { x: randomInt(-4, 4), y: randomInt(-4, 4) },
    });

    setTimeout(() => setShowBonus(false), 3000);
    setTimeout(() => setXpVisible(false), 4000);
  };

  useEffect(() => {
    if (!rouletteSummary?.cardName || prefersReducedMotion) return;
    setShowConfetti(true);
    const confettiTimer = setTimeout(() => {
      setShowConfetti(false);
    }, 1200);
    return () => clearTimeout(confettiTimer);
  }, [rouletteSummary?.cardName, prefersReducedMotion]);

  const isRevealPhase = roulettePhase === ROULETTE_PHASES.reveal;
  const overlayVariants = useMemo(
    () => buildOverlayVariants(prefersReducedMotion),
    [prefersReducedMotion]
  );
  const resultsVariants = useMemo(
    () => buildResultsVariants(prefersReducedMotion),
    [prefersReducedMotion]
  );
  const xpLevelUp =
    xpData && typeof xpData.oldLevel === "number"
      ? xpData.newLevel > xpData.oldLevel
      : false;
  const showLevelUpEffects = xpLevelUp && !prefersReducedMotion;

  return (
    <>
      <CurrencyBalance
        forceShow
        balanceOverride={animatedMoney}
        secretOverride={animatedSecret}
      />

      {showBonus && (
        <>
          <div
            style={{
              position: "fixed",
              top: 15 + bonusJitter.coins.y,
              left: 100 + bonusJitter.coins.x,
              zIndex: 10001,
            }}
          >
            <span className="bonus-amount bonus-amount--coins">
              +{moneyEarned + (rouletteSummary?.coins || 0)}
            </span>
          </div>
          <div
            style={{
              position: "fixed",
              top: 167 + bonusJitter.recipes.y,
              left: 100 + bonusJitter.recipes.x,
              zIndex: 10001,
            }}
          >
            <span className="bonus-amount bonus-amount--recipes">
              +{extraCurrency + (rouletteSummary?.recipes || 0)}
            </span>
          </div>
        </>
      )}

      {xpVisible && xpProgress && (
        <>
          <div
            className={`xp-bar${showLevelUpEffects ? " xp-bar--levelup" : ""}`}
            style={{ opacity: xpVisible ? 1 : 0 }}
          >
            <div
              className={`xp-bar-inner${
                showLevelUpEffects ? " xp-bar-inner--levelup" : ""
              }`}
              style={{ width: `${xpProgress.percent}%` }}
            >
              {showLevelUpEffects && <span className="xp-bar-flash" />}
            </div>
          </div>
          <div
            className={`xp-label${
              showLevelUpEffects ? " xp-label--levelup" : ""
            }`}
            style={{ left: 10 }}
          >
            Ур. {xpProgress.level}
          </div>
          <div className="xp-label" style={{ right: 10 }}>
            {xpProgress.nextLvl}
          </div>
        </>
      )}

      <AnimatePresence mode="wait">
        {(roulettePhase === ROULETTE_PHASES.spinning ||
          roulettePhase === ROULETTE_PHASES.reveal) && (
          <motion.div
            key="roulette"
            className={`raid-roulette-overlay${
              isRevealPhase ? " raid-roulette-overlay--reveal" : ""
            }`}
            variants={overlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
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
                  gap: `${ROULETTE_CONFIG.itemGap}px`,
                  transition: `transform ${
                    spinStage === SPIN_STAGES.kick
                      ? ROULETTE_CONFIG.kickDurationMs
                      : ROULETTE_CONFIG.spinDurationMs
                  }ms cubic-bezier(0.17, 0.84, 0.44, 1)`,
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
                    <div className="raid-roulette-item-content">
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.label}
                          className="raid-roulette-item-icon"
                        />
                      )}
                      <div className="raid-roulette-item-text">
                        <span className="raid-roulette-item-label">
                          {item.label}
                        </span>
                        <span className="raid-roulette-item-value">
                          {item.value ?? "?"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="raid-roulette-note">
              Шансы можно настроить в ROULETTE_CONFIG в коде.
            </p>
          </motion.div>
        )}

        {roulettePhase === ROULETTE_PHASES.confirm && rewardPreview && (
          <motion.div
            key="confirm"
            className="raid-confirm-overlay"
            variants={overlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <h2 className="raid-confirm-title">Ваша награда</h2>
            <div className="raid-confirm-card">
              {rewardPreview.imageUrl && (
                <img
                  src={rewardPreview.imageUrl}
                  alt={rewardPreview.label}
                  className="raid-confirm-image"
                />
              )}
              <div className="raid-confirm-info">
                <span className="raid-confirm-label">
                  {rewardPreview.label}
                </span>
                <span className="raid-confirm-value">
                  {rewardPreview.value || "—"}
                </span>
              </div>
            </div>
            <button className="raid-confirm-btn" onClick={handleConfirmReward}>
              Получить
            </button>
          </motion.div>
        )}

        {roulettePhase === ROULETTE_PHASES.results && (
          <motion.div
            key="results"
            className="raid-result-overlay"
            variants={overlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <RaidConfetti active={showConfetti} />
            <motion.h2
              variants={resultsVariants.item}
              initial="hidden"
              animate="show"
            >
              Бой завершён
            </motion.h2>
            <motion.div
              className="raid-result-stats"
              variants={resultsVariants.container}
              initial="hidden"
              animate="show"
            >
              <motion.p variants={resultsVariants.item}>
                Общий нанесённый урон: <strong>{totalDamage}</strong>
              </motion.p>
              <motion.p variants={resultsVariants.item}>
                Разыграно карт: <strong>{cardsUsed}</strong>
              </motion.p>
              <motion.p variants={resultsVariants.item}>
                Получено золота:{" "}
                <strong>
                  {moneyEarned + (rouletteSummary?.coins || 0)}
                </strong>
              </motion.p>
              <motion.p variants={resultsVariants.item}>
                Получено рецептов:{" "}
                <strong>
                  {extraCurrency + (rouletteSummary?.recipes || 0)}
                </strong>
              </motion.p>
              <motion.p variants={resultsVariants.item}>
                Получено билетов:{" "}
                <strong>{rouletteSummary?.tickets || 0}</strong>
              </motion.p>
              <motion.p variants={resultsVariants.item}>
                Получено XP: <strong>{xpGained}</strong>
              </motion.p>
              {rouletteSummary?.cardName && (
                <motion.p
                  className="raid-result-card"
                  variants={resultsVariants.item}
                >
                  Карта из рулетки:{" "}
                  <strong>{rouletteSummary.cardName}</strong>
                </motion.p>
              )}
            </motion.div>

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
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default RaidEndScreen;
