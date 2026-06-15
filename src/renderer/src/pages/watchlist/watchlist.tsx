import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  ListUnorderedIcon,
  TrashIcon,
  PlusIcon,
  CheckIcon,
  QuestionIcon,
  PencilIcon,
  StarIcon,
} from "@primer/octicons-react";
import cn from "classnames";

import type { WatchlistEntry, WatchlistPriority } from "@types";

import { Button, SelectField, WatchlistModal } from "@renderer/components";
import { buildGameDetailsPath } from "@renderer/helpers";
import { useLibrary, useToast, useWatchlist } from "@renderer/hooks";

import "./watchlist.scss";

type WatchlistSort = "date-desc" | "date-asc" | "priority" | "title-asc" | "title-desc";

const SORT_OPTIONS: { key: string; value: WatchlistSort; label: string }[] = [
  { key: "date-desc", value: "date-desc", label: "Date added (newest)" },
  { key: "date-asc", value: "date-asc", label: "Date added (oldest)" },
  { key: "priority", value: "priority", label: "Priority" },
  { key: "title-asc", value: "title-asc", label: "Title (A-Z)" },
  { key: "title-desc", value: "title-desc", label: "Title (Z-A)" },
];

const PRIORITY_ORDER: Record<WatchlistPriority, number> = {
  "must-play": 0,
  want: 1,
  later: 2,
};

const PRIORITY_CONFIG: Record<
  WatchlistPriority,
  { label: string; className: string }
> = {
  "must-play": { label: "Must-play", className: "watchlist-page__priority-badge--must-play" },
  want: { label: "Want", className: "watchlist-page__priority-badge--want" },
  later: { label: "Later", className: "watchlist-page__priority-badge--later" },
};

