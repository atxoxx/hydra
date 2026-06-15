import { registerEvent } from "../register-event";
import { watchlistSublevel } from "@main/level";
import type { WatchlistEntry } from "@types";

const getWatchlist = async (): Promise<WatchlistEntry[]> => {
  const entries: WatchlistEntry[] = [];

  for await (const entry of watchlistSublevel.iterator()) {
    entries.push(entry[1]);
  }

  return entries;
};

registerEvent("getWatchlist", getWatchlist);
