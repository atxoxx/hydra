import { dailyPlaytimeSublevel, gamesSublevel } from "@main/level";
import { registerEvent } from "../register-event";

export interface PlaytimeSummary {
  totalHours: number;
  gamesPlayed: number;
  mostActiveDate: string | null;
  mostActiveDateHours: number;
  averageHoursPerDay: number;
  topGames: {
    objectId: string;
    shop: string;
    title: string;
    iconUrl: string | null;
    totalMilliseconds: number;
  }[];
}

const getPlaytimeSummary = async (
  _event: Electron.IpcMainInvokeEvent,
  startDate: string,
  endDate: string
): Promise<PlaytimeSummary> => {
  const gamePlaytimeMap = new Map<
    string,
    { shop: string; objectId: string; totalMilliseconds: number }
  >();
  const dailyTotals = new Map<string, number>();

  for await (const [, value] of dailyPlaytimeSublevel.iterator()) {
    const date = value.date;
    if (date < startDate || date > endDate) continue;

    const gameKey = `${value.shop}:${value.objectId}`;

    const existing = gamePlaytimeMap.get(gameKey);
    if (existing) {
      existing.totalMilliseconds += value.totalMilliseconds;
    } else {
      gamePlaytimeMap.set(gameKey, {
        shop: value.shop,
        objectId: value.objectId,
        totalMilliseconds: value.totalMilliseconds,
      });
    }

    const dailyTotal = dailyTotals.get(date) ?? 0;
    dailyTotals.set(date, dailyTotal + value.totalMilliseconds);
  }

  const gamesPlayed = gamePlaytimeMap.size;

  let totalMilliseconds = 0;
  for (const [, game] of gamePlaytimeMap) {
    totalMilliseconds += game.totalMilliseconds;
  }
  const totalHours = totalMilliseconds / 3_600_000;

  let mostActiveDate: string | null = null;
  let mostActiveDateMs = 0;
  for (const [date, ms] of dailyTotals) {
    if (ms > mostActiveDateMs) {
      mostActiveDateMs = ms;
      mostActiveDate = date;
    }
  }

  const daysInRange = Math.max(
    1,
    Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000
    ) + 1
  );
  const averageHoursPerDay = totalHours / daysInRange;

  const topGames = [...gamePlaytimeMap.entries()]
    .sort(([, a], [, b]) => b.totalMilliseconds - a.totalMilliseconds)
    .slice(0, 10)
    .map(([, game]) => game);

  const topGamesWithTitles = await Promise.all(
    topGames.map(async (game) => {
      try {
        const gameData = await gamesSublevel.get(
          `${game.shop}:${game.objectId}`
        );
        return {
          ...game,
          title: gameData?.title ?? game.objectId,
          iconUrl: gameData?.iconUrl ?? null,
        };
      } catch {
        return {
          ...game,
          title: game.objectId,
          iconUrl: null,
        };
      }
    })
  );

  return {
    totalHours,
    gamesPlayed,
    mostActiveDate,
    mostActiveDateHours: mostActiveDateMs / 3_600_000,
    averageHoursPerDay,
    topGames: topGamesWithTitles,
  };
};

registerEvent("getPlaytimeSummary", getPlaytimeSummary);
