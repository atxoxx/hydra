import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { ChevronRightIcon, CheckIcon } from "@primer/octicons-react";
import cn from "classnames";
import type { UserGameStatus } from "@types";

import { SidebarFilterButton } from "./sidebar-filter-button";

import "./sidebar-filter-menu.scss";

export type LibrarySetFilter = "all" | "installed" | "not_installed";

export type SidebarSortOption =
  | "alphabetical"
  | "title_desc"
  | "most_played"
  | "recently_played"
  | "installed_first";

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  /** Number of games that match the *other* active filters (recounted when other filters change). */
  count: number;
}

export interface SidebarFilterMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  /** Single-select library set filter. */
  librarySet: LibrarySetFilter;
  onLibrarySetChange: (next: LibrarySetFilter) => void;
  /** Total number of games in the library (drives the "All" chip count). */
  totalCount: number;
  /** Number of games actually installed (drives the "Installed" chip count). */
  installedCount: number;
  /** Number of games not installed (drives the "Not installed" chip count). */
  notInstalledCount: number;

  /** Multi-select stores/platform. */
  stores: string[];
  onStoresChange: (next: string[]) => void;
  availableStores: FilterOption<string>[];

  /** Multi-select genres. */
  genres: string[];
  onGenresChange: (next: string[]) => void;
  availableGenres: FilterOption<string>[];

  /** Multi-select user statuses (`UserGameStatus`). */
  statuses: UserGameStatus[];
  onStatusesChange: (next: UserGameStatus[]) => void;
  availableStatuses: FilterOption<UserGameStatus>[];

  /** Single-select sort. */
  sortBy: SidebarSortOption;
  onSortChange: (next: SidebarSortOption) => void;

  /** Reset all filters back to defaults. */
  onResetAll: () => void;
}

type GroupKey = "library_set" | "stores" | "genre" | "status" | "sort";

const GROUP_ORDER: GroupKey[] = [
  "library_set",
  "stores",
  "genre",
  "status",
  "sort",
];