export default function WatchlistPage() {
  const { t } = useTranslation("watchlist");
  const { showSuccessToast, showErrorToast, showWarningToast } = useToast();
  const {
    entries,
    isLoading,
    hasLoaded,
    loadWatchlist,
    removeFromWatchlist,
  } = useWatchlist();
  const { library, updateLibrary } = useLibrary();

  const [sort, setSort] = useState<WatchlistSort>("date-desc");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [editingGame, setEditingGame] = useState<WatchlistEntry | null>(null);

  // Track which games have new download sources since they were added
  const [gamesWithNewSources, setGamesWithNewSources] = useState<
    Set<string>
  >(new Set());
  const sourcesCheckRef = useRef(false);

  // Load watchlist on mount
  useEffect(() => {
    if (!hasLoaded) {
      loadWatchlist();
    }
  }, [hasLoaded, loadWatchlist]);

  // Fetch current download sources for all watchlist entries and compare with stored
  useEffect(() => {
    if (!hasLoaded || entries.length === 0 || sourcesCheckRef.current) return;

    sourcesCheckRef.current = true;

    const entriesToCheck = entries.map((e) => ({
      shop: e.shop,
      objectId: e.objectId,
      title: e.title,
    }));

    window.electron
      .getWatchlistGamesSources(entriesToCheck)
      .then((currentSourcesMap) => {
        const newSources = new Set<string>();

        for (const entry of entries) {
          const key = `${entry.shop}:${entry.objectId}`;
          const currentSources = currentSourcesMap[key] ?? [];
          const initialSources = entry.initialDownloadSources ?? [];

          // Check if there are any sources available now that weren't initially
          const hasNewSources =
            currentSources.length > 0 &&
            currentSources.some(
              (source) => !initialSources.includes(source)
            );

          if (hasNewSources) {
            newSources.add(key);
          }
        }

        setGamesWithNewSources(newSources);
      })
      .catch(() => {
        // Silently fail — badge just won't show
      });
  }, [hasLoaded, entries]);

  // Build a map of which games are in the library
  const libraryMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const game of library) {
      map.set(`${game.shop}:${game.objectId}`, true);
    }
    return map;
  }, [library]);

  const sortedEntries = useMemo(() => {
    const sorted = [...entries];
    switch (sort) {
      case "date-desc":
        sorted.sort(
          (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
        );
        break;
      case "date-asc":
        sorted.sort(
          (a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()
        );
        break;
      case "priority":
        sorted.sort(
          (a, b) =>
            PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
            a.title.localeCompare(b.title)
        );
        break;
      case "title-asc":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "title-desc":
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
    }
    return sorted;
  }, [entries, sort]);

  const handleRemove = useCallback(
    async (entry: WatchlistEntry) => {
      setRemovingId(`${entry.shop}:${entry.objectId}`);
      try {
        await removeFromWatchlist(entry.shop, entry.objectId);
        showSuccessToast(
          t("removed_from_watchlist", { title: entry.title, defaultValue: `Removed ${entry.title} from your watchlist` })
        );
      } catch {
        showErrorToast(t("failed_to_remove", { defaultValue: "Failed to remove from watchlist" }));
      } finally {
        setRemovingId(null);
      }
    },
    [removeFromWatchlist, showSuccessToast, showErrorToast, t]
  );

  const handleAddToLibrary = useCallback(
    async (entry: WatchlistEntry) => {
      if (libraryMap.has(`${entry.shop}:${entry.objectId}`)) {
        showWarningToast(t("already_in_library", { defaultValue: "This game is already in your library" }));
        return;
      }

      setAddingId(`${entry.shop}:${entry.objectId}`);
      try {
        await window.electron.addGameToLibrary(entry.shop, entry.objectId, entry.title, null);
        await updateLibrary();
        showSuccessToast(
          t("added_to_library", { title: entry.title, defaultValue: `Added ${entry.title} to your library` })
        );
      } catch {
        showErrorToast(t("failed_to_add_to_library", { defaultValue: "Failed to add to library" }));
      } finally {
        setAddingId(null);
      }
    },
    [libraryMap, updateLibrary, showSuccessToast, showErrorToast, showWarningToast, t]
  );

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  };

  if (isLoading && !hasLoaded) {
    return (
      <section className="watchlist-page">
        <div className="watchlist-page__loading">{t("loading", { defaultValue: "Loading..." })}</div>
      </section>
    );
  }

  return (
    <section className="watchlist-page">
      <header className="watchlist-page__header">
        <div className="watchlist-page__header-left">
          <h2 className="watchlist-page__title">
            <ListUnorderedIcon size={20} />
            {t("title", { defaultValue: "Watchlist" })}
          </h2>
          {entries.length > 0 && (
            <span className="watchlist-page__count">
              {t("count", { count: entries.length, defaultValue: `${entries.length} games` })}
            </span>
          )}
        </div>

        {entries.length > 0 && (
          <div className="watchlist-page__sort">
            <span className="watchlist-page__sort-label">
              {t("sort_by", { defaultValue: "Sort by" })}
            </span>
            <SelectField
              theme="dark"
              value={sort}
              options={SORT_OPTIONS}
              onChange={(event) => setSort(event.target.value as WatchlistSort)}
            />
          </div>
        )}
      </header>

      {entries.length === 0 ? (
        <div className="watchlist-page__empty">
          <div className="watchlist-page__empty-icon">
            <ListUnorderedIcon size={32} />
          </div>
          <h2>{t("empty_title", { defaultValue: "Your watchlist is empty" })}</h2>
          <p>
            {t("empty_description", {
              defaultValue: "Browse the catalogue to add games you want to play later.",
            })}
          </p>
          <Link to="/catalogue">
            <Button theme="primary">
              {t("browse_catalogue", { defaultValue: "Browse catalogue" })}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="watchlist-page__grid">
          {sortedEntries.map((entry) => {
            const entryId = `${entry.shop}:${entry.objectId}`;
            const isRemoving = removingId === entryId;
            const isAdding = addingId === entryId;
            const isInLibrary = libraryMap.has(entryId);
            const priorityCfg = PRIORITY_CONFIG[entry.priority];

            return (
              <article
                key={entryId}
                className={cn("watchlist-page__card", {
                  "watchlist-page__card--removing": isRemoving,
                })}
              >
                <div className="watchlist-page__card-cover">
                  {entry.libraryImageUrl ? (
                    <img
                      className="watchlist-page__card-cover-image"
                      src={entry.libraryImageUrl}
                      alt={entry.title}
                      loading="lazy"
                    />
                  ) : (
                    <div className="watchlist-page__card-cover-placeholder">
                      <QuestionIcon size={24} />
                    </div>
                  )}

                  {gamesWithNewSources.has(entryId) && (
                    <span className="watchlist-page__new-sources-badge">
                      <StarIcon size={10} />
                      {t("new_sources_badge", { defaultValue: "New sources" })}
                    </span>
                  )}

                  <span
                    className={cn(
                      "watchlist-page__priority-badge",
                      priorityCfg.className
                    )}
                  >
                    {priorityCfg.label}
                  </span>
                </div>

                <div className="watchlist-page__card-body">
                  <h3 className="watchlist-page__card-title" title={entry.title}>
                    {entry.title}
                  </h3>

                  <span className="watchlist-page__card-date">
                    {t("added_on", { defaultValue: "Added" })} {formatDate(entry.addedAt)}
                  </span>

                  {entry.notes && (
                    <p className="watchlist-page__card-notes">{entry.notes}</p>
                  )}
                </div>

                <div className="watchlist-page__card-actions">
                  <Link
                    to={buildGameDetailsPath({
                      shop: entry.shop,
                      objectId: entry.objectId,
                      title: entry.title,
                    })}
                    className="watchlist-page__card-details-link"
                  >
                    <Button theme="dark" disabled={isRemoving}>
                      {t("view_details", { defaultValue: "Details" })}
                    </Button>
                  </Link>

                  <Button
                    theme="dark"
                    disabled={isRemoving || isAdding}
                    onClick={() => setEditingGame(entry)}
                    tooltip={t("edit", { defaultValue: "Edit" })}
                  >
                    <PencilIcon size={14} />
                  </Button>

                  <Button
                    theme={isInLibrary ? "outline" : "primary"}
                    disabled={isAdding || isRemoving || isInLibrary}
                    onClick={() => handleAddToLibrary(entry)}
                    tooltip={
                      isInLibrary
                        ? t("already_in_library", { defaultValue: "Already in library" })
                        : t("add_to_library_btn", { defaultValue: "Add to library" })
                    }
                  >
                    {isAdding ? (
                      "…"
                    ) : isInLibrary ? (
                      <CheckIcon size={14} />
                    ) : (
                      <PlusIcon size={14} />
                    )}
                    {t("add_to_library_btn", { defaultValue: "Add to library" })}
                  </Button>

                  <Button
                    theme="danger"
                    disabled={isRemoving || isAdding}
                    onClick={() => handleRemove(entry)}
                    tooltip={t("remove_from_watchlist", { defaultValue: "Remove" })}
                  >
                    <TrashIcon size={14} />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editingGame && (
        <WatchlistModal
          visible={true}
          game={{
            id: `${editingGame.shop}:${editingGame.objectId}`,
            shop: editingGame.shop,
            objectId: editingGame.objectId,
            title: editingGame.title,
            libraryImageUrl: editingGame.libraryImageUrl,
            downloadSources: [],
            genres: [],
            releaseYear: null,
          }}
          onClose={() => setEditingGame(null)}
        />
      )}
    </section>
  );
}
