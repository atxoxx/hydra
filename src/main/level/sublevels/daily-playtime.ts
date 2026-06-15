import type { GameShop } from "@types";
import { db } from "../level";
import { levelKeys } from "./keys";

export interface DailyPlaytimeSnapshot {
  shop: GameShop;
  objectId: string;
  date: string;
  totalMilliseconds: number;
}

export const dailyPlaytimeSublevel = db.sublevel<
  string,
  DailyPlaytimeSnapshot
>(levelKeys.dailyPlaytime, {
  valueEncoding: "json",
});
