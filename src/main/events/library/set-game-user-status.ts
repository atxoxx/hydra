import { ipcMain } from "electron";
import { gamesSublevel, levelKeys } from "@main/level";
import type { Game, GameShop, UserGameStatus } from "@types";
import { networkLogger as logger } from "@main/services/logger";

ipcMain.handle(
  "setGameUserStatus",
  async (_event, shop: string, objectId: string, status: UserGameStatus) => {
    try {
      const gameKey = levelKeys.game(shop as GameShop, objectId);

      const game = await gamesSublevel.get(gameKey).catch(() => null);

      if (!game) {
        throw new Error(`Game not found: ${shop}:${objectId}`);
      }

      const updated: Game = {
        ...game,
        userStatus: status === "none" ? null : status,
        userStatusUpdatedAt:
          status === "none" ? null : new Date(),
      };

      await gamesSublevel.put(gameKey, updated);

      return { ok: true };
    } catch (error) {
      logger.error("setGameUserStatus failed:", error);
      return { ok: false, error: String(error) };
    }
  }
);
