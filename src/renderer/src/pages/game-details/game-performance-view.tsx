import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart3, Activity, Info } from "lucide-react";
import type { GameSession } from "../../declaration";
import type { HardwareSample } from "../../declaration";
import {
  CombinedLineChart,
  type MetricSeries,
} from "../../components/performance-charts/combined-line-chart";
import { PerformanceStatCards } from "../../components/performance-charts/performance-stat-cards";
import { getAverageTimeline } from "../../components/performance-charts/performance-averager";
import "./game-performance-view.scss";

export interface GamePerformanceViewProps {
  sessions: GameSession[];
}

const CPU_GPU_USAGE_SERIES: MetricSeries[] = [
  { id: "CPU Usage", color: "#3e62c0", field: "cpuUsage" },
  { id: "GPU Usage", color: "#9b59b6", field: "gpuUsage" },
];

const TEMPS_SERIES: MetricSeries[] = [
  { id: "CPU Temp", color: "#e74c3c", field: "cpuTemp" },
  { id: "GPU Temp", color: "#f39c12", field: "gpuTemp" },
];

const RAM_SERIES: MetricSeries[] = [
  { id: "RAM", color: "#2ecc71", field: "ramUsageMB" },
];

const FPS_SERIES: MetricSeries[] = [
  { id: "FPS", color: "#16b195", field: "fps" },
];

