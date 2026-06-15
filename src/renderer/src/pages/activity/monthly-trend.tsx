import { useTranslation } from "react-i18next";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DailyPlaytimeEntry } from "../../declaration";

export interface MonthlyTrendProps {
  dailyEntries: DailyPlaytimeEntry[];
  startDate: string;
  endDate: string;
  loading: boolean;
}

export function MonthlyTrend({
  dailyEntries,
  startDate,
  endDate,
  loading,
}: MonthlyTrendProps) {
  const { t } = useTranslation("activity");

  if (loading) {
    return (
      <div className="section-panel">
        <h3 className="section-panel__title">{t("monthly_trend")}</h3>
        <div className="section-panel__empty">{t("loading")}</div>
      </div>
    );
  }

  const dayMap = new Map<string, number>();
  for (const entry of dailyEntries) {
    dayMap.set(entry.date, (dayMap.get(entry.date) ?? 0) + entry.totalMilliseconds);
  }

  const data: { date: string; hours: number }[] = [];
  const end = new Date(endDate);
  const cursor = new Date(startDate);

  while (cursor <= end) {
    const dateStr = cursor.toISOString().slice(0, 10);
    data.push({
      date: dateStr.slice(5),
      hours: (dayMap.get(dateStr) ?? 0) / 3_600_000,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  if (data.length === 0) {
    return (
      <div className="section-panel">
        <h3 className="section-panel__title">{t("monthly_trend")}</h3>
        <div className="section-panel__empty">{t("no_activity_yet")}</div>
      </div>
    );
  }

  return (
    <div className="section-panel">
      <h3 className="section-panel__title">{t("monthly_trend")}</h3>
      <div className="monthly-trend__chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="playtimeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16b195" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#16b195" stopOpacity={0} />
              </linearGradient>
            </defs>
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
              width={36}
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
            <Area
              type="monotone"
              dataKey="hours"
              stroke="#16b195"
              strokeWidth={2}
              fill="url(#playtimeGradient)"
              dot={false}
              activeDot={{ r: 4, fill: "#16b195" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