export function SidebarFilterMenu({
  open,
  onOpenChange,
  librarySet,
  onLibrarySetChange,
  totalCount,
  installedCount,
  notInstalledCount,
  stores,
  onStoresChange,
  availableStores,
  genres,
  onGenresChange,
  availableGenres,
  statuses,
  onStatusesChange,
  availableStatuses,
  sortBy,
  onSortChange,
  onResetAll,
}: Readonly<SidebarFilterMenuProps>) {
  const { t } = useTranslation("sidebar");
  const [activeGroup, setActiveGroup] = useState<GroupKey>("library_set");

  // Reduce-motion support: when the user prefers reduced motion, drop entrance animation.
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(media.matches);
    const handler = (event: MediaQueryListEvent) =>
      setPrefersReducedMotion(event.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  const totalActiveCount = useMemo(() => {
    return (
      (librarySet !== "all" ? 1 : 0) +
      stores.length +
      genres.length +
      statuses.length +
      (sortBy !== "alphabetical" ? 1 : 0)
    );
  }, [librarySet, stores, genres, statuses, sortBy]);

  function toggleMulti<T extends string>(
    current: T[],
    value: T,
    onChange: (next: T[]) => void
  ) {
    if (current.includes(value)) {
      onChange(current.filter((v) => v !== value));
    } else {
      onChange([...current, value]);
    }
  }

  function toggleMultiValue<T extends string>(current: T[], value: T): T[] {
    if (current.includes(value)) {
      return current.filter((v) => v !== value);
    }
    return [...current, value];
  }

  function renderChipRow<T extends string>(
    options: FilterOption<T>[],
    selected: T[],
    onSelect: (value: T) => void,
    keyPrefix: string,
    isRadio: boolean,
    chipOptions: { showCounts?: boolean; disableBasedOnCount?: boolean } = {}
  ) {
    const { showCounts = true, disableBasedOnCount = true } = chipOptions;
    if (options.length === 0) {
      return (
        <p className="sidebar-filter-menu__empty">{t("filter_no_results")}</p>
      );
    }

    return (
      <div className="sidebar-filter-menu__chip-grid">
        {options.map((option) => {
          const isSelected = isRadio
            ? selected.length > 0 && selected[0] === option.value
            : selected.includes(option.value);
          const isDisabled =
            disableBasedOnCount && option.count === 0 && !isSelected;

          return (
            <button
              key={`${keyPrefix}-${option.value}`}
              type="button"
              role={isRadio ? "radio" : "checkbox"}
              aria-checked={isSelected}
              disabled={isDisabled}
              onClick={() => {
                if (isDisabled) return;
                onSelect(option.value);
              }}
              className={cn("sidebar-filter-menu__chip", {
                "sidebar-filter-menu__chip--selected": isSelected,
                "sidebar-filter-menu__chip--disabled": isDisabled,
              })}
            >
              {isSelected && (
                <CheckIcon
                  size={12}
                  className="sidebar-filter-menu__chip-check"
                />
              )}
              <span className="sidebar-filter-menu__chip-label">
                {option.label}
              </span>
              {showCounts && (
                <span className="sidebar-filter-menu__chip-count">
                  {option.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  function getGroupLabel(group: GroupKey): string {
    switch (group) {
      case "library_set":
        return t("filter_group_library_set");
      case "stores":
        return t("filter_group_stores");
      case "genre":
        return t("filter_group_genre");
      case "status":
        return t("filter_group_status");
      case "sort":
        return t("filter_group_sort");
    }
  }

  function getGroupSelectionCount(group: GroupKey): number {
    switch (group) {
      case "library_set":
        return librarySet === "all" ? 0 : 1;
      case "stores":
        return stores.length;
      case "genre":
        return genres.length;
      case "status":
        return statuses.length;
      case "sort":
        return sortBy === "alphabetical" ? 0 : 1;
    }
  }

  function renderActiveGroupBody(group: GroupKey) {
    switch (group) {
      case "library_set": {
        const options: FilterOption<LibrarySetFilter>[] = [
          {
            value: "all",
            label: t("filter_library_set_all"),
            count: totalCount,
          },
          {
            value: "installed",
            label: t("filter_library_set_installed"),
            count: installedCount,
          },
          {
            value: "not_installed",
            label: t("filter_library_set_not_installed"),
            count: notInstalledCount,
          },
        ];
        return renderChipRow(
          options,
          [librarySet],
          (value) => onLibrarySetChange(value as LibrarySetFilter),
          "library-set",
          true
        );
      }
      case "stores":
        return renderChipRow(
          availableStores,
          stores,
          (value) => toggleMulti(stores, value, onStoresChange),
          "stores",
          false
        );
      case "genre":
        return renderChipRow(
          availableGenres,
          genres,
          (value) => toggleMulti(genres, value, onGenresChange),
          "genre",
          false
        );
      case "status":
        return renderChipRow(
          availableStatuses,
          statuses,
          (value) => onStatusesChange(toggleMultiValue(statuses, value)),
          "status",
          false
        );
      case "sort": {
        const sortLabels: Record<SidebarSortOption, string> = {
          alphabetical: t("sort_alphabetical"),
          title_desc: t("sort_title_desc"),
          most_played: t("sort_most_played"),
          recently_played: t("sort_recently_played"),
          installed_first: t("sort_installed_first"),
        };
        const options: FilterOption<SidebarSortOption>[] = (
          [
            "alphabetical",
            "title_desc",
            "most_played",
            "recently_played",
            "installed_first",
          ] as SidebarSortOption[]
        ).map((value) => ({
          value,
          label: sortLabels[value],
          count: 0,
        }));
        return renderChipRow(
          options,
          [sortBy],
          (value) => onSortChange(value as SidebarSortOption),
          "sort",
          true,
          { showCounts: false, disableBasedOnCount: false }
        );
      }
    }
  }

  return (
    <DropdownMenuPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DropdownMenuPrimitive.Trigger asChild>
        <SidebarFilterButton
          activeCount={totalActiveCount}
          isOpen={open}
          onClick={() => onOpenChange(!open)}
        />
      </DropdownMenuPrimitive.Trigger>

      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          side="bottom"
          align="end"
          sideOffset={6}
          collisionPadding={16}
          className={cn("sidebar-filter-menu__content", {
            "sidebar-filter-menu__content--reduced-motion":
              prefersReducedMotion,
          })}
        >
          <div
            className="sidebar-filter-menu"
            role="dialog"
            aria-label={t("filter_button_label")}
          >
            <div className="sidebar-filter-menu__left" role="tablist">
              {GROUP_ORDER.map((group) => {
                const selectionCount = getGroupSelectionCount(group);
                const isActive = activeGroup === group;
                const totalCount = (() => {
                  switch (group) {
                    case "library_set":
                      return 3;
                    case "stores":
                      return availableStores.length;
                    case "genre":
                      return availableGenres.length;
                    case "status":
                      return availableStatuses.length;
                    case "sort":
                      return 5;
                  }
                })();

                return (
                  <button
                    key={group}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveGroup(group)}
                    className={cn("sidebar-filter-menu__group-button", {
                      "sidebar-filter-menu__group-button--active": isActive,
                      "sidebar-filter-menu__group-button--empty":
                        totalCount === 0,
                    })}
                  >
                    <span className="sidebar-filter-menu__group-label">
                      {getGroupLabel(group)}
                    </span>
                    {selectionCount > 0 && (
                      <span className="sidebar-filter-menu__group-count">
                        {selectionCount}
                      </span>
                    )}
                    <ChevronRightIcon
                      size={12}
                      className="sidebar-filter-menu__group-chevron"
                    />
                  </button>
                );
              })}
            </div>

            <div className="sidebar-filter-menu__right" role="tabpanel">
              {renderActiveGroupBody(activeGroup)}
            </div>

            <div className="sidebar-filter-menu__footer">
              <button
                type="button"
                className="sidebar-filter-menu__reset"
                onClick={onResetAll}
                disabled={totalActiveCount === 0}
              >
                {t("filter_reset_all")}
              </button>
            </div>
          </div>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
