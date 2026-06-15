import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { DependabotIcon } from "@primer/octicons-react";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import type { GameShop, Steam250Game } from "@types";
import { buildGameDetailsPath } from "@renderer/helpers";
import { Button } from "@renderer/components";
import starsIconAnimated from "@renderer/assets/icons/stars-animated.gif";
import "./similar-games.scss";

export interface SimilarGame {
  objectId: string;
  shop: GameShop;
  title: string;
  coverImage: string | null;
}

export interface SimilarGamesProps {
  shop: GameShop;
  objectId: string;
}

export function SimilarGames({ shop, objectId }: Readonly<SimilarGamesProps>) {
  const { t } = useTranslation("game_details");
  const navigate = useNavigate();
  const [games, setGames] = useState<SimilarGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [randomGame, setRandomGame] = useState<Steam250Game | null>(null);
  const [randomizerLocked, setRandomizerLocked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchSimilar = async () => {
      setIsLoading(true);
      try {
        const data = await window.electron.hydraApi.get<SimilarGame[]>(
          `/games/${shop}/${objectId}/similar`,
          { needsAuth: false }
        );
        if (!cancelled) {
          setGames(data);
        }
      } catch {
        if (!cancelled) {
          setGames([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchSimilar();
    return () => {
      cancelled = true;
    };
  }, [shop, objectId]);

  // Fetch random game for the randomizer
  useEffect(() => {
    setRandomGame(null);
    window.electron.getRandomGame().then((rg) => {
      setRandomGame(rg);
    });
  }, [objectId]);

  const handleGameClick = (game: SimilarGame) => {
    navigate(buildGameDetailsPath({ ...game, shop: game.shop }));
  };

  const handleRandomizerClick = useCallback(() => {
    if (randomGame) {
      navigate(
        buildGameDetailsPath(
          { ...randomGame, shop: "steam" },
          { fromRandomizer: "1" }
        )
      );

      setRandomizerLocked(true);

      const zero = performance.now();

      requestAnimationFrame(function animateLock(time) {
        if (time - zero <= 1000) {
          requestAnimationFrame(animateLock);
        } else {
          setRandomizerLocked(false);
        }
      });
    }
  }, [randomGame, navigate]);

  const getImageUrl = (game: SimilarGame): string | null => {
    return game.coverImage ?? null;
  };

  return (
    <SkeletonTheme baseColor="#1c1c1c" highlightColor="#444">
      <section className="similar-games">
        <div className="similar-games__header">
          <h3 className="similar-games__title">
            <DependabotIcon size={16} />
            {t("similar_games")}
          </h3>

          <Button
            className="similar-games__randomizer-button"
            onClick={handleRandomizerClick}
            theme="outline"
            disabled={!randomGame || randomizerLocked}
          >
            <div className="similar-games__stars-icon-container">
              <img
                src={starsIconAnimated}
                alt=""
                className="similar-games__stars-icon"
              />
            </div>
            {t("next_suggestion")}
          </Button>
        </div>

        <div className="similar-games__scroll-area">
          {isLoading
            ? Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="similar-games__skeleton" />
              ))
            : games.map((game) => {
                const imageUrl = getImageUrl(game);
                return (
                  <button
                    key={`${game.shop}:${game.objectId}`}
                    type="button"
                    className="similar-games__card"
                    onClick={() => handleGameClick(game)}
                    title={game.title}
                  >
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={game.title}
                        className="similar-games__card-image"
                        loading="lazy"
                      />
                    ) : (
                      <div className="similar-games__card-image-placeholder">
                        <DependabotIcon size={32} />
                      </div>
                    )}
                    <span className="similar-games__card-title">
                      {game.title}
                    </span>
                  </button>
                );
              })}

          {!isLoading && games.length === 0 && (
            <p className="similar-games__empty">{t("no_similar_games")}</p>
          )}
        </div>
      </section>
    </SkeletonTheme>
  );
}
