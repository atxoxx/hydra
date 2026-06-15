import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { GameShop } from "@types";
import type { DailyPlaytimeEntry } from "../../declaration";
import "./game-activity-panel.scss";

export interface GameActivityPanelProps {
  shop: GameShop;
  objectId: string;
}

function formatPlaytime(ms: number): string {
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getDateRange(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { startDate: fmt(start), endDate: fmt(end) };
}

export function GameActivityPanel({ shop, objectId }: GameActivityPanelProps) {
  const { t } = useTranslation("activity");
  const [dailyEntries, setDailyEntries] = useState<DailyPlaytimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const { startDate, endDate } = getDateRange(90);
        const entries = await window.electron.getDailyPlaytime(
          shop,
          objectId,
          startDate,
          endDate
        );
        if (!cancelled) setDailyEntries(entries);
      } catch {
        if (!cancelled) setDailyEntries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [shop, objectId]);

  const chartData = useMemo(() => {
    return dailyEntries
      .map((entry) => ({
        date: entry.date.slice(5),
        hours: entry.totalMilliseconds / 3_600_000,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [dailyEntries]);

  const totalMs = useMemo(
    () => dailyEntries.reduce((sum, e) => sum + e.totalMilliseconds, 0),
    [dailyEntries]
  );

  const sessionCount = useMemo(
    () => dailyEntries.filter((e) => e.totalMilliseconds > 0).length,
    [dailyEntries]
  );

  const avgSessionMs = sessionCount > 0 ? totalMs / sessionCount : 0;

  if (loading) {
    return (
      <div className="game-activity-panel">
        <h3 className="game-activity-panel__title">{t("activity")}</h3>
        <div className="game-activity-panel__empty">{t("loading")}</div>
      </div>
    );
  }

  if (dailyEntries.length === 0) {
    return (
      <div className="game-activity-panel">
        <h3 className="game-activity-panel__title">{t("activity")}</h3>
        <div className="game-activity-panel__empty">{t("no_activity_yet")}</div>
      </div>
    );
  }

  return (
    <div className="game-activity-panel">
      <h3 className="game-activity-panel__title">{t("activity")}</h3>

      <div className="game-activity-panel__chart">
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

      <div className="game-activity-panel__stats">
        <div className="game-activity-panel__stat">
          <span className="game-activity-panel__stat-label">
            {t("total_playtime")}
          </span>
          <span className="game-activity-panel__stat-value">
            {formatPlaytime(totalMs)}
          </span>
        </div>
        <div className="game-activity-panel__stat">
          <span className="game-activity-panel__stat-label">
            {t("session_count")}
          </span>
          <span className="game-activity-panel__stat-value">
            {sessionCount}
          </span>
        </div>
        <div className="game-activity-panel__stat">
          <span className="game-activity-panel__stat-label">
            {t("avg_session_duration")}
          </span>
          <span className="game-activity-panel__stat-value">
            {formatPlaytime(avgSessionMs)}
          </span>
        </div>
      </div>
    </div>
  );
}
