import type { GameShop } from "@types";
import type { DailyPlaytimeSnapshot } from "@main/level";
import { dailyPlaytimeSublevel } from "@main/level";
import { registerEvent } from "../register-event";

export type DailyPlaytimeEntry = DailyPlaytimeSnapshot;

const getDailyPlaytime = async (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string,
  startDate: string,
  endDate: string
): Promise<DailyPlaytimeEntry[]> => {
  const entries: DailyPlaytimeEntry[] = [];

  for await (const [key, value] of dailyPlaytimeSublevel.iterator()) {
    if (!key.startsWith(`${shop}:${objectId}:`)) continue;

    const date = value.date;
    if (date >= startDate && date <= endDate) {
      entries.push(value);
    }
  }

  return entries;
};

registerEvent("getDailyPlaytime", getDailyPlaytime);
