import { registerEvent } from "../register-event";
import { watchlistSublevel, levelKeys } from "@main/level";
import type { GameShop, WatchlistEntry, WatchlistPriority } from "@types";

const addToWatchlist = async (
  _event: Electron.IpcMainInvokeEvent,
  data: {
    shop: GameShop;
    objectId: string;
    title: string;
    priority: WatchlistPriority;
    notes: string;
    initialDownloadSources?: string[];
    libraryImageUrl?: string | null;
  }
) => {
  const key = levelKeys.watchlistEntry(data.shop, data.objectId);

  // Preserve original fields if the entry already exists
  let addedAt = new Date().toISOString();
  let initialDownloadSources = data.initialDownloadSources ?? [];
  let libraryImageUrl = data.libraryImageUrl ?? null;
  try {
    const existing = await watchlistSublevel.get(key);
    if (existing) {
      addedAt = existing.addedAt;
      initialDownloadSources = existing.initialDownloadSources;
      libraryImageUrl = existing.libraryImageUrl;
    }
  } catch {
    // Entry doesn't exist yet, use current values
  }

  const entry: WatchlistEntry = {
    shop: data.shop,
    objectId: data.objectId,
    title: data.title,
    addedAt,
    priority: data.priority,
    notes: data.notes,
    initialDownloadSources,
    libraryImageUrl,
  };

  try {
    await watchlistSublevel.put(key, entry);
  } catch (error) {
    throw new Error(`Failed to add to watchlist: ${error}`);
  }
};

registerEvent("addToWatchlist", addToWatchlist);
