export interface SyncHistoryEntry {
  id: string;
  storeId: string;
  syncType: "library" | "playtime";
  status: "success" | "failed" | "partial";
  gamesSynced: number;
  errorMessage?: string | null;
  startedAt: number;
  completedAt: number;
}

import { db } from "../level";
import { levelKeys } from "./keys";

export const syncHistorySublevel = db.sublevel<string, SyncHistoryEntry>(
  levelKeys.syncHistory,
  { valueEncoding: "json" }
);
