import { useTranslation } from "react-i18next";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { XIcon } from "@primer/octicons-react";
import type { DailyPlaytimeEntry } from "../../declaration";

export interface PerGameDetailsProps {
  game: {
    objectId: string;
    shop: string;
    title: string;
  };
  dailyEntries: DailyPlaytimeEntry[];
  onClose: () => void;
}

function formatPlaytime(ms: number): string {
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function PerGameDetails({
  game,
  dailyEntries,
  onClose,
}: PerGameDetailsProps) {
  const { t } = useTranslation("activity");

  const chartData = dailyEntries
    .map((entry) => ({
      date: entry.date.slice(5),
      hours: entry.totalMilliseconds / 3_600_000,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalMs = dailyEntries.reduce(
    (sum, e) => sum + e.totalMilliseconds,
    0
  );
  const sessionCount = dailyEntries.filter((e) => e.totalMilliseconds > 0).length;
  const avgSessionMs = sessionCount > 0 ? totalMs / sessionCount : 0;

  return (
    <div className="section-panel">
      <div className="per-game-details__header">
        <h3 className="per-game-details__title">
          {game.title} — {t("per_game_details")}
        </h3>
        <button
          type="button"
          className="per-game-details__close"
          onClick={onClose}
        >
          <XIcon size={16} />
        </button>
      </div>

      {dailyEntries.length === 0 ? (
        <div className="section-panel__empty">{t("no_activity_yet")}</div>
      ) : (
        <>
          <div className="per-game-details__chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
                  interval="preserveStartEnd"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
                  tickFormatter={(v) => `${v}h`}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0d0d0d",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
              formatter={(value) => [
                `${Math.round((value as number) * 10) / 10}h`,
                t("total_hours"),
              ]}
                />
                <Bar dataKey="hours" fill="#16b195" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="per-game-details__stats">
            <div>
              <div className="per-game-details__stat-label">
                {t("total_playtime")}
              </div>
              <div className="per-game-details__stat-value">
                {formatPlaytime(totalMs)}
              </div>
            </div>
            <div>
              <div className="per-game-details__stat-label">
                {t("session_count")}
              </div>
              <div className="per-game-details__stat-value">
                {sessionCount}
              </div>
            </div>
            <div>
              <div className="per-game-details__stat-label">
                {t("avg_session_duration")}
              </div>
              <div className="per-game-details__stat-value">
                {formatPlaytime(avgSessionMs)}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
