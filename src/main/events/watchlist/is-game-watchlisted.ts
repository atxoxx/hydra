import { registerEvent } from "../register-event";
import { watchlistSublevel, levelKeys } from "@main/level";
import type { GameShop } from "@types";

const isGameWatchlisted = async (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string
) => {
  const key = levelKeys.watchlistEntry(shop, objectId);

  try {
    const entry = await watchlistSublevel.get(key);
    return !!entry;
  } catch {
    return false;
  }
};

registerEvent("isGameWatchlisted", isGameWatchlisted);
