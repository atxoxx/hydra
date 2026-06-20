import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

export interface GenreBreakdownProps {
  genreBreakdown?: Record<string, number>;
  loading: boolean;
}

const GENRE_COLORS = [
  "#16b195",
  "#3e62c0",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#6366f1",
];

export function GenreBreakdown({
  genreBreakdown,
  loading,
}: Readonly<GenreBreakdownProps>) {
  const { t } = useTranslation("activity");

  const chartData = useMemo(() => {
    if (!genreBreakdown) return [];
    return Object.entries(genreBreakdown)
      .map(([name, hours]) => ({
        name,
        hours: Math.round(hours * 10) / 10,
      }))
      .filter((d) => d.hours > 0)
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 10); // Capped at top 10 genres to fit
  }, [genreBreakdown]);

  if (loading) {
    return (
      <div className="section-panel">
        <h3 className="section-panel__title">{t("genre_breakdown")}</h3>
        <div className="section-panel__empty">{t("loading")}</div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="section-panel">
        <h3 className="section-panel__title">{t("genre_breakdown")}</h3>
        <div className="section-panel__empty">{t("no_activity_yet")}</div>
      </div>
    );
  }

  const totalHours = chartData.reduce((s, d) => s + d.hours, 0);

  return (
    <div className="section-panel">
      <h3 className="section-panel__title">{t("playtime_by_genre")}</h3>
      <div className="genre-breakdown__content">
        <ResponsiveContainer width="55%" height={200}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={80}
              paddingAngle={3}
              dataKey="hours"
            >
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={GENRE_COLORS[index % GENRE_COLORS.length]}
                  stroke="transparent"
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "#0d0d0d",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6,
                fontSize: 12,
              }}
              formatter={(value) => [`${Number(value)}h`, t("total_hours")]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="genre-breakdown__legend">
          {chartData.map((entry, index) => (
            <div key={entry.name} className="genre-breakdown__legend-item">
              <span
                className="genre-breakdown__legend-dot"
                style={{
                  backgroundColor: GENRE_COLORS[index % GENRE_COLORS.length],
                }}
              />
              <span className="platform-breakdown__legend-name">
                {entry.name}
              </span>
              <span className="platform-breakdown__legend-value">
                {entry.hours}h
              </span>
              <span className="platform-breakdown__legend-pct">
                {totalHours > 0
                  ? `${Math.round((entry.hours / totalHours) * 100)}%`
                  : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
