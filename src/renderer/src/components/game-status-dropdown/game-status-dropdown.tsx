import { useTranslation } from "react-i18next";
import { ChevronDownIcon } from "@primer/octicons-react";
import type { UserGameStatus } from "@types";

import "./game-status-dropdown.scss";

export const STATUS_OPTIONS: {
  value: UserGameStatus;
  labelKey: string;
  color: string;
}[] = [
  {
    value: "not_played",
    labelKey: "status_not_played",
    color: "#7f8c8d",
  },
  { value: "playing", labelKey: "status_playing", color: "#16b195" },
  { value: "on_hold", labelKey: "status_on_hold", color: "#d4a853" },
  { value: "played", labelKey: "status_played", color: "#3498db" },
  { value: "beaten", labelKey: "status_beaten", color: "#1abc9c" },
  { value: "completed", labelKey: "status_completed", color: "#2ecc71" },
  { value: "abandoned", labelKey: "status_abandoned", color: "#e74c3c" },
  { value: "plan_to_play", labelKey: "status_plan_to_play", color: "#9b59b6" },
  { value: "none", labelKey: "status_none", color: "#888888" },
];

export interface GameStatusDropdownProps {
  /** Current status value. Pass null for "no status" (shows as "No Status"). */
  value: UserGameStatus | null;
  /** Called when the user selects a new status. */
  onChange: (status: UserGameStatus) => void;
  /** Disable the dropdown (e.g. during an update). */
  disabled?: boolean;
}

/**
 * Reusable game status dropdown with color-coded indicator dot.
 * Used in StatsCard, metadata panel, and anywhere game status is displayed.
 */
export function GameStatusDropdown({
  value,
  onChange,
  disabled,
}: Readonly<GameStatusDropdownProps>) {
  const { t } = useTranslation("game_details");

  const currentStatus: UserGameStatus = value ?? "none";
  const currentOption = STATUS_OPTIONS.find(
    (o) => o.value === currentStatus
  );

  return (
    <span
      className="game-status-dropdown"
      style={{
        backgroundColor: currentOption?.color
          ? `${currentOption.color}20`
          : "transparent",
      }}
    >
      <span
        className="game-status-dropdown__dot"
        style={{ backgroundColor: currentOption?.color }}
      />
      <select
        className="game-status-dropdown__select"
        value={currentStatus}
        onChange={(e) => {
          const status = e.target.value as UserGameStatus;
          if (status !== currentStatus) onChange(status);
        }}
        disabled={disabled}
        style={{ color: currentOption?.color }}
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {t(opt.labelKey)}
          </option>
        ))}
      </select>
      <ChevronDownIcon size={10} />
    </span>
  );
}
