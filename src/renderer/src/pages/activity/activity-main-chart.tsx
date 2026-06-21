import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsiveLine } from "@nivo/line";
import { parseISO, format, startOfWeek, startOfMonth } from "date-fns";
import { getComputedAccentColor } from "../../helpers";
import type { DailyPlaytimeEntry } from "../../declaration";
import type { AggregationMode, ChartType } from "./activity-toolbar";

/** Entries with only date + milliseconds (from summary aggregation) */
export interface SummaryDailyEntry {
  date: string;
  totalMilliseconds: number;
}

export interface ActivityMainChartProps {
  /** Total daily playtime across all games (from summary) */
  dailyPlaytimes: SummaryDailyEntry[] | null;
  /** Selected game info — when set, shows per-game chart */
  selectedGame: { objectId: string; shop: string; title: string } | null;
  /** Per-game daily playtime entries (fetched when game is selected) */
  dailyEntries: DailyPlaytimeEntry[];
  /** Aggregation mode from toolbar */
  aggregation: AggregationMode;
  /** Chart type from toolbar */
  chartType: ChartType;
  loading: boolean;
  /** Date range bounds for building full-day axis */
  startDate: string;
  endDate: string;
}

interface GroupedPoint {
  label: string;
  hours: number;
  fullDate: string;
}

