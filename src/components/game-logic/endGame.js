// game-logic/endGame.js
import { databaseRef, get, update } from "../firebase";

export async function checkEndGame({ database, lobbyId, uid, opponentUid }) {
  try {
    const playerHpSnap = await get(
      databaseRef(database, `lobbies/${lobbyId}/hp/${uid}`)
    );
    const opponentHpSnap = await get(
      databaseRef(database, `lobbies/${lobbyId}/hp/${opponentUid}`)
    );

    const playerHp = playerHpSnap.val() ?? 0;
    const opponentHp = opponentHpSnap.val() ?? 0;

    if (playerHp <= 0 || opponentHp <= 0) {
      console.log(
        "[endGame] Конец игры. playerHp:",
        playerHp,
        "opponentHp:",
        opponentHp
      );

      const winner = playerHp > 0 ? uid : opponentUid;
      const loser = playerHp > 0 ? opponentUid : uid;

      // Обновляем статус лобби и пишем результат в него
      await update(databaseRef(database, `lobbies/${lobbyId}`), {
        status: "end",
        winner,
        loser,
        endedAt: Date.now(),
      });

      console.log("[endGame] Лобби переведено в статус end:", {
        lobbyId,
        winner,
        loser,
      });
    }
  } catch (err) {
    console.error("[endGame] Ошибка проверки конца игры", err);
  }
}
