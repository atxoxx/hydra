import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { HardwareSample } from "../../declaration";
import { useTranslation } from "react-i18next";
import "./combined-line-chart.scss";

export interface MetricSeries {
  id: string;
  color: string;
  /** Which sample field to read */
  field: keyof HardwareSample;
}

export interface CombinedLineChartProps {
  /** All sessions' samples to overlay */
  samples: HardwareSample[][];
  /** Labels for each session (e.g., ["Jan 15, 3:00 PM", "Jan 14, 8:00 PM"]) */
  sessionLabels: string[];
  /** Duration of each session in ms (for X-axis time mapping) */
  sessionDurations: number[];
  /** Which metrics to plot */
  series: MetricSeries[];
  /** Chart height */
  height?: number;
  /** Which session to isolate (null = all sessions) */
  isolatedSessionIndex?: number | null;
  /** Y-axis min/max override */
  yMin?: number;
  yMax?: number;
  /** Y-axis label/unit suffix */
  yAxisLabel?: string;
}

function formatTimeTick(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

const MAX_POINTS = 80;

export function CombinedLineChart({
  samples,
  sessionLabels,
  sessionDurations,
  series,
  height = 220,
  isolatedSessionIndex,
  yMin,
  yMax,
  yAxisLabel,
}: Readonly<CombinedLineChartProps>) {
  const { t } = useTranslation("activity");

  // Determine active session indices to plot
  const activeSessionIndices = useMemo(() => {
    if (isolatedSessionIndex !== undefined && isolatedSessionIndex !== null) {
      return [isolatedSessionIndex];
    }
    return samples.map((_, i) => i);
  }, [samples, isolatedSessionIndex]);

  // Construct unified data array sorted by elapsedSeconds
  const chartData = useMemo(() => {
    const dataMap = new Map<number, Record<string, number>>();

    for (const s of series) {
      for (const sessionIdx of activeSessionIndices) {
        const sessionSamples = samples[sessionIdx];
        if (!sessionSamples || sessionSamples.length < 2) continue;

        const step = Math.max(
          1,
          Math.floor(sessionSamples.length / MAX_POINTS)
        );
        const duration = sessionDurations[sessionIdx] ?? 0;

        sessionSamples.forEach((sample, sampleIdx) => {
          if (sampleIdx % step !== 0) return;

          const elapsedMs =
            (sampleIdx / Math.max(1, sessionSamples.length - 1)) * duration;
          const elapsedSeconds = Math.round(elapsedMs / 1000);

          let val = (sample[s.field] as number) || 0;
          // RAM metrics in raw MB are converted to GB for better readability
          if (s.field === "ramUsageMB") {
            val = Math.round((val / 1024) * 10) / 10;
          }

          if (!dataMap.has(elapsedSeconds)) {
            dataMap.set(elapsedSeconds, { elapsedSeconds });
          }

          const lineKey = `${s.id}_${sessionIdx}`;
          dataMap.get(elapsedSeconds)![lineKey] = val;
        });
      }
    }

    return Array.from(dataMap.values()).sort(
      (a, b) => a.elapsedSeconds - b.elapsedSeconds
    );
  }, [samples, sessionDurations, series, activeSessionIndices]);

  // Helper to determine line color based on session order
  const getLineColor = (s: MetricSeries, sessionIdx: number) => {
    if (isolatedSessionIndex !== undefined && isolatedSessionIndex !== null) {
      return s.color;
    }
    if (samples.length <= 1 || sessionIdx === 0) {
      return s.color;
    }
    return s.color + "73"; // Appends ~45% opacity to trailing session lines
  };

  // Custom tooltips
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="combined-line-chart__tooltip">
        <div className="combined-line-chart__tooltip-time">
          {t("elapsed_time") || "Elapsed Time"}: {formatTimeTick(label)}
        </div>
        <div className="combined-line-chart__tooltip-items">
          {payload.map((item: any) => {
            return (
              <div
                key={item.name}
                className="combined-line-chart__tooltip-item"
              >
                <span
                  className="combined-line-chart__tooltip-color-indicator"
                  style={{ backgroundColor: item.stroke }}
                />
                <span className="combined-line-chart__tooltip-item-name">
                  {item.name}:
                </span>
                <span className="combined-line-chart__tooltip-item-value">
                  {item.value}
                  {yAxisLabel ?? ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="combined-line-chart">
      <div className="combined-line-chart__container" style={{ height }}>
        {chartData.length === 0 ? (
          <div className="combined-line-chart__empty">
            {t("no_performance_data") || "No performance data available yet."}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{
                top: 12,
                right: 20,
                bottom: 5,
                left: -10,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="rgba(255,255,255,0.05)"
              />
              <XAxis
                type="number"
                dataKey="elapsedSeconds"
                tickFormatter={formatTimeTick}
                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
                tickLine={false}
                axisLine={false}
                domain={[0, "auto"]}
              />
              <YAxis
                domain={[yMin ?? "auto", yMax ?? "auto"]}
                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
                tickLine={false}
                axisLine={false}
                width={45}
                tickFormatter={(v) => `${v}${yAxisLabel ?? ""}`}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{
                  stroke: "rgba(255,255,255,0.15)",
                  strokeWidth: 1,
                  strokeDasharray: "4 4",
                }}
              />
              {series.flatMap((s) =>
                activeSessionIndices.map((sessionIdx) => {
                  const lineKey = `${s.id}_${sessionIdx}`;
                  const label =
                    activeSessionIndices.length > 1 && samples.length > 1
                      ? `${s.id} (${sessionLabels[sessionIdx]})`
                      : s.id;

                  return (
                    <Line
                      key={lineKey}
                      type="monotone"
                      dataKey={lineKey}
                      name={label}
                      stroke={getLineColor(s, sessionIdx)}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                      connectNulls={true}
                    />
                  );
                })
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
