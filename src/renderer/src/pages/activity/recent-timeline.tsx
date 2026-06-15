import { useTranslation } from "react-i18next";
import type { TopPlayedGame } from "./top-played-games";

export interface RecentTimelineProps {
  topGames: TopPlayedGame[];
  loading: boolean;
}

function formatPlaytime(ms: number): string {
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${Math.floor(hours)}h`;
}

export function RecentTimeline({ topGames, loading }: RecentTimelineProps) {
  const { t } = useTranslation("activity");

  if (loading) {
    return (
      <div className="section-panel">
        <h3 className="section-panel__title">{t("recently_played")}</h3>
        <div className="section-panel__empty">{t("loading")}</div>
      </div>
    );
  }

  const recent = topGames.slice(0, 8);

  if (recent.length === 0) {
    return (
      <div className="section-panel">
        <h3 className="section-panel__title">{t("recently_played")}</h3>
        <div className="section-panel__empty">{t("no_activity_yet")}</div>
      </div>
    );
  }

  return (
    <div className="section-panel">
      <h3 className="section-panel__title">{t("recently_played")}</h3>
      <div className="recent-timeline__list">
        {recent.map((game) => (
          <div
            key={`${game.shop}:${game.objectId}`}
            className="recent-timeline__item"
          >
            {game.iconUrl ? (
              <img
                className="recent-timeline__icon"
                src={game.iconUrl}
                alt={game.title}
              />
            ) : (
              <div className="recent-timeline__icon" />
            )}
            <span className="recent-timeline__name">{game.title}</span>
            <span className="recent-timeline__time">
              {formatPlaytime(game.totalMilliseconds)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
