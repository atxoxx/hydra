import { useTranslation } from "react-i18next";
import cn from "classnames";
import { Tooltip } from "react-tooltip";

export interface HeatmapDay {
  date: string;
  hours: number;
}

export interface WeeklyHeatmapProps {
  days: HeatmapDay[];
  loading: boolean;
}

function getIntensityClass(hours: number): string {
  if (hours <= 0) return "weekly-heatmap__cell--empty";
  if (hours < 1) return "weekly-heatmap__cell--low";
  if (hours < 3) return "weekly-heatmap__cell--medium";
  if (hours < 6) return "weekly-heatmap__cell--high";
  return "weekly-heatmap__cell--peak";
}

function formatDateTooltip(dateStr: string, hours: number): string {
  const [year, month, day] = dateStr.split("-");
  const h = Math.round(hours * 10) / 10;
  return `${day}/${month}/${year.slice(2)} — ${h}h`;
}

export function WeeklyHeatmap({ days, loading }: WeeklyHeatmapProps) {
  const { t } = useTranslation("activity");

  if (loading) {
    return (
      <div className="section-panel">
        <h3 className="section-panel__title">{t("weekly_activity")}</h3>
        <div className="section-panel__empty">{t("loading")}</div>
      </div>
    );
  }

  return (
    <div className="section-panel">
      <h3 className="section-panel__title">{t("weekly_activity")}</h3>
      {days.length === 0 ? (
        <div className="section-panel__empty">{t("no_activity_yet")}</div>
      ) : (
        <>
          <div className="weekly-heatmap__grid">
            {days.map((day) => (
              <div
                key={day.date}
                className={cn(
                  "weekly-heatmap__cell",
                  getIntensityClass(day.hours)
                )}
                data-tooltip-id="heatmap-tooltip"
                data-tooltip-content={formatDateTooltip(day.date, day.hours)}
              />
            ))}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 4,
              marginTop: 8,
              fontSize: 10,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            <span>Less</span>
            <div
              className="weekly-heatmap__cell weekly-heatmap__cell--empty"
              style={{ width: 12, height: 12 }}
            />
            <div
              className="weekly-heatmap__cell weekly-heatmap__cell--low"
              style={{ width: 12, height: 12 }}
            />
            <div
              className="weekly-heatmap__cell weekly-heatmap__cell--medium"
              style={{ width: 12, height: 12 }}
            />
            <div
              className="weekly-heatmap__cell weekly-heatmap__cell--high"
              style={{ width: 12, height: 12 }}
            />
            <div
              className="weekly-heatmap__cell weekly-heatmap__cell--peak"
              style={{ width: 12, height: 12 }}
            />
            <span>More</span>
          </div>
          <Tooltip id="heatmap-tooltip" className="weekly-heatmap__tooltip" />
        </>
      )}
    </div>
  );
}
