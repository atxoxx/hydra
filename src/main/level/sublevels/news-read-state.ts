import { db } from "../level";
import { levelKeys } from "./keys";

export interface NewsReadState {
  readAt: number;
}

export const newsReadStateSublevel = db.sublevel<string, NewsReadState>(
  levelKeys.newsReadState,
  { valueEncoding: "json" }
);

/**
 * Removes read-state entries older than `olderThanMs` (relative to now).
 * Returns the number of entries that were deleted.
 */
export const pruneOldReadStates = async (
  olderThanMs: number
): Promise<number> => {
  const cutoff = Date.now() - olderThanMs;
  let pruned = 0;
  for await (const [key, value] of newsReadStateSublevel.iterator()) {
    if (typeof value?.readAt === "number" && value.readAt < cutoff) {
      await newsReadStateSublevel.del(key);
      pruned++;
    }
  }
  return pruned;
};

export const clearAllReadStates = async (): Promise<number> => {
  let cleared = 0;
  for await (const [key] of newsReadStateSublevel.iterator()) {
    await newsReadStateSublevel.del(key);
    cleared++;
  }
  return cleared;
};