function aggregateByMode(
  entries: { date: string; totalMilliseconds: number }[],
  mode: AggregationMode,
  startDate: string,
  endDate: string
): GroupedPoint[] {
  const dayMap = new Map<string, number>();

  for (const entry of entries) {
    dayMap.set(
      entry.date,
      (dayMap.get(entry.date) ?? 0) + entry.totalMilliseconds
    );
  }

  if (mode === "day") {
    // Fill all days in range
    const points: GroupedPoint[] = [];
    const end = new Date(endDate + "T00:00:00");
    const cursor = new Date(startDate + "T00:00:00");

    while (cursor <= end) {
      const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      const ms = dayMap.get(dateStr) ?? 0;
      points.push({
        label: dateStr.slice(5),
        hours: Math.round((ms / 3_600_000) * 100) / 100,
        fullDate: dateStr,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return points;
  }

  // Week or month aggregation
  const groups = new Map<string, number>();
  for (const [dateStr, ms] of dayMap) {
    try {
      const date = parseISO(dateStr);
      let groupKey: string;
      if (mode === "week") {
        const start = startOfWeek(date, { weekStartsOn: 1 });
        groupKey = format(start, "yyyy-MM-dd");
      } else {
        const start = startOfMonth(date);
        groupKey = format(start, "yyyy-MM");
      }
      groups.set(groupKey, (groups.get(groupKey) ?? 0) + ms);
    } catch {
      groups.set(dateStr, (groups.get(dateStr) ?? 0) + ms);
    }
  }

  return Array.from(groups.entries())
    .map(([key, ms]) => {
      let label = key;
      if (mode === "week") {
        const parts = key.split("-");
        label = parts.length === 3 ? `${parts[1]}/${parts[2]}` : key;
      } else if (mode === "month") {
        try {
          const date = parseISO(key + "-01");
          label = format(date, "MMM yy");
        } catch {
          label = key;
        }
      }
      return {
        label,
        hours: Math.round((ms / 3_600_000) * 10) / 10,
        fullDate: key,
      };
    })
    .sort((a, b) => a.fullDate.localeCompare(b.fullDate));
}

function formatHours(hours: number): string {
  if (hours >= 1) return `${Math.round(hours * 10) / 10}h`;
  return `${Math.round(hours * 60)}m`;
}

export function ActivityMainChart({
  dailyPlaytimes,
  selectedGame,
  dailyEntries,
  aggregation,
  chartType,
  loading,
  startDate,
  endDate,
}: ActivityMainChartProps) {
  const { t } = useTranslation("activity");

  const entries = selectedGame ? dailyEntries : (dailyPlaytimes ?? []);

  const groupedData = useMemo(
    () => aggregateByMode(entries, aggregation, startDate, endDate),
    [entries, aggregation, startDate, endDate]
  );

  const totalHours = useMemo(
    () => groupedData.reduce((sum, d) => sum + d.hours, 0),
    [groupedData]
  );

  const lineData = useMemo(
    () => [
      {
        id: selectedGame
          ? selectedGame.title
          : t("total_playtime") || "Playtime",
        data: groupedData.map((d) => ({ x: d.label, y: d.hours })),
      },
    ],
    [groupedData, selectedGame, t]
  );

  const accentColor = getComputedAccentColor();

  // ── Shared chart props ──
  const margin = { top: 8, right: 8, bottom: 28, left: 40 };
  const axisBottom = {
    tickSize: 0,
    tickPadding: 6,
    tickRotation: aggregation === "month" ? 0 : 0,
  };
  const axisLeft = {
    tickSize: 0,
    tickPadding: 6,
    tickRotation: 0,
    format: (v: number) => {
      if (v >= 1) return `${Math.trunc(v)}h`;
      return `${Math.round(v * 60)}m`;
    },
  };
  const theme = {
    background: "transparent" as const,
    text: {
      fontSize: 10,
      fill: "rgba(255,255,255,0.4)",
      fontFamily: "inherit",
    },
    grid: {
      line: {
        stroke: "rgba(255,255,255,0.06)",
        strokeWidth: 1,
      },
    },
    tooltip: {
      container: {
        background: "#0d0d0d",
        color: "#fff",
        fontSize: 12,
        borderRadius: 6,
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      },
    },
  };

  if (loading) {
    return (
      <div className="activity-main-chart activity-main-chart--loading">
        <span className="activity-main-chart__loading-text">
          {t("loading") || "Loading..."}
        </span>
      </div>
    );
  }

  if (groupedData.length === 0 || totalHours === 0) {
    return (
      <div className="activity-main-chart activity-main-chart--empty">
        <span className="activity-main-chart__empty-text">
          {t("no_activity_yet") || "No activity yet"}
        </span>
      </div>
    );
  }

  return (
    <div className="activity-main-chart">
      {/* ── Header ── */}
      <div className="activity-main-chart__header">
        <div className="activity-main-chart__header-left">
          <h3 className="activity-main-chart__title">
            {selectedGame ? selectedGame.title : t("overview") || "Overview"}
          </h3>
          {selectedGame && (
            <span className="activity-main-chart__subtitle">
              {t("total_playtime") || "Total"}: {formatHours(totalHours)}
            </span>
          )}
        </div>
        {!selectedGame && (
          <span className="activity-main-chart__subtitle">
            {formatHours(totalHours)}
          </span>
        )}
      </div>

      {/* ── Chart body ── */}
      <div className="activity-main-chart__body">
        {chartType === "bar" ? (
          <ResponsiveBar
            data={groupedData as unknown as Record<string, string | number>[]}
            keys={["hours"]}
            indexBy="label"
            margin={margin}
            padding={0.25}
            valueScale={{ type: "linear" }}
            colors={[accentColor]}
            borderRadius={3}
            enableLabel={groupedData.length <= 20}
            label={(d) => {
              const h = d.value as number;
              if (h >= 1) return `${Math.round(h * 10) / 10}h`;
              return `${Math.round(h * 60)}m`;
            }}
            labelTextColor="rgba(255,255,255,0.85)"
            labelSkipWidth={24}
            labelSkipHeight={12}
            axisTop={null}
            axisRight={null}
            axisBottom={axisBottom}
            axisLeft={axisLeft}
            enableGridY={true}
            gridYValues={4}
            theme={theme}
            tooltip={({ value, indexValue }) => {
              const h = value as number;
              return (
                <div className="activity-main-chart__tooltip">
                  <strong>{String(indexValue)}</strong>
                  <span>{formatHours(h)}</span>
                </div>
              );
            }}
            animate={true}
            motionConfig="gentle"
            role="application"
            ariaLabel={
              selectedGame
                ? `${t("activity")} — ${selectedGame.title}`
                : t("activity")
            }
          />
        ) : (
          <ResponsiveLine
            data={lineData}
            margin={margin}
            xScale={{ type: "point" }}
            yScale={{ type: "linear", min: 0, max: "auto" }}
            colors={[accentColor]}
            lineWidth={2.5}
            enableArea={true}
            areaOpacity={0.12}
            areaBaselineValue={0}
            enablePoints={groupedData.length <= 30}
            pointSize={6}
            pointColor="#0d0d0d"
            pointBorderWidth={2}
            pointBorderColor={{ from: "serieColor" }}
            axisTop={null}
            axisRight={null}
            axisBottom={axisBottom}
            axisLeft={axisLeft}
            enableGridY={true}
            gridYValues={4}
            theme={theme}
            tooltip={({ point }) => {
              const h = point.data.y as number;
              return (
                <div className="activity-main-chart__tooltip">
                  <strong>{String(point.data.x)}</strong>
                  <span>{formatHours(h)}</span>
                </div>
              );
            }}
            useMesh={true}
            animate={true}
            motionConfig="gentle"
            role="application"
            ariaLabel={
              selectedGame
                ? `${t("activity")} — ${selectedGame.title}`
                : t("activity")
            }
          />
        )}
      </div>
    </div>
  );
}
