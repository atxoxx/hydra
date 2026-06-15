import { useTranslation } from "react-i18next";
import cn from "classnames";

export interface TopPlayedGame {
  objectId: string;
  shop: string;
  title: string;
  iconUrl: string | null;
  totalMilliseconds: number;
}

export interface TopPlayedGamesProps {
  games: TopPlayedGame[];
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

export function TopPlayedGames({
  games,
  loading,
  onGameSelect,
  selectedGameId,
}: TopPlayedGamesProps) {
  const { t } = useTranslation("activity");

  const maxMs = games.length > 0 ? games[0].totalMilliseconds : 1;

  return (
    <div className="section-panel">
      <h3 className="section-panel__title">{t("top_played_games")}</h3>

      {loading && (
        <div className="section-panel__empty">{t("loading")}</div>
      )}

      {!loading && games.length === 0 && (
        <div className="section-panel__empty">{t("no_activity_yet")}</div>
      )}

      {!loading && games.length > 0 && (
        <div className="top-played-games__list">
          {games.map((game, index) => (
            <button
              key={`${game.shop}:${game.objectId}`}
              type="button"
              className={cn("top-played-games__item", {
                "top-played-games__item--selected":
                  selectedGameId === game.objectId,
              })}
              onClick={() =>
                onGameSelect(game.objectId, game.shop, game.title)
              }
            >
              <span className="top-played-games__rank">{index + 1}</span>
              {game.iconUrl && (
                <img
                  className="top-played-games__icon"
                  src={game.iconUrl}
                  alt={game.title}
                />
              )}
              <div className="top-played-games__info">
                <span className="top-played-games__name">{game.title}</span>
                <div className="top-played-games__bar">
                  <div
                    className="top-played-games__bar-fill"
                    style={{
                      width: `${(game.totalMilliseconds / maxMs) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <span className="top-played-games__time">
                {formatPlaytime(game.totalMilliseconds)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
