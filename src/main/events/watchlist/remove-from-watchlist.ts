import { registerEvent } from "../register-event";
import { watchlistSublevel, levelKeys } from "@main/level";
import type { GameShop } from "@types";

const removeFromWatchlist = async (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string
) => {
  const key = levelKeys.watchlistEntry(shop, objectId);

  try {
    await watchlistSublevel.del(key);
  } catch (error) {
    throw new Error(`Failed to remove from watchlist: ${error}`);
  }
};

registerEvent("removeFromWatchlist", removeFromWatchlist);
