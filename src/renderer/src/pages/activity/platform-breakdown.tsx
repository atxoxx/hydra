import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

export interface PlatformBreakdownProps {
  platformBreakdown?: Record<string, number>;
  loading: boolean;
}

const PLATFORM_COLORS: Record<string, string> = {
  steam: "#1a9fff",
  epic: "#121212",
  gog: "#8b5cf6",
  origin: "#f56c2d",
  battlenet: "#00aeff",
  ubisoft: "#06b6d4",
  microsoft: "#10b981",
  ea: "#ef4444",
  custom: "#6366f1",
  launchbox: "#f59e0b",
  default: "#16b195",
};

function getPlatformColor(shop: string): string {
  return PLATFORM_COLORS[shop.toLowerCase()] ?? PLATFORM_COLORS.default;
}

function getPlatformLabel(shop: string): string {
  const labels: Record<string, string> = {
    steam: "Steam",
    epic: "Epic Games",
    gog: "GOG",
    origin: "EA App",
    battlenet: "Battle.net",
    ubisoft: "Ubisoft Connect",
    microsoft: "Microsoft Store",
    ea: "EA",
    custom: "Custom",
    launchbox: "LaunchBox",
  };
  return labels[shop.toLowerCase()] ?? shop;
}

export function PlatformBreakdown({
  platformBreakdown,
  loading,
}: Readonly<PlatformBreakdownProps>) {
  const { t } = useTranslation("activity");

  const chartData = useMemo(() => {
    if (!platformBreakdown) return [];
    return Object.entries(platformBreakdown)
      .map(([shop, hours]) => ({
        name: getPlatformLabel(shop),
        shop,
        hours: Math.round(hours * 10) / 10,
      }))
      .filter((d) => d.hours > 0)
      .sort((a, b) => b.hours - a.hours);
  }, [platformBreakdown]);

  if (loading) {
    return (
      <div className="section-panel">
        <h3 className="section-panel__title">{t("platform_breakdown")}</h3>
        <div className="section-panel__empty">{t("loading")}</div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="section-panel">
        <h3 className="section-panel__title">{t("platform_breakdown")}</h3>
        <div className="section-panel__empty">{t("no_activity_yet")}</div>
      </div>
    );
  }

  const totalHours = chartData.reduce((s, d) => s + d.hours, 0);

  return (
    <div className="section-panel">
      <h3 className="section-panel__title">{t("platform_breakdown")}</h3>
      <div className="platform-breakdown__content">
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
              {chartData.map((entry) => (
                <Cell
                  key={entry.shop}
                  fill={getPlatformColor(entry.shop)}
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
        <div className="platform-breakdown__legend">
          {chartData.map((entry) => (
            <div key={entry.shop} className="platform-breakdown__legend-item">
              <span
                className="platform-breakdown__legend-dot"
                style={{ backgroundColor: getPlatformColor(entry.shop) }}
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
