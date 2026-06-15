import type { WatchlistEntry } from "@types";
import { db } from "../level";
import { levelKeys } from "./keys";

export const watchlistSublevel = db.sublevel<string, WatchlistEntry>(
  levelKeys.watchlist,
  { valueEncoding: "json" }
);
