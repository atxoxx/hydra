import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { SearchIcon, FilterIcon } from "@primer/octicons-react";
import { GAMEPASS_REGIONS } from "./gamepass-service";
import "./gamepass-filters.scss";

export interface GamePassFilterState {
  search: string;
  categories: string[];
  platforms: string[];
  sort: "a-z" | "z-a" | "release-date" | "recently-added";
}

interface GamePassFiltersProps {
  region: string;
  categories: string[];
  filters: GamePassFilterState;
  onRegionChange: (region: string) => void;
  onFiltersChange: (filters: GamePassFilterState) => void;
  loading: boolean;
}

export function GamePassFilters({
  region,
  categories,
  filters,
  onRegionChange,
  onFiltersChange,
  loading,
}: GamePassFiltersProps) {
  const { t } = useTranslation("deals");
  const [showFilters, setShowFilters] = useState(false);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFiltersChange({ ...filters, search: e.target.value });
    },
    [filters, onFiltersChange]
  );

  const handleSortChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFiltersChange({
        ...filters,
        sort: e.target.value as GamePassFilterState["sort"],
      });
    },
    [filters, onFiltersChange]
  );

  const handleCategoryToggle = useCallback(
    (category: string) => {
      const next = filters.categories.includes(category)
        ? filters.categories.filter((c) => c !== category)
        : [...filters.categories, category];
      onFiltersChange({ ...filters, categories: next });
    },
    [filters, onFiltersChange]
  );

  const hasActiveFilters = filters.categories.length > 0 || filters.search.trim() !== "";

  return (
    <div className="gamepass-filters">
      <div className="gamepass-filters__top-row">
        <div className="gamepass-filters__region">
          <label className="gamepass-filters__label">{t("region")}</label>
          <select
            className="gamepass-filters__select"
            value={region}
            onChange={(e) => onRegionChange(e.target.value)}
            disabled={loading}
          >
            {GAMEPASS_REGIONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.flag} {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="gamepass-filters__search">
          <SearchIcon size={14} />
          <input
            type="text"
            className="gamepass-filters__search-input"
            placeholder={t("search_games")}
            value={filters.search}
            onChange={handleSearchChange}
          />
        </div>

        <div className="gamepass-filters__sort">
          <label className="gamepass-filters__label">{t("sort_by")}</label>
          <select
            className="gamepass-filters__select"
            value={filters.sort}
            onChange={handleSortChange}
          >
            <option value="a-z">{t("sort_a_z")}</option>
            <option value="z-a">{t("sort_z_a")}</option>
            <option value="release-date">{t("sort_release_date")}</option>
            <option value="recently-added">{t("sort_recently_added")}</option>
          </select>
        </div>

        <button
          type="button"
          className={`gamepass-filters__toggle ${showFilters ? "gamepass-filters__toggle--active" : ""} ${hasActiveFilters ? "gamepass-filters__toggle--has-filters" : ""}`}
          onClick={() => setShowFilters(!showFilters)}
          title={t("filters")}
        >
          <FilterIcon size={14} />
          <span>{t("filters")}</span>
        </button>
      </div>

      {showFilters && (
        <div className="gamepass-filters__expanded">
          <div className="gamepass-filters__categories">
            <span className="gamepass-filters__categories-label">
              {t("categories")}:
            </span>
            <div className="gamepass-filters__categories-list">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`gamepass-filters__category-tag ${filters.categories.includes(cat) ? "gamepass-filters__category-tag--active" : ""}`}
                  onClick={() => handleCategoryToggle(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              className="gamepass-filters__clear-all"
              onClick={() =>
                onFiltersChange({
                  search: "",
                  categories: [],
                  platforms: [],
                  sort: filters.sort,
                })
              }
            >
              {t("clear_filters")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
