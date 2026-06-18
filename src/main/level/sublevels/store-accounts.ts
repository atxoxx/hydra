import type { StoreAccount } from "@types";
import { db } from "../level";
import { levelKeys } from "./keys";

export const storeAccountsSublevel = db.sublevel<string, StoreAccount>(
  levelKeys.storeAccounts,
  { valueEncoding: "json" }
);
