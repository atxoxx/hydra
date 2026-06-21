import { useTranslation } from "react-i18next";
import cn from "classnames";
import { BarChart3, TrendingUp, Filter } from "lucide-react";
import { type DateRange } from "./date-range-filter";

export type AggregationMode = "day" | "week" | "month";
export type ChartType = "bar" | "line";

export interface ActivityToolbarProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  aggregation: AggregationMode;
  onAggregationChange: (mode: AggregationMode) => void;
  chartType: ChartType;
  onChartTypeChange: (type: ChartType) => void;
  sources?: string[];
  sourceFilter: string;
  onSourceFilterChange: (source: string) => void;
}

const DATE_RANGE_OPTIONS: { value: DateRange; labelKey: string }[] = [
  { value: "7d", labelKey: "last_7_days" },
  { value: "30d", labelKey: "last_30_days" },
  { value: "90d", labelKey: "last_90_days" },
  { value: "all", labelKey: "all_time" },
];

const AGGREGATION_OPTIONS: { value: AggregationMode; labelKey: string }[] = [
  { value: "day", labelKey: "day" },
  { value: "week", labelKey: "week" },
  { value: "month", labelKey: "month" },
];

export function ActivityToolbar({
  dateRange,
  onDateRangeChange,
  aggregation,
  onAggregationChange,
  chartType,
  onChartTypeChange,
  sources,
  sourceFilter,
  onSourceFilterChange,
}: ActivityToolbarProps) {
  const { t } = useTranslation("activity");

  return (
    <div className="activity-toolbar">
      {/* ── Date Range ── */}
      <div className="activity-toolbar__group activity-toolbar__date-range">
        {DATE_RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={cn("activity-toolbar__pill", {
              "activity-toolbar__pill--active": dateRange === opt.value,
            })}
            onClick={() => onDateRangeChange(opt.value)}
          >
            {t(opt.labelKey)}
          </button>
        ))}
      </div>

      {/* ── Divider ── */}
      <div className="activity-toolbar__divider" />

      {/* ── Aggregation Mode ── */}
      <div className="activity-toolbar__group">
        <span className="activity-toolbar__label">
          {t("aggregation") || "Group"}
        </span>
        <div className="activity-toolbar__segmented">
          {AGGREGATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={cn("activity-toolbar__segmented-btn", {
                "activity-toolbar__segmented-btn--active":
                  aggregation === opt.value,
              })}
              onClick={() => onAggregationChange(opt.value)}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="activity-toolbar__divider" />

      {/* ── Chart Type ── */}
      <div className="activity-toolbar__group">
        <span className="activity-toolbar__label">
          {t("chart_type") || "Chart"}
        </span>
        <div className="activity-toolbar__icon-toggle">
          <button
            type="button"
            className={cn("activity-toolbar__icon-btn", {
              "activity-toolbar__icon-btn--active": chartType === "bar",
            })}
            onClick={() => onChartTypeChange("bar")}
            title={t("bar_chart") || "Bar Chart"}
          >
            <BarChart3 size={14} />
          </button>
          <button
            type="button"
            className={cn("activity-toolbar__icon-btn", {
              "activity-toolbar__icon-btn--active": chartType === "line",
            })}
            onClick={() => onChartTypeChange("line")}
            title={t("line_chart") || "Line Chart"}
          >
            <TrendingUp size={14} />
          </button>
        </div>
      </div>

      {/* ── Source Filter (only shown when multiple sources exist) ── */}
      {sources && sources.length > 1 && (
        <>
          <div className="activity-toolbar__divider" />
          <div className="activity-toolbar__group">
            <Filter size={11} className="activity-toolbar__filter-icon" />
            <select
              className="activity-toolbar__select"
              value={sourceFilter}
              onChange={(e) => onSourceFilterChange(e.target.value)}
            >
              <option value="all">{t("all_sources") || "All Sources"}</option>
              {sources.map((src) => (
                <option key={src} value={src}>
                  {src.charAt(0).toUpperCase() + src.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
    </div>
  );
}
