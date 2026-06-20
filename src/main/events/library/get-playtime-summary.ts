import {
  dailyPlaytimeSublevel,
  gamesSublevel,
  sessionsSublevel,
} from "@main/level";
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
  totalSessions: number;
  longestStreak: number;
  currentStreak: number;
  activeDays: number;
  platformBreakdown: Record<string, number>;
  genreBreakdown: Record<string, number>;
  developerBreakdown: Record<string, number>;
  publisherBreakdown: Record<string, number>;
  dailyPlaytimes: { date: string; totalMilliseconds: number }[];
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

  // Compute breakdown data by resolving game metadata from LevelDB
  const platformBreakdown: Record<string, number> = {};
  const genreBreakdown: Record<string, number> = {};
  const developerBreakdown: Record<string, number> = {};
  const publisherBreakdown: Record<string, number> = {};

  for (const [gameKey, playtimeInfo] of gamePlaytimeMap) {
    const hours = playtimeInfo.totalMilliseconds / 3_600_000;
    try {
      const game = await gamesSublevel.get(gameKey);
      if (game) {
        // Platform
        const platform = (
          game.platform ||
          game.shop ||
          "unknown"
        ).toLowerCase();
        platformBreakdown[platform] =
          (platformBreakdown[platform] ?? 0) + hours;

        // Genres
        const genres =
          game.genres && game.genres.length > 0 ? game.genres : ["Unknown"];
        for (const genre of genres) {
          genreBreakdown[genre] = (genreBreakdown[genre] ?? 0) + hours;
        }

        // Developers
        const developers =
          game.developers && game.developers.length > 0
            ? game.developers
            : ["Unknown"];
        for (const dev of developers) {
          developerBreakdown[dev] = (developerBreakdown[dev] ?? 0) + hours;
        }

        // Publishers
        const publishers =
          game.publishers && game.publishers.length > 0
            ? game.publishers
            : ["Unknown"];
        for (const pub of publishers) {
          publisherBreakdown[pub] = (publisherBreakdown[pub] ?? 0) + hours;
        }
      }
    } catch {
      const platform = playtimeInfo.shop.toLowerCase();
      platformBreakdown[platform] = (platformBreakdown[platform] ?? 0) + hours;
      genreBreakdown["Unknown"] = (genreBreakdown["Unknown"] ?? 0) + hours;
      developerBreakdown["Unknown"] =
        (developerBreakdown["Unknown"] ?? 0) + hours;
      publisherBreakdown["Unknown"] =
        (publisherBreakdown["Unknown"] ?? 0) + hours;
    }
  }

  // Count total sessions in date range
  let totalSessions = 0;
  for await (const [, session] of sessionsSublevel.iterator()) {
    if (session.startTime) {
      const sessionDate = session.startTime.slice(0, 10);
      if (sessionDate >= startDate && sessionDate <= endDate) {
        totalSessions++;
      }
    }
  }

  // Calculate active days, longest streak and current streak
  const uniquePlayDates = new Set<string>();
  for (const date of dailyTotals.keys()) {
    uniquePlayDates.add(date);
  }
  const sortedDates = Array.from(uniquePlayDates).sort();
  const activeDays = sortedDates.length;

  let longestStreak = 0;
  let currentStreak = 0;
  let lastDate: Date | null = null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86_400_000)
    .toISOString()
    .slice(0, 10);

  for (const dateStr of sortedDates) {
    const currentDate = new Date(dateStr + "T00:00:00");
    if (!lastDate) {
      currentStreak = 1;
    } else {
      const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentStreak++;
      } else if (diffDays > 1) {
        longestStreak = Math.max(longestStreak, currentStreak);
        currentStreak = 1;
      }
    }
    lastDate = currentDate;
  }
  longestStreak = Math.max(longestStreak, currentStreak);

  // If the last played date isn't today or yesterday, the current streak is broken
  const lastPlayedDateStr = sortedDates[sortedDates.length - 1];
  if (
    !lastPlayedDateStr ||
    (lastPlayedDateStr !== todayStr && lastPlayedDateStr !== yesterdayStr)
  ) {
    currentStreak = 0;
  }

  const dailyPlaytimes = Array.from(dailyTotals.entries()).map(
    ([date, totalMilliseconds]) => ({
      date,
      totalMilliseconds,
    })
  );

  return {
    totalHours,
    gamesPlayed,
    mostActiveDate,
    mostActiveDateHours: mostActiveDateMs / 3_600_000,
    averageHoursPerDay,
    topGames: topGamesWithTitles,
    totalSessions,
    longestStreak,
    currentStreak,
    activeDays,
    platformBreakdown,
    genreBreakdown,
    developerBreakdown,
    publisherBreakdown,
    dailyPlaytimes,
  };
};

registerEvent("getPlaytimeSummary", getPlaytimeSummary);
