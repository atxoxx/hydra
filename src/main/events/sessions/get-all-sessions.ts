import type { GameSession } from "@main/level";
import { sessionsSublevel, levelKeys, gamesSublevel } from "@main/level";
import { registerEvent } from "../register-event";

export interface SessionWithGame extends GameSession {
  gameTitle: string;
  gameIconUrl: string | null;
}

const getAllSessions = async (
  _event: Electron.IpcMainInvokeEvent,
  limit?: number,
  offset?: number
): Promise<SessionWithGame[]> => {
  const sessions: SessionWithGame[] = [];
  const gamesCache = new Map<
    string,
    { title: string; iconUrl: string | null }
  >();

  for await (const [, value] of sessionsSublevel.iterator()) {
    const gameKey = levelKeys.game(value.shop, value.objectId);
    let gameDetails = gamesCache.get(gameKey);

    if (!gameDetails) {
      try {
        const game = await gamesSublevel.get(gameKey);
        gameDetails = {
          title: game?.title ?? value.objectId,
          iconUrl: game?.iconUrl ?? null,
        };
      } catch {
        gameDetails = {
          title: value.objectId,
          iconUrl: null,
        };
      }
      gamesCache.set(gameKey, gameDetails);
    }

    sessions.push({
      ...value,
      gameTitle: gameDetails.title,
      gameIconUrl: gameDetails.iconUrl,
    });
  }

  // Sort by start time descending (most recent first)
  sessions.sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );

  const start = offset ?? 0;
  const end = limit ? start + limit : sessions.length;

  return sessions.slice(start, end);
};

registerEvent("getAllSessions", getAllSessions);
