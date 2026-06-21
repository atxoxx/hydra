import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SessionWithGame } from "../../declaration";
import "./activity-gantt-chart.scss";

export interface ActivityGanttChartProps {
  sessions: SessionWithGame[];
  loading: boolean;
  dateRange: { startDate: string; endDate: string };
}

// Color palette for different games
const GAME_COLORS = [
  "#16b195",
  "#3e62c0",
  "#e74c3c",
  "#f39c12",
  "#9b59b6",
  "#1abc9c",
  "#e67e22",
  "#2ecc71",
  "#e91e63",
  "#00bcd4",
  "#ff9800",
  "#8bc34a",
  "#673ab7",
  "#ff5722",
  "#009688",
  "#795548",
];

function formatTimeShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(ms: number): string {
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

interface GanttRow {
  date: string;
  dateLabel: string;
  bars: {
    session: SessionWithGame;
    gameTitle: string;
    startPct: number;
    widthPct: number;
    color: string;
  }[];
}

export function ActivityGanttChart({
  sessions,
  loading,
  dateRange,
}: Readonly<ActivityGanttChartProps>) {
  const { t } = useTranslation("activity");
  const [hoveredBar, setHoveredBar] = useState<{
    session: SessionWithGame;
    x: number;
    y: number;
  } | null>(null);

  const { rows, uniqueGames } = useMemo(() => {
    // Build color map for games
    const gameSet = new Map<string, { title: string; iconUrl: string | null }>();
    for (const s of sessions) {
      if (!gameSet.has(s.gameTitle)) {
        gameSet.set(s.gameTitle, {
          title: s.gameTitle,
          iconUrl: s.gameIconUrl,
        });
      }
    }

    const gameColorMap = new Map<string, string>();
    let colorIdx = 0;
    for (const [title] of gameSet) {
      gameColorMap.set(title, GAME_COLORS[colorIdx % GAME_COLORS.length]);
      colorIdx++;
    }

    // Group sessions by date
    const dateGroups = new Map<string, SessionWithGame[]>();
    for (const s of sessions) {
      const date = s.startTime.slice(0, 10);
      if (!dateGroups.has(date)) {
        dateGroups.set(date, []);
      }
      dateGroups.get(date)!.push(s);
    }

    // Build rows for each date in the range
    const startD = new Date(dateRange.startDate + "T00:00:00");
    const endD = new Date(dateRange.endDate + "T00:00:00");
    const allRows: GanttRow[] = [];

    const cursor = new Date(endD);
    while (cursor >= startD) {
      const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      const daySessions = dateGroups.get(dateStr) || [];

      const bars = daySessions.map((s) => {
        const sessionStart = new Date(s.startTime);
        const sessionEnd = new Date(s.endTime);

        // Calculate position within 24h day (0:00 to 24:00)
        const dayStart = new Date(dateStr + "T00:00:00");
        const dayEndMs = 24 * 60 * 60 * 1000;

        const startMs = Math.max(
          0,
          sessionStart.getTime() - dayStart.getTime()
        );
        const endMs = Math.min(
          dayEndMs,
          sessionEnd.getTime() - dayStart.getTime()
        );

        const startPct = (startMs / dayEndMs) * 100;
        const widthPct = Math.max(0.5, ((endMs - startMs) / dayEndMs) * 100);

        return {
          session: s,
          gameTitle: s.gameTitle,
          startPct,
          widthPct,
          color: gameColorMap.get(s.gameTitle) || "#16b195",
        };
      });

      allRows.push({
        date: dateStr,
        dateLabel: formatDateLabel(dateStr),
        bars,
      });

      cursor.setDate(cursor.getDate() - 1);
    }

    return {
      rows: allRows,
      uniqueGames: Array.from(gameSet.entries()).map(([title, info]) => ({
        title,
        iconUrl: info.iconUrl,
        color: gameColorMap.get(title) || "#16b195",
      })),
    };
  }, [sessions, dateRange]);

  // Only show rows that have sessions, plus a few empty ones for context
  const visibleRows = useMemo(() => {
    const rowsWithBars = rows.filter((r) => r.bars.length > 0);
    if (rowsWithBars.length === 0) return rows.slice(0, 14);
    return rows.slice(0, Math.min(rows.length, 60));
  }, [rows]);

  const timeLabels = ["00:00", "06:00", "12:00", "18:00", "24:00"];

  if (loading) {
    return (
      <div className="activity-gantt">
        <div className="activity-gantt__loading">
          {t("loading") || "Loading..."}
        </div>
      </div>
    );
  }

  return (
    <div className="activity-gantt">
      {/* Legend */}
      {uniqueGames.length > 0 && (
        <div className="activity-gantt__legend">
          {uniqueGames.slice(0, 12).map((g) => (
            <div className="activity-gantt__legend-item" key={g.title}>
              <span
                className="activity-gantt__legend-dot"
                style={{ backgroundColor: g.color }}
              />
              {g.iconUrl && (
                <img
                  className="activity-gantt__legend-icon"
                  src={g.iconUrl}
                  alt=""
                />
              )}
              <span className="activity-gantt__legend-label">{g.title}</span>
            </div>
          ))}
          {uniqueGames.length > 12 && (
            <span className="activity-gantt__legend-more">
              +{uniqueGames.length - 12} {t("more") || "more"}
            </span>
          )}
        </div>
      )}

      {/* Timeline header */}
      <div className="activity-gantt__timeline-header">
        <div className="activity-gantt__date-col" />
        <div className="activity-gantt__time-axis">
          {timeLabels.map((label) => (
            <span key={label} className="activity-gantt__time-label">
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="activity-gantt__rows">
        {visibleRows.map((row) => (
          <div
            className={`activity-gantt__row ${row.bars.length > 0 ? "activity-gantt__row--has-data" : ""}`}
            key={row.date}
          >
            <div className="activity-gantt__date-col">
              <span className="activity-gantt__date-label">
                {row.dateLabel}
              </span>
            </div>
            <div className="activity-gantt__bar-area">
              {/* Grid lines */}
              <div className="activity-gantt__grid-line" style={{ left: "25%" }} />
              <div className="activity-gantt__grid-line" style={{ left: "50%" }} />
              <div className="activity-gantt__grid-line" style={{ left: "75%" }} />

              {row.bars.map((bar) => (
                <div
                  key={bar.session.id}
                  className="activity-gantt__bar"
                  style={{
                    left: `${bar.startPct}%`,
                    width: `${bar.widthPct}%`,
                    backgroundColor: bar.color,
                  }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredBar({
                      session: bar.session,
                      x: rect.left + rect.width / 2,
                      y: rect.top,
                    });
                  }}
                  onMouseLeave={() => setHoveredBar(null)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {sessions.length === 0 && (
        <div className="activity-gantt__empty">
          {t("no_sessions_yet") || "No sessions in this time range."}
        </div>
      )}

      {/* Tooltip */}
      {hoveredBar && (
        <div
          className="activity-gantt__tooltip"
          style={{
            position: "fixed",
            left: hoveredBar.x,
            top: hoveredBar.y - 8,
            transform: "translate(-50%, -100%)",
            zIndex: 100,
          }}
        >
          <strong className="activity-gantt__tooltip-game">
            {hoveredBar.session.gameTitle}
          </strong>
          <span className="activity-gantt__tooltip-time">
            {formatTimeShort(hoveredBar.session.startTime)} —{" "}
            {formatTimeShort(hoveredBar.session.endTime)}
          </span>
          <span className="activity-gantt__tooltip-duration">
            {formatDuration(hoveredBar.session.durationMs)}
          </span>
        </div>
      )}
    </div>
  );
}