function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function GamePerformanceView({
  sessions,
}: Readonly<GamePerformanceViewProps>) {
  const { t } = useTranslation("activity");

  // Filter sessions with hardware data
  const hwSessions = useMemo(
    () =>
      sessions.filter(
        (s) =>
          s.hardwareMetrics &&
          s.hardwareMetrics.samples &&
          s.hardwareMetrics.samples.length >= 2
      ),
    [sessions]
  );

  // Flatten all samples for stat cards
  const allSamples = useMemo(() => {
    const flat: HardwareSample[] = [];
    for (const s of hwSessions) {
      if (s.hardwareMetrics?.samples) {
        flat.push(...s.hardwareMetrics.samples);
      }
    }
    return flat;
  }, [hwSessions]);

  // Session labels and data for charts
  const sessionLabels = useMemo(
    () => hwSessions.map((s) => formatSessionDate(s.startTime)),
    [hwSessions]
  );

  // Session isolation state - shared across all charts
  const [isolatedSessionIndex, setIsolatedSessionIndex] = useState<
    number | null
  >(null);

  // Compute processed average data for plotting to avoid visual clutter
  const chartDataProps = useMemo(() => {
    if (isolatedSessionIndex === null) {
      // Show average of all sessions for this game
      const avg = getAverageTimeline(
        hwSessions,
        t("average_sessions") || "Average Sessions"
      );
      if (avg) {
        return {
          samples: [avg.samples],
          sessionLabels: [avg.label],
          sessionDurations: [avg.durationMs],
          isolatedSessionIndex: null,
        };
      }
    } else {
      // Show a single specific session
      const session = hwSessions[isolatedSessionIndex];
      if (session) {
        return {
          samples: [session.hardwareMetrics?.samples ?? []],
          sessionLabels: [formatSessionDate(session.startTime)],
          sessionDurations: [session.durationMs],
          isolatedSessionIndex: null,
        };
      }
    }

    return {
      samples: [],
      sessionLabels: [],
      sessionDurations: [],
      isolatedSessionIndex: null,
    };
  }, [hwSessions, isolatedSessionIndex, t]);

  if (hwSessions.length === 0) {
    return (
      <div className="game-performance-view">
        <div className="game-performance-view__empty">
          <Info size={28} style={{ opacity: 0.4 }} />
          <span>
            {t("no_performance_data") || "No performance data available yet."}
          </span>
          <small>
            {t("hw_monitoring_disabled") ||
              "Hardware monitoring is not enabled."}
          </small>
        </div>
      </div>
    );
  }

  return (
    <div className="game-performance-view">
      {/* Stat Cards Row */}
      <PerformanceStatCards allSamples={allSamples} />

      {/* Charts Section */}
      <div className="game-performance-view__charts-section">
        {/* Session selector shared across all charts */}
        {hwSessions.length > 1 && (
          <div className="game-performance-view__chart-header">
            <span className="game-performance-view__chart-title">
              <Activity size={14} />
              {t("session_performance_timeline") ||
                "Session Performance Timeline"}
            </span>
            <div className="game-performance-view__session-selector">
              <BarChart3 size={12} />
              <select
                className="game-performance-view__session-select"
                value={
                  isolatedSessionIndex !== null
                    ? String(isolatedSessionIndex)
                    : "all"
                }
                onChange={(e) => {
                  const val = e.target.value;
                  setIsolatedSessionIndex(val === "all" ? null : Number(val));
                }}
              >
                <option value="all">
                  {t("all_sessions_average") || "All Sessions (Average)"}
                </option>
                {hwSessions.map((s, i) => (
                  <option key={s.id} value={String(i)}>
                    {sessionLabels[i]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Chart 1: CPU + GPU Usage */}
        <div className="game-performance-view__chart-card">
          {hwSessions.length <= 1 && (
            <div className="game-performance-view__chart-header">
              <span className="game-performance-view__chart-title">
                <BarChart3 size={14} />
                {t("cpu_gpu_usage") || "CPU & GPU Usage"}
              </span>
            </div>
          )}
          <CombinedLineChart
            samples={chartDataProps.samples}
            sessionLabels={chartDataProps.sessionLabels}
            sessionDurations={chartDataProps.sessionDurations}
            series={CPU_GPU_USAGE_SERIES}
            height={220}
            isolatedSessionIndex={chartDataProps.isolatedSessionIndex}
            yMin={0}
            yMax={100}
            yAxisLabel="%"
          />
        </div>

        {/* Chart 2: CPU + GPU Temps */}
        <div className="game-performance-view__chart-card">
          {hwSessions.length <= 1 && (
            <div className="game-performance-view__chart-header">
              <span className="game-performance-view__chart-title">
                <BarChart3 size={14} />
                {t("cpu_gpu_temps") || "CPU & GPU Temperatures"}
              </span>
            </div>
          )}
          <CombinedLineChart
            samples={chartDataProps.samples}
            sessionLabels={chartDataProps.sessionLabels}
            sessionDurations={chartDataProps.sessionDurations}
            series={TEMPS_SERIES}
            height={220}
            isolatedSessionIndex={chartDataProps.isolatedSessionIndex}
            yAxisLabel="°C"
          />
        </div>

        {/* Chart 3: RAM Usage */}
        <div className="game-performance-view__chart-card">
          {hwSessions.length <= 1 && (
            <div className="game-performance-view__chart-header">
              <span className="game-performance-view__chart-title">
                <BarChart3 size={14} />
                {t("ram_usage") || "RAM Usage"}
              </span>
            </div>
          )}
          <CombinedLineChart
            samples={chartDataProps.samples}
            sessionLabels={chartDataProps.sessionLabels}
            sessionDurations={chartDataProps.sessionDurations}
            series={RAM_SERIES}
            height={220}
            isolatedSessionIndex={chartDataProps.isolatedSessionIndex}
            yAxisLabel="GB"
          />
        </div>

        {/* Chart 4: FPS */}
        <div className="game-performance-view__chart-card">
          {hwSessions.length <= 1 && (
            <div className="game-performance-view__chart-header">
              <span className="game-performance-view__chart-title">
                <BarChart3 size={14} />
                {t("fps") || "Frame Rate (FPS)"}
              </span>
            </div>
          )}
          <CombinedLineChart
            samples={chartDataProps.samples}
            sessionLabels={chartDataProps.sessionLabels}
            sessionDurations={chartDataProps.sessionDurations}
            series={FPS_SERIES}
            height={220}
            isolatedSessionIndex={chartDataProps.isolatedSessionIndex}
            yAxisLabel=" FPS"
          />
        </div>
      </div>
    </div>
  );
}
