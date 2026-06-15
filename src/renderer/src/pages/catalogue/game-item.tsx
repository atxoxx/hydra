import { Badge, WatchlistModal } from "@renderer/components";
import { buildGameDetailsPath } from "@renderer/helpers";
import { useAppSelector, useLibrary, useWatchlist } from "@renderer/hooks";
import { lazy, Suspense, useMemo, useState, useEffect } from "react";
import { Link } from "@renderer/components/link/link";

import "./game-item.scss";
import { useTranslation } from "react-i18next";
import type { CatalogueSearchResult } from "@types";
import {
  QuestionIcon,
  PlusIcon,
  CheckIcon,
  ListUnorderedIcon,
} from "@primer/octicons-react";
import cn from "classnames";

const ProtonDBBadge = lazy(async () => {
  const mod = await import("./protondb-badge");
  return { default: mod.ProtonDBBadge };
});

export interface GameItemProps {
  game: CatalogueSearchResult;
}

export function GameItem({ game }: GameItemProps) {
  const { i18n, t } = useTranslation("game_details");

  const language = i18n.language.split("-")[0];

  const { steamGenres } = useAppSelector((state) => state.catalogueSearch);

  const [isAddingToLibrary, setIsAddingToLibrary] = useState(false);

  const [added, setAdded] = useState(false);
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);

  const { library, updateLibrary } = useLibrary();
  const { isGameWatchlisted, loadWatchlist, hasLoaded } =
    useWatchlist();
  const shouldShowProtonFeatures = window.electron.platform === "linux";

  const isWatchlisted = isGameWatchlisted(game.shop, game.objectId);

  // Load watchlist on first render
  useEffect(() => {
    if (!hasLoaded) {
      loadWatchlist();
    }
  }, [hasLoaded, loadWatchlist]);

  useEffect(() => {
    const exists = library.some(
      (libItem) =>
        libItem.shop === game.shop && libItem.objectId === game.objectId
    );
    setAdded(exists);
  }, [library, game.shop, game.objectId]);

  const addGameToLibrary = async () => {
    if (added || isAddingToLibrary) return;

    setIsAddingToLibrary(true);

    try {
      await window.electron.addGameToLibrary(
        game.shop,
        game.objectId,
        game.title,
        game.platform ?? null
      );
      updateLibrary();
    } catch (error) {
      console.error(error);
    } finally {
      setIsAddingToLibrary(false);
    }
  };

  const genres = useMemo(() => {
    return game.genres?.map((genre) => {
      const index = steamGenres["en"]?.findIndex(
        (steamGenre) => steamGenre === genre
      );

      if (
        index !== undefined &&
        steamGenres[language] &&
        steamGenres[language][index]
      ) {
        return steamGenres[language][index];
      }

      return genre;
    });
  }, [game.genres, language, steamGenres]);

  const libraryImage = useMemo(() => {
    if (game.libraryImageUrl) {
      return (
        <img
          className="game-item__cover"
          src={game.libraryImageUrl}
          alt={game.title}
          width={200}
          height={103}
          loading="lazy"
        />
      );
    }

    return (
      <div className="game-item__cover-placeholder">
        <QuestionIcon size={28} />
      </div>
    );
  }, [game.libraryImageUrl, game.title]);

  const rawProtonValue =
    game.tier ??
    game.bestReportedTier ??
    game.protondbSupportBadge ??
    game.protondbSupportBadges?.[0] ??
    null;
  const protonBadgeValue = rawProtonValue?.toLowerCase().trim() ?? null;
  const protonBadge =
    protonBadgeValue &&
    ["borked", "bronze", "silver", "gold", "platinum"].includes(
      protonBadgeValue
    )
      ? protonBadgeValue
      : null;

  return (
    <article className="game-item">
      <Link to={buildGameDetailsPath(game)} className="game-item__content-link">
        <div className="game-item__cover-wrapper">
          {libraryImage}

          {shouldShowProtonFeatures && protonBadge && (
            <Suspense fallback={null}>
              <ProtonDBBadge badge={protonBadge} />
            </Suspense>
          )}
        </div>

        <div className="game-item__details">
          <span>{game.title}</span>
          {genres && genres.length > 0 ? (
            <span className="game-item__genres">{genres.join(", ")}</span>
          ) : (
            <span className="game-item__genres game-item__genres--empty">
              {t("no_genres", { ns: "catalogue" })}
            </span>
          )}

          <div className="game-item__repackers">
            {game.downloadSources.map((sourceName) => (
              <Badge key={sourceName}>{sourceName}</Badge>
            ))}
          </div>
        </div>
      </Link>
      <button
        type="button"
        className={cn("game-item__plus-wrapper", {
          "game-item__plus-wrapper--added": added,
        })}
        onClick={addGameToLibrary}
        title={added ? t("already_in_library") : t("add_to_library")}
        aria-label={added ? t("already_in_library") : t("add_to_library")}
        disabled={added || isAddingToLibrary}
      >
        {added ? <CheckIcon size={16} /> : <PlusIcon size={16} />}
      </button>

      <button
        type="button"
        className={cn("game-item__watchlist-wrapper", {
          "game-item__watchlist-wrapper--watchlisted": isWatchlisted,
        })}
        onClick={() => {
          if (added) {
            return;
          }
          setShowWatchlistModal(true);
        }}
        title={
          added
            ? t("already_in_library")
            : isWatchlisted
              ? t("edit_watchlist", { ns: "watchlist" })
              : t("add_to_watchlist", { ns: "watchlist" })
        }
        aria-label={
          added
            ? t("already_in_library")
            : isWatchlisted
              ? t("edit_watchlist", { ns: "watchlist" })
              : t("add_to_watchlist", { ns: "watchlist" })
        }
        disabled={added}
      >
        <ListUnorderedIcon size={16} />
      </button>

      <WatchlistModal
        visible={showWatchlistModal}
        game={game}
        onClose={() => setShowWatchlistModal(false)}
      />
    </article>
  );
}
