import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { FilterIcon } from "@primer/octicons-react";
import cn from "classnames";

import "./sidebar-filter-button.scss";

export interface SidebarFilterButtonProps {
  /** Number of filters currently active (sums all groups). */
  activeCount: number;
  /** Whether the menu popover is currently open. */
  isOpen: boolean;
  /**
   * Optional click handler. When `null`/omitted, the button relies on a parent
   * `DropdownMenuPrimitive.Trigger asChild` to manage toggle behavior.
   */
  onClick?: () => void;
  /** Optional class names. */
  className?: string;
}

export const SidebarFilterButton = forwardRef<
  HTMLButtonElement,
  SidebarFilterButtonProps
>(function SidebarFilterButton(
  { activeCount, isOpen, onClick, className },
  ref
) {
  const { t } = useTranslation("sidebar");

  return (
    <button
      ref={ref}
      type="button"
      className={cn("sidebar-filter-button", className, {
        "sidebar-filter-button--active": activeCount > 0,
        "sidebar-filter-button--open": isOpen,
      })}
      onClick={onClick}
      aria-label={t("filter_button_label")}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      data-tooltip-id="sidebar-filter-button-tooltip"
      data-tooltip-content={t("filter_button_label")}
      data-tooltip-place="top"
    >
      <FilterIcon size={16} />
      {activeCount > 0 && (
        <span
          className="sidebar-filter-button__badge"
          aria-label={
            activeCount === 1
              ? t("filter_active_count_one", { count: activeCount })
              : t("filter_active_count_other", { count: activeCount })
          }
        >
          {activeCount}
        </span>
      )}
    </button>
  );
});
