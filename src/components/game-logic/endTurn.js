// game-logic/endTurn.js
import { ref, set } from "firebase/database";
import { database } from "../firebase";

export default async function endTurn(uid, lobbyId) {
  const path = `lobbies/${lobbyId}/turns/${uid}`;
  console.log("[endTurn] write true:", path);

  try {
    await set(ref(database, path), true);
    console.log("[endTurn] success:", path);
  } catch (e) {
    console.error("[endTurn] failed:", path, e);
    throw e;
  }
}
