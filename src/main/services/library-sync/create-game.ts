import type { Game } from "@types";
import { HydraApi } from "../hydra-api";
import { gamesSublevel, levelKeys } from "@main/level";

export const createGame = async (game: Game) => {
  if (game.shop === "custom") {
    return;
  }

  return HydraApi.post(`/profile/games`, {
    objectId: game.objectId,
    playTimeInMilliseconds: Math.trunc(game.playTimeInMilliseconds ?? 0),
    shop: game.shop,
    lastTimePlayed: game.lastTimePlayed,
  }).then((response) => {
    const {
      id: remoteId,
      playTimeInMilliseconds,
      lastTimePlayed,
      createdAt,
    } = response;

    // Keep the highest playtime — the API response may return stale/zero
    // values, especially for newly imported games. Prefer the local value
    // if it's higher (e.g. just synced from Steam).
    const bestPlaytime = Math.max(
      game.playTimeInMilliseconds ?? 0,
      playTimeInMilliseconds ?? 0
    );

    // Keep the most recent lastTimePlayed
    let bestLastPlayed = game.lastTimePlayed ?? lastTimePlayed;
    if (game.lastTimePlayed && lastTimePlayed) {
      const localTime = new Date(game.lastTimePlayed).getTime();
      const remoteTime = new Date(lastTimePlayed).getTime();
      bestLastPlayed = new Date(Math.max(localTime, remoteTime));
    }

    gamesSublevel.put(levelKeys.game(game.shop, game.objectId), {
      ...game,
      remoteId,
      addedToLibraryAt:
        game.addedToLibraryAt ?? (createdAt ? new Date(createdAt) : new Date()),
      playTimeInMilliseconds: bestPlaytime,
      lastTimePlayed: bestLastPlayed,
    });
  });
};
