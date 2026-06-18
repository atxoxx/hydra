import type { StoreGame } from "@types";
import { db } from "../level";
import { levelKeys } from "./keys";

export const storeGamesSublevel = db.sublevel<string, StoreGame>(
  levelKeys.storeGames,
  { valueEncoding: "json" }
);
