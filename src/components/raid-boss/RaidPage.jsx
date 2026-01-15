import React, { useEffect, useState, useRef } from "react";
import CachedImage from "../../utils/CachedImage";
import { useSearchParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { ref, onValue, get, off, runTransaction } from "firebase/database";
import { db, database } from "../firebase";
import RaidEndScreen from "./RaidEndScreen";
import "./PlayerBottomBar.css";
import "./player-hand.css";
import "./boss-container.css";
import { renderCardStats } from "../../utils/renderCardStats";
import FramedCard from "../../utils/FramedCard";
import {
  processDotEffects,
  applyDamageMultiplier,
  generateId,
} from "../../utils/cardEffects";
import {
  applyRaidModifiers,
  formatRaidCountdown,
  getRaidEventInfo,
} from "../../utils/raidEvents";

function RaidPage() {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get("start");
  const baseEnergy = 50;

  const [damageMultiplierEffect, setDamageMultiplierEffect] = useState(null);
  const [allBosses, setAllBosses] = useState({});
  const [currentBossKey, setCurrentBossKey] = useState(null);
  const [bossHP, setBossHP] = useState(1000);
  const [maxHP, setMaxHP] = useState(1000);
  const [bossName, setBossName] = useState("Рейд-Босс");
  const [bossImageUrl, setBossImageUrl] = useState("/images/raidboss.png");
  const [flyingCard, setFlyingCard] = useState(null);
  const [isBossShaking, setIsBossShaking] = useState(false);
  const [damageThisTurnDot, setDamageThisTurnDot] = useState(null);
  const [notEnoughEnergyMessage, setNotEnoughEnergyMessage] = useState(null);
  const [raidEvent, setRaidEvent] = useState(null);
  const [eventCountdown, setEventCountdown] = useState(0);

  const [gameStarted, setGameStarted] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);

  const bossHpRef = useRef(null);
  const hpFillRef = useRef(null);
  const [damageThisTurn, setDamageThisTurn] = useState(null);
  const [totalDamageDealt, setTotalDamageDealt] = useState(0);
  const [totalCardsPlayed, setTotalCardsPlayed] = useState(0);

  const [dotEffectsQueue, setDotEffectsQueue] = useState([]);
  const [hand, setHand] = useState([]);
  const [deck, setDeck] = useState([]);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [playingCard, setPlayingCard] = useState(null);
  const [energy, setEnergy] = useState(baseEnergy);

  const [turn, setTurn] = useState(0);

  const effectiveDamageMultipliers = damageMultiplierEffect
    ? [damageMultiplierEffect]
    : [];

  const nextTurnDotDamage = dotEffectsQueue
    .filter((effect) => effect.turnsLeft === 1)
    .reduce((sum, effect) => sum + effect.damage, 0);

  const totalMultiplier =
    effectiveDamageMultipliers.length > 0
      ? effectiveDamageMultipliers.reduce((acc, eff) => acc * eff.multiplier, 1)
      : 1;

  const nextTurnDotDamageWithMultiplier = Math.round(
    nextTurnDotDamage * totalMultiplier
  );

  const baseModifiers = {
    energyMultiplier: 1,
    costMultiplier: 1,
    damageMultiplier: 1,
    extraPlayChance: 0,
    burnBonus: 0,
  };
  const raidModifiers = applyRaidModifiers(raidEvent, baseModifiers);

  useEffect(() => {
    if (gameStarted) return;
    setEnergy(Math.round(baseEnergy * raidModifiers.energyMultiplier));
  }, [baseEnergy, gameStarted, raidModifiers.energyMultiplier]);

  useEffect(() => {
    const updateEvent = () => {
      const { event, secondsRemaining } = getRaidEventInfo();
      setRaidEvent(event);
      setEventCountdown(secondsRemaining);
    };
    updateEvent();
    const timer = setInterval(updateEvent, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!gameStarted) return;

    const {
      bossHP: newBossHP,
      newDotEffectsQueue,
      newDamageMultiplierEffect,
      dotDamageThisTurn,
    } = processDotEffects(bossHP, dotEffectsQueue, damageMultiplierEffect);

    setBossHP(newBossHP);
    setDotEffectsQueue(newDotEffectsQueue);
    setDamageMultiplierEffect(newDamageMultiplierEffect);

    if (dotDamageThisTurn && dotDamageThisTurn > 0) {
      setDamageThisTurnDot({
        id: generateId(),
        value: dotDamageThisTurn,
      });
      setTotalDamageDealt((prev) => prev + dotDamageThisTurn);
    }
  }, [turn]);

  useEffect(() => {
    const bossesRef = ref(database, "Raid_BOSS");
    get(bossesRef)
      .then((snapshot) => {
        if (!snapshot.exists()) {
          console.warn("Raid_BOSS пустой");
          return;
        }
        const bosses = snapshot.val();
        setAllBosses(bosses);

        const keysSorted = Object.keys(bosses).sort(
          (a, b) => Number(a) - Number(b)
        );
        const firstAliveKey =
          keysSorted.find((key) => (bosses[key].hp ?? 0) > 0) || keysSorted[0];
        setCurrentBossKey(firstAliveKey);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!currentBossKey || !allBosses[currentBossKey]) return;

    if (bossHpRef.current) {
      off(bossHpRef.current);
    }

    const bossData = allBosses[currentBossKey];

    setBossName(bossData.name || "Рейд-Босс");
    setBossHP(bossData.hp ?? bossData.max_hp ?? 1000);
    setMaxHP(bossData.max_hp ?? 1000);
    setBossImageUrl(bossData.image_url || "/images/raidboss.png");

    const hpRef = ref(database, `Raid_BOSS/${currentBossKey}/hp`);
    bossHpRef.current = hpRef;

    const listener = (snapshot) => {
      const hp = snapshot.val();
      if (hp !== null && hp !== undefined) {
        setBossHP(hp);
        if (hp === 0) setShowEndScreen(true);
      }
    };

    onValue(hpRef, listener);

    return () => {
      off(hpRef, "value", listener);
    };
  }, [currentBossKey, allBosses]);

  useEffect(() => {
    if (!uid) return;
    async function fetchDeckAndHand() {
      try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (!userDoc.exists()) return;

        const userData = userDoc.data();
        const deckRaid = userData.deck_raid || [];

        const shuffledIds = [...deckRaid].sort(() => 0.5 - Math.random());

        const cardPromises = shuffledIds.map(async (cardId) => {
          const snapshot = await get(ref(database, `cards/${cardId}`));
          return { id: cardId, ...snapshot.val() };
        });

        const cards = await Promise.all(cardPromises);

        setHand(cards.slice(0, 4));
        setDeck(cards.slice(4));

        setGameStarted(true);
      } catch (error) {
        console.error("Ошибка загрузки колоды рейда:", error);
      }
    }
    fetchDeckAndHand();
  }, [uid]);

  const currentHpPercent = Math.max(0, Math.min(100, (bossHP / maxHP) * 100));

  useEffect(() => {
    if (hpFillRef.current) {
      hpFillRef.current.style.width = `${currentHpPercent}%`;
    }
  }, [currentHpPercent]);

  if (showEndScreen) {
    return (
      <RaidEndScreen
        totalDamage={totalDamageDealt}
        cardsUsed={totalCardsPlayed}
      />
    );
  }

  function handleCardClick(cardId) {
    setSelectedCardId((prev) => (prev === cardId ? null : cardId));
  }

  async function applyDamageToBossInDatabase(bossKey, damage) {
    if (!bossKey || damage <= 0) return;

    const bossHpRef = ref(database, `Raid_BOSS/${bossKey}/hp`);

    try {
      await runTransaction(bossHpRef, (currentHp) => {
        if (currentHp === null) return 0;
        const newHp = currentHp - damage;
        return newHp < 0 ? 0 : newHp;
      });
    } catch (error) {
      console.error("Ошибка при обновлении HP босса:", error);
    }
  }

  function handleDamageAnimationEnd() {
    setDamageThisTurn(null);
  }

  function playCard(card) {
    if (flyingCard) return;

    const baseCost = card.value ?? 0;
    const cardCost = Math.max(
      0,
      Math.ceil(baseCost * raidModifiers.costMultiplier)
    );
    if (energy < cardCost) {
      setNotEnoughEnergyMessage(`Недостаточно энергии (${energy}/${cardCost})`);
      setTimeout(() => setNotEnoughEnergyMessage(null), 2000);
      return;
    }

    setEnergy((prev) => prev - cardCost);

    setFlyingCard(card);
    setSelectedCardId(null);
    setPlayingCard(card);

    setTimeout(async () => {
      const isRemoveMultiplierCard = card.remove_multiplier === true;
      const multiplier = damageMultiplierEffect
        ? damageMultiplierEffect.multiplier
        : 1;
      const eventMultiplier = raidModifiers.damageMultiplier;
      let immediateDamage = 0;

      setTotalCardsPlayed((prev) => prev + 1);

      if (!isRemoveMultiplierCard) {
        if (typeof card.damage === "number" && card.damage > 0) {
          immediateDamage = Math.floor(
            card.damage * multiplier * eventMultiplier
          );
        }

        let instantDotDamage = 0;
        if (
          Array.isArray(card.damage_over_time) &&
          card.damage_over_time.length > 0
        ) {
          instantDotDamage = Math.floor(
            card.damage_over_time[0] * multiplier * eventMultiplier
          );
          immediateDamage += instantDotDamage;
        }
      } else {
        setDamageMultiplierEffect(null);
      }

      if (raidModifiers.burnBonus > 0 && immediateDamage > 0) {
        immediateDamage += Math.floor(immediateDamage * raidModifiers.burnBonus);
      }

      await applyDamageToBossInDatabase(currentBossKey, immediateDamage);
      setDamageThisTurn(
        immediateDamage > 0
          ? { id: generateId(), value: immediateDamage }
          : null
      );
      setTotalDamageDealt((prev) => prev + immediateDamage);

      if (!isRemoveMultiplierCard) {
        if (
          Array.isArray(card.damage_over_time) &&
          card.damage_over_time.length > 1
        ) {
          const futureDotDamages = card.damage_over_time.slice(1);
          const newEffects = futureDotDamages
            .filter((d) => d > 0)
            .map((damage, i) => ({
              damage,
              turnsLeft: i + 2,
              id: generateId(),
            }));

          setDotEffectsQueue((prevQueue) => [...prevQueue, ...newEffects]);
        }
      }

      if (!isRemoveMultiplierCard) {
        const newDamageMultiplier = applyDamageMultiplier(
          card,
          damageMultiplierEffect
        );
        setDamageMultiplierEffect(newDamageMultiplier);
      }

      setHand((prevHand) => prevHand.filter((c) => c.id !== card.id));
      setDeck((prevDeck) => {
        const newDeck = [...prevDeck, card];
        if (newDeck.length === 0) return newDeck;
        const nextCard = newDeck[0];
        setHand((prevHand) => [...prevHand, nextCard]);
        return newDeck.slice(1);
      });

      setPlayingCard(null);
      setFlyingCard(null);

      const updatedHand = [...hand.filter((c) => c.id !== card.id)];
      const newDeckTop = deck.length > 0 ? [deck[0]] : [];
      const totalNewHand = [...updatedHand, ...newDeckTop];

      const energyAfterPlay = energy - cardCost;
      const canPlayAny = totalNewHand.some(
        (c) =>
          Math.ceil((c.value ?? 0) * raidModifiers.costMultiplier) <=
          energyAfterPlay
      );

      if (!canPlayAny) {
        setShowEndScreen(true);
        return;
      }

      if (immediateDamage > 0) {
        setIsBossShaking(true);
        setTimeout(() => {
          setIsBossShaking(false);
          setTurn((prevTurn) => prevTurn + 1);
        }, 500);
      } else {
        setTurn((prevTurn) => prevTurn + 1);
      }

      if (
        raidModifiers.extraPlayChance > 0 &&
        Math.random() < raidModifiers.extraPlayChance
      ) {
        const remainingHand = totalNewHand.filter((c) => c.id !== card.id);
        if (remainingHand.length > 0) {
          const extraCard =
            remainingHand[Math.floor(Math.random() * remainingHand.length)];
          const extraCost = Math.ceil(
            (extraCard.value ?? 0) * raidModifiers.costMultiplier
          );
          if (energyAfterPlay >= extraCost) {
            playCard(extraCard);
          }
        }
      }
    }, 350);
  }

  return (
    <div className="raid-page">
      <div className="red-flash left" />
      <div className="red-flash right" />
      <div className={`boss-container ${isBossShaking ? "screen-shake" : ""}`}>
        <img
          src={bossImageUrl}
          alt={bossName}
          className="boss-image"
          draggable={false}
        />
        <div className="boss-info-overlay">
          <div className="boss-name">{bossName}</div>
          {damageThisTurnDot && (
            <div
              className="damage-number dot-damage"
              key={`dot-${damageThisTurnDot.id}`}
              onAnimationEnd={() => setDamageThisTurnDot(null)}
            >
              -{damageThisTurnDot.value.toLocaleString()}
            </div>
          )}
          {damageThisTurn && (
            <div
              className="damage-number"
              key={damageThisTurn.id}
              onAnimationEnd={handleDamageAnimationEnd}
            >
              -{damageThisTurn.value.toLocaleString()}
            </div>
          )}

          <div
            className="boss-hp-bar"
            aria-label={`HP босса: ${bossHP} из ${maxHP}`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={maxHP}
            aria-valuenow={bossHP}
          >
            <div className="hp-bar-fill" ref={hpFillRef} />
            <div className="hp-label">
              {Math.max(0, Math.floor(bossHP)).toLocaleString()} /{" "}
              {Math.floor(maxHP).toLocaleString()} HP
            </div>
          </div>

          <div className="damage-multiplier-effects">
            {effectiveDamageMultipliers.length > 0 ? (
              effectiveDamageMultipliers.map((effect) => (
                <div
                  key={effect.id}
                  title={`Множитель урона: ${effect.multiplier.toFixed(
                    2
                  )}x, ходов осталось: ${effect.turnsLeft + 1}`}
                  className="damage-multiplier-chip"
                >
                  +{effect.multiplier.toFixed(2)}x ({effect.turnsLeft})
                </div>
              ))
            ) : (
              <div className="damage-multiplier-empty">Эффектов нет</div>
            )}

            <div
              className="damage-multiplier-next"
              title="Следующий урон по времени с учётом множителей"
            >
              След. DoT: {nextTurnDotDamage.toLocaleString()} →{" "}
              {nextTurnDotDamageWithMultiplier.toLocaleString()}
            </div>
          </div>
          {raidEvent && (
            <div className="raid-event-banner">
              <div className="raid-event-title">{raidEvent.title}</div>
              <div className="raid-event-desc">{raidEvent.description}</div>
              <div className="raid-event-timer">
                Смена через {formatRaidCountdown(eventCountdown)}
              </div>
            </div>
          )}
        </div>

        {playingCard && !flyingCard && (
          <FramedCard
            card={playingCard}
            onClick={() => handleCardClick(playingCard.id)}
            showLevel={true}
            showName={false}
          />
        )}

        <div className="player-bottom-bar">
          <div
            className="player-hand-platform"
            onClick={() => setSelectedCardId(null)}
            tabIndex={-1}
          >
            <div className="energy-indicator" aria-label={`Энергия: ${energy}`}>
              {energy}
            </div>
            <div
              className="player-hand"
              aria-label={`Рука игрока: ${hand.length} карт`}
            >
              {hand.map((card) => {
                const isSelected = selectedCardId === card.id;
                return (
                  <div
                    key={card.id}
                    className={`card-in-hand-wrapper${
                      isSelected ? " selected" : ""
                    }`}
                    title={card.name}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCardClick(card.id);
                    }}
                    data-playable={playingCard ? "false" : "true"}
                  >
                    <FramedCard card={card} showLevel={true} showName={false} />

                    {card.value !== undefined && (
                      <div
                        className="card-corner cost"
                        aria-label={`Стоимость: ${card.value}`}
                      >
                        {Math.ceil(
                          (card.value ?? 0) * raidModifiers.costMultiplier
                        )}
                      </div>
                    )}

                    {renderCardStats(card).map((stat, index) => (
                      <div
                        key={stat.label + index}
                        className={`card-corner ${stat.type} stat-${index}`}
                        aria-label={stat.label}
                      >
                        {stat.value !== null ? stat.value : "×"}
                      </div>
                    ))}

                    {isSelected && !playingCard && (
                      <button
                        className="play-card-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          playCard(card);
                        }}
                        aria-label={`Разыграть карту ${card.name}`}
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M12 4L12 20M12 4L6 10M12 4L18 10"
                            stroke="#000"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {flyingCard && (
        <CachedImage
          src={flyingCard.image_url}
          alt={flyingCard.name}
          className="playing-card-fly"
          draggable={false}
        />
      )}
      {notEnoughEnergyMessage && (
        <div className="energy-warning">{notEnoughEnergyMessage}</div>
      )}
    </div>
  );
}

export default RaidPage;
