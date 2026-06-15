import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DealSourceProps } from "../deal-sources";
import {
  getGamePassGames,
  getCachedGamePassGames,
  loadRegion,
  saveRegion,
  getXboxDeepLink,
  getXboxStoreUrl,
  type GamePassGame,
} from "./gamepass-service";
import { GamePassFilters, type GamePassFilterState } from "./gamepass-filters";
import { GamePassCard } from "./gamepass-card";
import { GamePassDetailModal } from "./gamepass-detail-modal";
import "./gamepass-browser.scss";

export function GamePassBrowser(_props: DealSourceProps) {
  const { t } = useTranslation("deals");

  const [games, setGames] = useState<GamePassGame[]>(() => {
    return getCachedGamePassGames() ?? [];
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState<string>(loadRegion);
  const [filters, setFilters] = useState<GamePassFilterState>({
    search: "",
    categories: [],
    platforms: [],
    sort: "a-z",
  });
  const [selectedGame, setSelectedGame] = useState<GamePassGame | null>(null);

  const fetchGames = useCallback(
    async (regionCode: string) => {
      setLoading(true);
      setError(null);
      try {
        const gameList = await getGamePassGames(regionCode);
        setGames(gameList);
      } catch (err) {
        setError(t("could_not_load_catalog"));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    const cachedGames = getCachedGamePassGames();
    if (cachedGames && cachedGames.length > 0) {
      setGames(cachedGames);
      setLoading(false);
    } else {
      // Clear stale empty cache before fetching
      try {
        localStorage.removeItem("hydra_gamepass_cache");
      } catch {
        /* ignore */
      }
      fetchGames(loadRegion());
    }
  }, [fetchGames]);

  const handleRegionChange = useCallback(
    (newRegion: string) => {
      setRegion(newRegion);
      saveRegion(newRegion);
      fetchGames(newRegion);
    },
    [fetchGames]
  );

  const allCategories = useMemo(() => {
    const catSet = new Set<string>();
    for (const game of games) {
      for (const cat of game.categories) {
        catSet.add(cat);
      }
    }
    return Array.from(catSet).sort();
  }, [games]);

  const filteredGames = useMemo(() => {
    let result = [...games];

    // Search filter
    if (filters.search.trim()) {
      const query = filters.search.toLowerCase();
      result = result.filter(
        (g) =>
          g.name.toLowerCase().includes(query) ||
          g.developers.some((d) => d.toLowerCase().includes(query)) ||
          g.publishers.some((p) => p.toLowerCase().includes(query))
      );
    }

    // Category filter
    if (filters.categories.length > 0) {
      result = result.filter((g) =>
        filters.categories.some((cat) => g.categories.includes(cat))
      );
    }

    // Sort
    switch (filters.sort) {
      case "a-z":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "z-a":
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "release-date":
        result.sort((a, b) => {
          if (!a.releaseDate) return 1;
          if (!b.releaseDate) return -1;
          return (
            new Date(b.releaseDate).getTime() -
            new Date(a.releaseDate).getTime()
          );
        });
        break;
      case "recently-added":
        // No "added date" from the API, fall back to release date
        result.sort((a, b) => {
          if (!a.releaseDate) return 1;
          if (!b.releaseDate) return -1;
          return (
            new Date(b.releaseDate).getTime() -
            new Date(a.releaseDate).getTime()
          );
        });
        break;
    }

    return result;
  }, [games, filters]);

  const handlePlayOnXbox = useCallback(
    (productId: string, gameName: string) => {
      const deepLink = getXboxDeepLink(productId);
      try {
        // Use Electron's openExternal for proper protocol handling
        window.electron.openExternal(deepLink);
      } catch {
        // Protocol handler failed — fall back to Microsoft Store
        try {
          const storeUrl = getXboxStoreUrl(gameName);
          window.electron.openExternal(storeUrl);
        } catch {
          // Both failed silently
        }
      }
    },
    []
  );

  if (loading && games.length === 0) {
    return (
      <div className="gamepass-browser">
        <div className="gamepass-browser__loading">
          <div className="gamepass-browser__loading-spinner" />
          <p>{t("loading_catalog")}</p>
        </div>
      </div>
    );
  }

  if (error && games.length === 0) {
    return (
      <div className="gamepass-browser">
        <div className="gamepass-browser__error">
          <p>{error}</p>
          <button
            type="button"
            className="gamepass-browser__retry-button"
            onClick={() => fetchGames(region)}
          >
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="gamepass-browser">
      <GamePassFilters
        region={region}
        categories={allCategories}
        filters={filters}
        onRegionChange={handleRegionChange}
        onFiltersChange={setFilters}
        loading={loading}
      />

      {loading && (
        <div className="gamepass-browser__loading-overlay">
          <div className="gamepass-browser__loading-spinner" />
        </div>
      )}

      {filteredGames.length === 0 ? (
        <div className="gamepass-browser__empty">
          <p>{t("no_games_found")}</p>
          {(filters.search || filters.categories.length > 0) && (
            <button
              type="button"
              className="gamepass-browser__clear-filters-button"
              onClick={() =>
                setFilters({
                  search: "",
                  categories: [],
                  platforms: [],
                  sort: "a-z",
                })
              }
            >
              {t("clear_filters")}
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="gamepass-browser__count">
            {t("showing_games", { count: filteredGames.length })}
          </p>
          <div className="gamepass-browser__grid">
            {filteredGames.map((game) => (
              <GamePassCard
                key={game.productId}
                game={game}
                onClick={() => setSelectedGame(game)}
                onPlay={(e) => {
                  e.stopPropagation();
                  handlePlayOnXbox(game.productId, game.name);
                }}
              />
            ))}
          </div>
        </>
      )}

      {selectedGame && (
        <GamePassDetailModal
          game={selectedGame}
          onClose={() => setSelectedGame(null)}
          onPlay={() =>
            handlePlayOnXbox(selectedGame.productId, selectedGame.name)
          }
          getStoreUrl={getXboxStoreUrl}
        />
      )}
    </div>
  );
}
