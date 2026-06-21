import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, LayoutGrid } from "lucide-react";

export interface SidebarGame {
  objectId: string;
  shop: string;
  title: string;
  iconUrl: string | null;
  totalMilliseconds: number;
}

export interface ActivityGameSidebarProps {
  games: SidebarGame[];
  loading: boolean;
  onGameSelect: (objectId: string, shop: string, title: string) => void;
  selectedGameId: string | null;
}

function formatPlaytime(ms: number): string {
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatTotalPlaytime(games: SidebarGame[]): string {
  const totalMs = games.reduce((sum, g) => sum + g.totalMilliseconds, 0);
  return formatPlaytime(totalMs);
}

export function ActivityGameSidebar({
  games,
  loading,
  onGameSelect,
  selectedGameId,
}: ActivityGameSidebarProps) {
  const { t } = useTranslation("activity");
  const [query, setQuery] = useState("");

  const filteredGames = useMemo(() => {
    if (!query.trim()) return games;
    const q = query.toLowerCase();
    return games.filter((g) => g.title.toLowerCase().includes(q));
  }, [games, query]);

  const maxMs =
    filteredGames.reduce((max, g) => Math.max(max, g.totalMilliseconds), 0) ||
    1;

  const totalPlaytime = useMemo(() => formatTotalPlaytime(games), [games]);

  return (
    <aside className="activity-game-sidebar">
      {/* ── Header ── */}
      <div className="activity-game-sidebar__header">
        <h3 className="activity-game-sidebar__title">
          <LayoutGrid size={14} />
          {t("games") || "Games"}
        </h3>
        {games.length > 0 && (
          <span className="activity-game-sidebar__count">{games.length}</span>
        )}
      </div>

      {/* ── Summary bar ── */}
      {!loading && games.length > 0 && (
        <div className="activity-game-sidebar__summary">
          <span className="activity-game-sidebar__summary-label">
            {t("total_playtime") || "Total"}
          </span>
          <span className="activity-game-sidebar__summary-value">
            {totalPlaytime}
          </span>
        </div>
      )}

      {/* ── Search ── */}
      {games.length > 0 && (
        <div className="activity-game-sidebar__search">
          <Search size={13} className="activity-game-sidebar__search-icon" />
          <input
            type="text"
            className="activity-game-sidebar__search-input"
            placeholder={t("search_games") || "Filter games..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {/* ── List ── */}
      <div className="activity-game-sidebar__list">
        {/* All Games option */}
        {!loading && games.length > 0 && (
          <button
            type="button"
            className={`activity-game-sidebar__item activity-game-sidebar__item--all ${
              selectedGameId === null
                ? "activity-game-sidebar__item--selected"
                : ""
            }`}
            onClick={() => onGameSelect("", "", "")}
          >
            <span className="activity-game-sidebar__all-icon">
              <LayoutGrid size={15} />
            </span>
            <div className="activity-game-sidebar__info">
              <span className="activity-game-sidebar__name">
                {t("all_games") || "All Games"}
              </span>
            </div>
            <span className="activity-game-sidebar__time">{games.length}</span>
          </button>
        )}

        {/* Loading state */}
        {loading && (
          <div className="activity-game-sidebar__empty">
            {t("loading") || "Loading..."}
          </div>
        )}

        {/* Empty state */}
        {!loading && games.length === 0 && (
          <div className="activity-game-sidebar__empty">
            {t("no_activity_yet") || "No activity yet"}
          </div>
        )}

        {/* Game items */}
        {!loading &&
          filteredGames.map((game) => {
            const barWidth =
              maxMs > 0 ? (game.totalMilliseconds / maxMs) * 100 : 0;

            return (
              <button
                key={`${game.shop}:${game.objectId}`}
                type="button"
                className={`activity-game-sidebar__item ${
                  selectedGameId === game.objectId
                    ? "activity-game-sidebar__item--selected"
                    : ""
                }`}
                onClick={() =>
                  onGameSelect(game.objectId, game.shop, game.title)
                }
              >
                {/* Game icon */}
                {game.iconUrl ? (
                  <img
                    className="activity-game-sidebar__icon"
                    src={game.iconUrl}
                    alt={game.title}
                    loading="lazy"
                  />
                ) : (
                  <span className="activity-game-sidebar__icon-placeholder" />
                )}

                {/* Title + Bar */}
                <div className="activity-game-sidebar__info">
                  <span className="activity-game-sidebar__name">
                    {game.title}
                  </span>
                  <div className="activity-game-sidebar__bar">
                    <div
                      className="activity-game-sidebar__bar-fill"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>

                {/* Playtime */}
                <span className="activity-game-sidebar__time">
                  {formatPlaytime(game.totalMilliseconds)}
                </span>
              </button>
            );
          })}

        {/* No results for search */}
        {!loading &&
          query &&
          filteredGames.length === 0 &&
          games.length > 0 && (
            <div className="activity-game-sidebar__empty">
              {t("no_results") || "No games found"}
            </div>
          )}
      </div>
    </aside>
  );
}
