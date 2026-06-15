import { useTranslation } from "react-i18next";
import cn from "classnames";

export type DateRange = "7d" | "30d" | "90d" | "all";

export interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const OPTIONS: { value: DateRange; labelKey: string }[] = [
  { value: "7d", labelKey: "last_7_days" },
  { value: "30d", labelKey: "last_30_days" },
  { value: "90d", labelKey: "last_90_days" },
  { value: "all", labelKey: "all_time" },
];

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const { t } = useTranslation("activity");

  return (
    <div className="date-range-filter">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn("date-range-filter__tab", {
            "date-range-filter__tab--active": value === option.value,
          })}
          onClick={() => onChange(option.value)}
        >
          {t(option.labelKey)}
        </button>
      ))}
    </div>
  );
}
