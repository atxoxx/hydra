import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Clock, Gamepad2, Calendar, Zap, TrendingUp, BarChart3 } from "lucide-react";
import type { PlaytimeSummary, DailyPlaytimeEntry } from "../../declaration";

export interface ActivityStatsBarProps {
  summary: PlaytimeSummary | null;
  selectedGame: { objectId: string; shop: string; title: string } | null;
  dailyEntries: DailyPlaytimeEntry[];
  loading: boolean;
}

function formatPlaytime(ms: number): string {
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getMostActiveDay(
  entries: { date: string; totalMilliseconds: number }[]
): string | null {
  if (entries.length === 0) return null;
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayTotals = new Map<number, number>();

  for (const entry of entries) {
    const day = new Date(entry.date + "T00:00:00").getDay();
    dayTotals.set(day, (dayTotals.get(day) ?? 0) + entry.totalMilliseconds);
  }

  let maxDay = 0;
  let maxMs = 0;
  for (const [day, ms] of dayTotals) {
    if (ms > maxMs) {
      maxMs = ms;
      maxDay = day;
    }
  }

  return dayNames[maxDay];
}

interface StatPill {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}

export function ActivityStatsBar({
  summary,
  selectedGame,
  dailyEntries,
  loading,
}: ActivityStatsBarProps) {
  const { t } = useTranslation("activity");

  const pills = useMemo((): StatPill[] => {
    if (selectedGame) {
      // ── Per-game stats ──
      const totalMs = dailyEntries.reduce(
        (sum, e) => sum + e.totalMilliseconds,
        0
      );
      const activeDays = dailyEntries.filter(
        (e) => e.totalMilliseconds > 0
      ).length;
      const avgPerDay = activeDays > 0 ? totalMs / activeDays : 0;
      const mostActive = getMostActiveDay(dailyEntries);

      return [
        {
          icon: <Clock size={13} />,
          label: t("total_playtime") || "Playtime",
          value: formatPlaytime(totalMs),
          highlight: true,
        },
        {
          icon: <Calendar size={13} />,
          label: t("active_days") || "Days",
          value: String(activeDays),
        },
        {
          icon: <TrendingUp size={13} />,
          label: t("avg_per_day") || "Avg/Day",
          value: formatPlaytime(avgPerDay),
        },
        {
          icon: <Zap size={13} />,
          label: t("most_active_day") || "Best Day",
          value: mostActive ?? "—",
        },
      ];
    }

    // ── Overview stats ──
    const totalHours = summary?.totalHours ?? 0;
    const gamesPlayed = summary?.gamesPlayed ?? 0;
    const avgPerDay = summary?.averageHoursPerDay ?? 0;
    const totalSessions = summary?.totalSessions ?? 0;
    const longestStreak = summary?.longestStreak ?? 0;

    return [
      {
        icon: <Clock size={13} />,
        label: t("total_hours") || "Hours",
        value: formatHours(totalHours),
        highlight: true,
      },
      {
        icon: <Gamepad2 size={13} />,
        label: t("games_played") || "Games",
        value: String(gamesPlayed),
      },
      {
        icon: <BarChart3 size={13} />,
        label: t("avg_per_day") || "Avg/Day",
        value: formatHours(avgPerDay),
      },
      {
        icon: <Calendar size={13} />,
        label: t("total_sessions") || "Sessions",
        value: String(totalSessions),
      },
      {
        icon: <Zap size={13} />,
        label: t("longest_streak") || "Streak",
        value: longestStreak > 0 ? `${longestStreak}d` : "—",
      },
    ];
  }, [summary, selectedGame, dailyEntries, t]);

  if (loading) {
    return (
      <div className="activity-stats-bar activity-stats-bar--loading">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="activity-stats-bar__pill">
            <span className="activity-stats-bar__pill-icon">&nbsp;</span>
            <span className="activity-stats-bar__pill-label">&nbsp;</span>
            <span className="activity-stats-bar__pill-value">—</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="activity-stats-bar">
      {pills.map((pill) => (
        <div
          key={pill.label}
          className={`activity-stats-bar__pill${
            pill.highlight ? " activity-stats-bar__pill--highlight" : ""
          }`}
        >
          <span className="activity-stats-bar__pill-icon">{pill.icon}</span>
          <div className="activity-stats-bar__pill-content">
            <span className="activity-stats-bar__pill-label">{pill.label}</span>
            <span className="activity-stats-bar__pill-value">{pill.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
