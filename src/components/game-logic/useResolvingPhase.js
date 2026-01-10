// useResolvingPhase.js
import { useEffect, useRef } from "react";
import { ref, set, onValue, get, update } from "firebase/database";
import { strikeSequence, showDamageNumber } from "../game/strikeAnimations";
import {
  applyDamagePvP,
  applyDamageMultiplierPvP,
  applyHealPvP,
  applyDotPvP,
} from "./cardEffectsPvP";
import { addEnergy, spendEnergy } from "./energyManager";
import { checkEndGame } from "./endGame";

import drawCards from "./drawCards";

function normalizePriority(value) {
  if (value === null || value === undefined) return 9999;
  const num = Number(value);
  return isNaN(num) ? 9999 : num;
}

function sortPlayedCards(cards) {
  return [...cards].sort((a, b) => {
    const aTs = Number(a.ts ?? 0);
    const bTs = Number(b.ts ?? 0);
    if (aTs !== bTs) return aTs - bTs;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });
}

export default function useResolvingPhase(params) {
  const {
    uid,
    lobbyId,
    isHost,
    turnEnded,
    opponentTurnEnded,
    playedCards,
    opponentPlayed,
    priorityUid,
    effectsByUid,
    setEffectsByUid,
    setProcessedCardIds,
    processedCardIds,
    setRoundPhase,
    setWaitingForOpponent,
    setTurnEnded,
    setOpponentTurnEnded,
    setAutoEndTriggered,
    setPlayedCards,
    setOpponentPlayed,
    hand,
    setHand,
    deck,
    setDeck,
    gameData,
    startNewTurnTimer,
    database,
    round, // текущий раунд
    setRound,
    setShowRound,
    setShowDamageFlash,
    navigate,
  } = params;

  // Отслеживаем HP игрока локально (чтобы показать флеш)
  const playerHpRef = useRef(gameData?.player?.hp ?? 100);

  useEffect(() => {
    if (!(turnEnded && opponentTurnEnded)) return;

    (async () => {
      setWaitingForOpponent(false);
      setRoundPhase("resolving");

      if (params.setHandVisible) params.setHandVisible(false);
      let syncedPlayerCards = playedCards || [];
      let syncedOpponentCards = opponentPlayed || [];

      // Синхронизация локальных playedCards/opponentPlayed с RTDB
      try {
        const playerPath = `lobbies/${lobbyId}/playedCards/${uid}`;
        const oppPath = `lobbies/${lobbyId}/playedCards/${gameData?.opponentUid}`;

        const [snapPlayer, snapOpp] = await Promise.all([
          get(ref(database, playerPath)),
          get(ref(database, oppPath)),
        ]);

        const playerData = snapPlayer.val() || {};
        const oppData = snapOpp.val() || {};

        syncedPlayerCards = sortPlayedCards(
          Object.entries(playerData).map(([id, raw]) => ({ id, ...raw }))
        );
        syncedOpponentCards = sortPlayedCards(
          Object.entries(oppData).map(([id, raw]) => ({ id, ...raw }))
        );

        setPlayedCards(syncedPlayerCards);
        setOpponentPlayed(syncedOpponentCards);

        console.log("[useResolvingPhase] Синхронизация playedCards с RTDB", {
          syncedPlayerCards,
          syncedOpponentCards,
        });
      } catch (err) {
        console.warn(
          "[useResolvingPhase] Не удалось синхронизировать playedCards",
          err
        );
      }

      await new Promise((res) => setTimeout(res, 600));

      const resolvedPlayerCards = sortPlayedCards(syncedPlayerCards);
      const resolvedOpponentCards = sortPlayedCards(syncedOpponentCards);

      const myCards = resolvedPlayerCards.map((c) => ({
        id: c.id,
        name: c.name,
        owner: uid,
        ownerLabel: "player",
        priority: c.priority,
        ts: c.ts,
        raw: c,
      }));

      const oppCards = resolvedOpponentCards.map((c) => ({
        id: c.id,
        name: c.name,
        owner: gameData?.opponentUid,
        ownerLabel: "opponent",
        priority: c.priority,
        ts: c.ts,
        raw: c,
      }));

      const seen = new Set();
      const combined = [...myCards, ...oppCards]
        .filter(
          (c) =>
            !processedCardIds.has(c.id) && !seen.has(c.id) && seen.add(c.id)
        )
        .sort((a, b) => {
          const pa = normalizePriority(a.priority);
          const pb = normalizePriority(b.priority);
          if (pa === pb) {
            if (a.owner === priorityUid && b.owner !== priorityUid) return -1;
            if (b.owner === priorityUid && a.owner !== priorityUid) return 1;
            return a.ts - b.ts;
          }
          return pa - pb;
        });

      for (const card of combined) {
        // ⚡ Проверка энергии (если у карты есть energyCost)
        if (typeof card.raw.energyCost === "number") {
          const ok = await spendEnergy(
            database,
            lobbyId,
            card.owner,
            card.raw.energyCost
          );
          if (!ok) {
            console.warn(
              `[Energy] Карта ${card.raw.name} не сыграна — не хватило энергии`
            );
            setProcessedCardIds((prev) => new Set(prev).add(card.id));
            continue; // пропускаем эту карту
          }
          console.log(`[Energy] ${card.owner} потратил ${card.raw.energyCost}`);
        }
        // damageTarget — цель для урона (всегда противоположная сторона),
        // healTarget — цель для лечения (владелец карты)
        const damageTargetUid = card.owner === uid ? gameData.opponentUid : uid;
        const healTargetUid = card.owner;
        const attackerUid = card.owner;

        // Определяем: карта лечит или бьёт
        const isHealCard =
          typeof card.raw.heal === "number" && card.raw.heal > 0;
        const isMultiplierCard =
          typeof card.raw.damage_multiplier === "number" &&
          card.raw.damage_multiplier > 0;

        // Выбираем effectiveTarget в зависимости от типа карты
        const attackerEffects = effectsByUid[attackerUid] || { mult: null };
        const nextMult = isMultiplierCard
          ? applyDamageMultiplierPvP(attackerEffects.mult, card.raw)
          : attackerEffects.mult;

        if (isMultiplierCard && nextMult !== attackerEffects.mult) {
          await set(
            ref(database, `lobbies/${lobbyId}/effects/${attackerUid}/multiplier`),
            nextMult
          );
          setEffectsByUid((prev) => ({
            ...prev,
            [attackerUid]: {
              ...(prev[attackerUid] || {}),
              mult: nextMult,
            },
          }));
        }

        // Определяем задержку нанесения урона / применения лечения (в ms)
        const damageDelayMs =
          (typeof card.raw.damageDelayMs === "number"
            ? card.raw.damageDelayMs
            : 450) || 450;

        // Задержка между картами (после окончания анимации и нанесения урона)
        const interCardDelayMs = 1000;

        // Позиция аватара для показа цифры (top/bottom) — для effectiveTarget
        const targetPos =
          (isHealCard ? healTargetUid : damageTargetUid) ===
          gameData?.opponentUid
            ? "top"
            : "bottom";
        const isDotCard = Array.isArray(card.raw.damage_over_time);
        let turnsLeft =
          card.raw.dotTurnsLeft ?? card.raw.damage_over_time?.length ?? 0;
        const isFinalDot = isDotCard && turnsLeft === 1;
        // Если это карта множителя — только наложение эффекта, без урона/лечения
        if (isMultiplierCard) {
          console.log(
            "[useResolvingPhase] Разыграна карта множителя:",
            card.raw.damage_multiplier
          );

          // анимация — просто показ розыгрыша (без атаки)
          await strikeSequence(
            card.ownerLabel === "player" ? "player" : "opponent",
            card.ownerLabel === "player" ? "top" : "bottom",
            lobbyId,
            card.owner,
            database,
            card.id,
            false,
            null,
            null,
            null,
            0,
            450,
            false, // не heal
            false // не dot
          );

          // ничего не делаем с hp
          await new Promise((res) => setTimeout(res, interCardDelayMs));

          setProcessedCardIds((prev) => {
            const s = new Set(prev);
            s.add(card.id);
            return s;
          });

          continue; // <-- ключевое: пропускаем урон/лечение
        }

        const strikePromise = strikeSequence(
          card.ownerLabel === "player" ? "player" : "opponent",
          card.ownerLabel === "player" ? "top" : "bottom",
          lobbyId,
          card.owner,
          database,
          card.id,
          false,
          null,
          null,
          null,
          0,
          450,
          isHealCard,
          isDotCard && !isFinalDot // последний тик = обычная анимация
        );
        if (isHealCard) {
          // === Heal logic: лечим владельца карты (healTargetUid) ===
          const healPromise = (async () => {
            await new Promise((res) => setTimeout(res, damageDelayMs));

            const newHp = await applyHealPvP(healTargetUid, card.raw, lobbyId);

            // показываем визуально число лечения (если возможно)
            try {
              const hpBefore = null; // не читаем отдельно, show number uses heal value
              const healValue = Number(card.raw.heal) || 0;
              const avatarEl = document.querySelector(
                `.player-avatar[data-position="${targetPos}"]`
              );
              if (avatarEl && healValue > 0) {
                // showDamageNumber обычно показывает урон; для лечения используем тот же вызов
                showDamageNumber(avatarEl, healValue);
              }
            } catch (err) {
              console.warn(
                "[useResolvingPhase] не удалось показать цифру лечения",
                err
              );
            }

            // обновляем локальный ref только если это локальный игрок
            if (healTargetUid === uid && typeof newHp === "number") {
              playerHpRef.current = newHp;

              // Проверка конца игры
              checkEndGame({
                database,
                lobbyId,
                uid,
                opponentUid: gameData?.opponentUid,
                navigate,
              });
            }
          })();

          await Promise.all([strikePromise, healPromise]);
        } else if (isDotCard) {
          // === DoT logic ===
          const tickIndex = card.raw.damage_over_time.length - turnsLeft;
          const dotDamage = Number(card.raw.damage_over_time[tickIndex]) || 0;

          const damagePromise = (async () => {
            await new Promise((res) => setTimeout(res, damageDelayMs));
          const newHp = await applyDotPvP(
            damageTargetUid,
            card.raw,
            tickIndex,
            lobbyId,
            nextMult
          );

            if (damageTargetUid === uid && typeof newHp === "number") {
              if (newHp < playerHpRef.current) {
                setShowDamageFlash(true);
                setTimeout(() => setShowDamageFlash(false), 600);
              }
              playerHpRef.current = newHp;

              // Проверка конца игры
              checkEndGame({
                database,
                lobbyId,
                uid,
                opponentUid: gameData?.opponentUid,
                navigate,
              });
            }

            try {
              const avatarEl = document.querySelector(
                `.player-avatar[data-position="${targetPos}"]`
              );
              if (avatarEl && dotDamage > 0) {
                const effective = Math.max(
                  1,
                  Math.round(dotDamage * (nextMult?.multiplier ?? 1))
                );
                showDamageNumber(avatarEl, effective);
              }
            } catch (err) {
              console.warn(
                "[useResolvingPhase] не удалось показать цифру DoT",
                err
              );
            }
          })();

          await Promise.all([strikePromise, damagePromise]);

          // обновляем dotTurnsLeft в RTDB
          const newTurnsLeft = turnsLeft - 1;
          card.raw.dotTurnsLeft = newTurnsLeft;
          if (newTurnsLeft <= 0) {
            await set(
              ref(
                database,
                `lobbies/${lobbyId}/playedCards/${card.owner}/${card.id}`
              ),
              null
            );
          } else {
            await set(
              ref(
                database,
                `lobbies/${lobbyId}/playedCards/${card.owner}/${card.id}/dotTurnsLeft`
              ),
              newTurnsLeft
            );
          }
        } else {
          // === Damage logic ===
          const baseDamage =
            typeof card.raw.damage === "number"
              ? card.raw.damage
              : typeof card.raw.attack === "number"
              ? card.raw.attack
              : 0;
          const damage =
            Math.max(1, Math.floor(baseDamage * (nextMult?.multiplier ?? 1))) ||
            0;

          const damagePromise = (async () => {
            await new Promise((res) => setTimeout(res, damageDelayMs));

            const newHp = await applyDamagePvP(
              damageTargetUid,
              card.raw,
              nextMult,
              lobbyId
            );

            if (damageTargetUid === uid) {
              if (newHp < playerHpRef.current) {
                setShowDamageFlash(true);
                setTimeout(() => setShowDamageFlash(false), 600);
              }
              playerHpRef.current = newHp;

              // Проверка конца игры
              checkEndGame({
                database,
                lobbyId,
                uid,
                opponentUid: gameData?.opponentUid,
                navigate,
              });
            }

            try {
              const avatarEl = document.querySelector(
                `.player-avatar[data-position="${targetPos}"]`
              );
              if (avatarEl && typeof damage === "number" && damage > 0) {
                showDamageNumber(avatarEl, damage);
              }
            } catch (err) {
              console.warn(
                "[useResolvingPhase] не удалось показать цифру урона",
                err
              );
            }
          })();

          await Promise.all([strikePromise, damagePromise]);
        }

        await new Promise((res) => setTimeout(res, interCardDelayMs));

        setProcessedCardIds((prev) => {
          const s = new Set(prev);
          s.add(card.id);
          return s;
        });
      }

      if (isHost) await set(ref(database, `lobbies/${lobbyId}/animAck`), null);
      await new Promise((r) => setTimeout(r, 300));

      if (isHost && uid && gameData?.opponentUid && lobbyId) {
        await set(ref(database, `lobbies/${lobbyId}/turns/${uid}`), null);
        await set(
          ref(database, `lobbies/${lobbyId}/turns/${gameData.opponentUid}`),
          null
        );
        await set(
          ref(database, `lobbies/${lobbyId}/resolvingDone`),
          Date.now()
        );
        await startNewTurnTimer();
      }

      if (isHost) {
        const roundRef = ref(database, `lobbies/${lobbyId}/round`);
        let currentRound = 0;
        await new Promise((resolve) => {
          onValue(
            roundRef,
            (snapshot) => {
              currentRound = snapshot.val() || 0;
              resolve();
            },
            { onlyOnce: true }
          );
        });

        const newRound = currentRound + 1;
        await set(roundRef, newRound);
        if (setRound) setRound(newRound);

        // В начале раунда: добавляем +4 энергии обоим
        try {
          await addEnergy(database, lobbyId, uid, 4);
          await addEnergy(database, lobbyId, gameData?.opponentUid, 4);
          console.log("[Energy] Добавлено +4 энергии обоим игрокам");
        } catch (err) {
          console.warn("[Energy] Ошибка добавления энергии", err);
        }

        // определяем, кто начинает следующий раунд
        const nextPriorityUid =
          currentRound % 2 === 0 ? uid : gameData?.opponentUid;

        await set(
          ref(database, `lobbies/${lobbyId}/priority`),
          nextPriorityUid
        );
      }

      if (setShowRound) {
        await new Promise((r) => setTimeout(r, 400));
        setShowRound(true);
        await new Promise((r) => setTimeout(r, 4000));
        setShowRound(false);
      }

      // Сбрасываем только обычные карты, DoT с dotTurnsLeft > 0 оставляем
      if (isHost && lobbyId && gameData?.opponentUid) {
        try {
          const playerPath = `lobbies/${lobbyId}/playedCards/${uid}`;
          const oppPath = `lobbies/${lobbyId}/playedCards/${gameData?.opponentUid}`;

          const [snapPlayer, snapOpp] = await Promise.all([
            get(ref(database, playerPath)),
            get(ref(database, oppPath)),
          ]);

          const playerData = snapPlayer.val() || {};
          const oppData = snapOpp.val() || {};

          const removals = [];

          for (const [cardId, raw] of Object.entries(playerData)) {
            const isDot = Array.isArray(raw?.damage_over_time);
            const turnsLeft = raw?.dotTurnsLeft ?? 0;
            if (!isDot || turnsLeft <= 0) {
              removals.push(
                set(ref(database, `${playerPath}/${cardId}`), null)
              );
            }
          }

          for (const [cardId, raw] of Object.entries(oppData)) {
            const isDot = Array.isArray(raw?.damage_over_time);
            const turnsLeft = raw?.dotTurnsLeft ?? 0;
            if (!isDot || turnsLeft <= 0) {
              removals.push(set(ref(database, `${oppPath}/${cardId}`), null));
            }
          }

          if (removals.length > 0) await Promise.all(removals);
        } catch (err) {
          console.warn(
            "[useResolvingPhase] Ошибка при очистке playedCards в RTDB",
            err
          );
        }
      }
      // в самом конце resolving, рядом с очисткой карт
      if (isHost && lobbyId) {
        try {
          const effectsRef = ref(database, `lobbies/${lobbyId}/effects`);
          const snap = await get(effectsRef);
          const allEffects = snap.val() || {};

          const updates = {};
          for (const [targetUid, eff] of Object.entries(allEffects)) {
            if (eff?.multiplier) {
              const turnsLeft = (eff.multiplier.turnsLeft ?? 0) - 1;
              if (turnsLeft > 0) {
                updates[`${targetUid}/multiplier/turnsLeft`] = turnsLeft;
              } else {
                updates[`${targetUid}/multiplier`] = null;
              }
            }
          }

          if (Object.keys(updates).length > 0) {
            await update(effectsRef, updates);
          }
        } catch (err) {
          console.warn(
            "[useResolvingPhase] Ошибка при уменьшении turnsLeft множителей",
            err
          );
        }
      }

      // Формируем "деки" только из реально сброшенных карт (неактивных DoT и обычных)
      const survivingPlayer = resolvedPlayerCards.filter(
        (c) => Array.isArray(c.damage_over_time) && (c.dotTurnsLeft ?? 0) > 0
      );
      const survivingOpponent = resolvedOpponentCards.filter(
        (c) => Array.isArray(c.damage_over_time) && (c.dotTurnsLeft ?? 0) > 0
      );

      const removedPlayer = resolvedPlayerCards.filter(
        (c) => !survivingPlayer.includes(c)
      );
      const removedOpponent = resolvedOpponentCards.filter(
        (c) => !survivingOpponent.includes(c)
      );

      // Сбрасываем dotTurnsLeft для карт, которые возвращаются в колоду,
      // чтобы при повторной игре они снова активировали эффект DOT
      const resetCardState = (card) => {
        const c = { ...card };

        // сброс DoT
        if (Array.isArray(c.damage_over_time)) {
          c.dotTurnsLeft = c.damage_over_time.length;
        } else {
          delete c.dotTurnsLeft;
        }

        // 🔓 снятие фиксации
        delete c.locked;

        return c;
      };

      const restoredPlayer = removedPlayer.map(resetCardState);
      const restoredOpponent = removedOpponent.map(resetCardState);
      const fullDeck = [...deck, ...restoredPlayer, ...restoredOpponent];
      // 🔚 САМЫЙ КОНЕЦ useResolvingPhase
      setRoundPhase("transition");

      // ⏱ даём React стабилизировать состояние
      await new Promise((r) => setTimeout(r, 0));

      setTurnEnded(false);
      setOpponentTurnEnded(false);

      // ⬇️ когда новый раунд полностью готов
      setRoundPhase("play");

      // ⬇️ undo снова возможно, но уже в новом раунде
      setTurnEnded(false);
      setOpponentTurnEnded(false);

      setPlayedCards(survivingPlayer);
      setOpponentPlayed(survivingOpponent);

      if (params.setHandVisible) params.setHandVisible(true);

      const { newHand, newDeck } = drawCards(hand, fullDeck);
      setHand(newHand);
      setDeck(newDeck);
    })();
  }, [turnEnded, opponentTurnEnded]);
}
