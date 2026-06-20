import type { GameShop } from "@types";
import {
  sessionsSublevel,
  levelKeys,
  gamesSublevel,
  dailyPlaytimeSublevel,
} from "@main/level";
import { registerEvent } from "../register-event";
import { logger, HydraApi } from "@main/services";

const deleteGameSession = async (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string,
  sessionId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const sessionKey = levelKeys.session(shop, objectId, sessionId);
    const session = await sessionsSublevel.get(sessionKey);
    if (!session) {
      return { success: false, error: "Session not found" };
    }

    // 1. Delete session from sublevel
    await sessionsSublevel.del(sessionKey);

    // 2. Adjust game playtime
    const gameKey = levelKeys.game(shop, objectId);
    const game = await gamesSublevel.get(gameKey);
    if (game) {
      const newPlaytimeMs = Math.max(
        0,
        (game.playTimeInMilliseconds ?? 0) - session.durationMs
      );
      const newPlaytimeSeconds = Math.trunc(newPlaytimeMs / 1000);

      if (game.remoteId) {
        try {
          await HydraApi.put(`/profile/games/${shop}/${objectId}/playtime`, {
            playTimeInSeconds: newPlaytimeSeconds,
          });
        } catch (apiError) {
          logger.error("Failed to sync updated playtime to cloud", apiError);
        }
      }

      await gamesSublevel.put(gameKey, {
        ...game,
        playTimeInMilliseconds: newPlaytimeMs,
        hasManuallyUpdatedPlaytime: true,
      });
    }

    // 3. Adjust daily playtime
    if (session.startTime) {
      const sessionDate = session.startTime.slice(0, 10);
      const dailyKey = levelKeys.dailyPlaytimeEntry(
        shop,
        objectId,
        sessionDate
      );
      try {
        const dailyEntry = await dailyPlaytimeSublevel.get(dailyKey);
        if (dailyEntry) {
          const newTotal = Math.max(
            0,
            dailyEntry.totalMilliseconds - session.durationMs
          );
          if (newTotal === 0) {
            await dailyPlaytimeSublevel.del(dailyKey);
          } else {
            await dailyPlaytimeSublevel.put(dailyKey, {
              ...dailyEntry,
              totalMilliseconds: newTotal,
            });
          }
        }
      } catch (dbError) {
        logger.error("Failed to adjust daily playtime", dbError);
      }
    }

    return { success: true };
  } catch (error) {
    logger.error("Failed to delete game session", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

registerEvent("deleteGameSession", deleteGameSession);
