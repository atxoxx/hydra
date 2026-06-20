import { useMemo } from "react";
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

  const paddedDays = useMemo(() => {
    const list: (HeatmapDay | null)[] = [];
    if (days.length === 0) return list;

    // Find the day of the week of the first date (0: Sunday, 1: Monday, etc.)
    const firstDate = new Date(days[0].date + "T00:00:00");
    const firstDayOfWeek = firstDate.getDay();

    // Pad the start so cells align with correct row index (Sunday is row 0)
    for (let i = 0; i < firstDayOfWeek; i++) {
      list.push(null);
    }

    list.push(...days);
    return list;
  }, [days]);

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
          <div className="weekly-heatmap__container">
            {/* Weekday indicators column on the left */}
            <div className="weekly-heatmap__row-labels">
              <span></span>
              <span>{t("Mon") || "Mon"}</span>
              <span></span>
              <span>{t("Wed") || "Wed"}</span>
              <span></span>
              <span>{t("Fri") || "Fri"}</span>
              <span></span>
            </div>

            {/* Aligned contribution cells */}
            <div className="weekly-heatmap__grid">
              {paddedDays.map((day, index) => {
                if (!day) {
                  return (
                    <div
                      key={`pad-${index}`}
                      className="weekly-heatmap__cell weekly-heatmap__cell--padded"
                    />
                  );
                }

                return (
                  <div
                    key={day.date}
                    className={cn(
                      "weekly-heatmap__cell",
                      getIntensityClass(day.hours)
                    )}
                    data-tooltip-id="heatmap-tooltip"
                    data-tooltip-content={formatDateTooltip(
                      day.date,
                      day.hours
                    )}
                  />
                );
              })}
            </div>
          </div>

          <div className="weekly-heatmap__footer">
            <span>Less</span>
            <div className="weekly-heatmap__cell weekly-heatmap__cell--empty" />
            <div className="weekly-heatmap__cell weekly-heatmap__cell--low" />
            <div className="weekly-heatmap__cell weekly-heatmap__cell--medium" />
            <div className="weekly-heatmap__cell weekly-heatmap__cell--high" />
            <div className="weekly-heatmap__cell weekly-heatmap__cell--peak" />
            <span>More</span>
          </div>
          <Tooltip id="heatmap-tooltip" className="weekly-heatmap__tooltip" />
        </>
      )}
    </div>
  );
}
