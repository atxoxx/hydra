import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ResponsiveLine } from "@nivo/line";
import type { GameSession } from "../../declaration";
import { ActivityHardwareCard } from "./activity-hardware-card";
import { Trash2, ChevronDown, ChevronUp, BarChart2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "./activity-session-item.scss";

export interface ActivitySessionItemProps {
  session: GameSession;
  onDelete?: (sessionId: string) => void;
}

function formatDuration(ms: number): string {
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

function getFormattedSessionTime(
  sampleIndex: number,
  totalSamples: number,
  durationMs: number
): string {
  const elapsedMs = (sampleIndex / Math.max(1, totalSamples - 1)) * durationMs;
  const totalSeconds = Math.round(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function ActivitySessionItem({
  session,
  onDelete,
}: Readonly<ActivitySessionItemProps>) {
  const { t } = useTranslation("activity");
  const [expanded, setExpanded] = useState(false);
  const [chartMetric, setChartMetric] = useState<
    "fps" | "temps" | "usages" | "ram"
  >("fps");

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      window.confirm(
        t("delete_session_confirm") ||
          "Are you sure you want to delete this session? This will subtract its playtime from this game."
      )
    ) {
      try {
        const res = await window.electron.deleteGameSession(
          session.shop,
          session.objectId,
          session.id
        );
        if (res.success) {
          if (onDelete) onDelete(session.id);
        } else {
          alert(`Error: ${res.error}`);
        }
      } catch (err) {
        alert(`Error: ${err}`);
      }
    }
  };

  const hasHardware =
    !!session.hardwareMetrics && session.hardwareMetrics.samples.length > 1;

  // Prepare line chart data
  const chartData = (() => {
    if (!hasHardware) return [];
    const samples = session.hardwareMetrics!.samples;
    // Downsample for performance (max 80 points)
    const maxPoints = 80;
    const step = Math.max(1, Math.floor(samples.length / maxPoints));
    const downsampled = samples.filter((_, i) => i % step === 0);

    if (chartMetric === "fps") {
      return [
        {
          id: "FPS",
          data: downsampled.map((s, idx) => ({
            x: getFormattedSessionTime(
              idx * step,
              samples.length,
              session.durationMs
            ),
            y: s.fps,
          })),
        },
      ];
    }

    if (chartMetric === "temps") {
      return [
        {
          id: "CPU Temp (°C)",
          data: downsampled.map((s, idx) => ({
            x: getFormattedSessionTime(
              idx * step,
              samples.length,
              session.durationMs
            ),
            y: s.cpuTemp,
          })),
        },
        {
          id: "GPU Temp (°C)",
          data: downsampled.map((s, idx) => ({
            x: getFormattedSessionTime(
              idx * step,
              samples.length,
              session.durationMs
            ),
            y: s.gpuTemp,
          })),
        },
      ];
    }

    if (chartMetric === "usages") {
      return [
        {
          id: "CPU Usage (%)",
          data: downsampled.map((s, idx) => ({
            x: getFormattedSessionTime(
              idx * step,
              samples.length,
              session.durationMs
            ),
            y: s.cpuUsage,
          })),
        },
        {
          id: "GPU Usage (%)",
          data: downsampled.map((s, idx) => ({
            x: getFormattedSessionTime(
              idx * step,
              samples.length,
              session.durationMs
            ),
            y: s.gpuUsage,
          })),
        },
      ];
    }

    if (chartMetric === "ram") {
      return [
        {
          id: "RAM (MB)",
          data: downsampled.map((s, idx) => ({
            x: getFormattedSessionTime(
              idx * step,
              samples.length,
              session.durationMs
            ),
            y: s.ramUsageMB,
          })),
        },
      ];
    }

    return [];
  })();

  const metricColors = (() => {
    if (chartMetric === "fps") return ["#16b195"];
    if (chartMetric === "temps") return ["#e74c3c", "#f39c12"];
    if (chartMetric === "usages") return ["#3e62c0", "#9b59b6"];
    return ["#2ecc71"];
  })();

  return (
    <div
      className={`activity-session-item ${expanded ? "activity-session-item--expanded" : ""}`}
    >
      <div
        className="activity-session-item__row"
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
      >
        <div className="activity-session-item__header-left">
          <span className="activity-session-item__chevron">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
          {"gameTitle" in session && (
            <div className="activity-session-item__game-icon-container">
              {(session as any).gameIconUrl ? (
                <img
                  src={(session as any).gameIconUrl}
                  alt={(session as any).gameTitle}
                  className="activity-session-item__game-icon"
                />
              ) : (
                <div className="activity-session-item__game-icon-placeholder" />
              )}
            </div>
          )}
          <div className="activity-session-item__info">
            <span className="activity-session-item__date">
              {"gameTitle" in session
                ? (session as any).gameTitle
                : formatDate(session.startTime)}
            </span>
            <span className="activity-session-item__time">
              {"gameTitle" in session
                ? `${formatDate(session.startTime)} · `
                : ""}
              {formatTime(session.startTime)} — {formatTime(session.endTime)}
            </span>
          </div>
        </div>
        <div className="activity-session-item__header-right">
          <span className="activity-session-item__duration">
            {formatDuration(session.durationMs)}
          </span>
          <button
            type="button"
            className="activity-session-item__delete-btn"
            onClick={handleDelete}
            title={t("delete_session") || "Delete Session"}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="activity-session-item__collapsible"
          >
            {hasHardware ? (
              <div className="activity-session-item__hardware-details">
                <ActivityHardwareCard metrics={session.hardwareMetrics} />

                <div className="activity-session-item__chart-section">
                  <div className="activity-session-item__chart-header">
                    <span className="activity-session-item__chart-title">
                      <BarChart2 size={14} />
                      Performance Timeline
                    </span>
                    <div className="activity-session-item__chart-tabs">
                      {(["fps", "temps", "usages", "ram"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`activity-session-item__chart-tab-btn ${
                            chartMetric === m
                              ? "activity-session-item__chart-tab-btn--active"
                              : ""
                          }`}
                          onClick={() => setChartMetric(m)}
                        >
                          {m.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="activity-session-item__chart-container">
                    <ResponsiveLine
                      data={chartData}
                      margin={{ top: 12, right: 20, bottom: 30, left: 45 }}
                      xScale={{ type: "point" }}
                      yScale={{ type: "linear", min: "auto", max: "auto" }}
                      colors={metricColors}
                      lineWidth={2}
                      enableArea={true}
                      areaOpacity={0.06}
                      enablePoints={false}
                      enableGridX={false}
                      enableGridY={true}
                      gridYValues={4}
                      axisTop={null}
                      axisRight={null}
                      axisBottom={{
                        tickSize: 0,
                        tickPadding: 8,
                        tickRotation: 0,
                        // Show raw session time string
                        format: (val: string) => val,
                      }}
                      axisLeft={{
                        tickSize: 0,
                        tickPadding: 8,
                        tickRotation: 0,
                      }}
                      theme={{
                        background: "transparent",
                        text: {
                          fontSize: 10,
                          fill: "rgba(255,255,255,0.4)",
                          fontFamily: "inherit",
                        },
                        grid: {
                          line: {
                            stroke: "rgba(255,255,255,0.05)",
                            strokeWidth: 1,
                          },
                        },
                        tooltip: {
                          container: {
                            background: "#0d0d0d",
                            color: "#fff",
                            fontSize: 11,
                            borderRadius: 6,
                            border: "1px solid rgba(255,255,255,0.08)",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                          },
                        },
                      }}
                      useMesh={true}
                      animate={true}
                      motionConfig="gentle"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="activity-session-item__no-hardware">
                {t("no_hardware_data") ||
                  "No hardware metrics recorded for this session."}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
