import { useTranslation } from "react-i18next";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { TopPlayedGame } from "./top-played-games";

export interface GenreBreakdownProps {
  topGames: TopPlayedGame[];
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

export function GenreBreakdown({ loading }: GenreBreakdownProps) {
  const { t } = useTranslation("activity");

  if (loading) {
    return (
      <div className="section-panel">
        <h3 className="section-panel__title">{t("genre_breakdown")}</h3>
        <div className="section-panel__empty">{t("loading")}</div>
      </div>
    );
  }

  // Placeholder data until genre data is available from shop details
  const data = [{ name: t("other_genres"), value: 1 }];

  return (
    <div className="section-panel">
      <h3 className="section-panel__title">{t("playtime_by_genre")}</h3>
      <div className="genre-breakdown__content">
        <ResponsiveContainer width="60%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell
                  key={index}
                  fill={GENRE_COLORS[index % GENRE_COLORS.length]}
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
            />
            <Legend
              wrapperStyle={{ fontSize: 12, color: "#d0d1d7" }}
              iconType="circle"
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="genre-breakdown__legend">
          {data.map((item, index) => (
            <div key={item.name} className="genre-breakdown__legend-item">
              <span
                className="genre-breakdown__legend-dot"
                style={{
                  backgroundColor: GENRE_COLORS[index % GENRE_COLORS.length],
                }}
              />
              {item.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
