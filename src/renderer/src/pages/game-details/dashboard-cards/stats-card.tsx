import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { DownloadIcon, PeopleIcon, StarIcon } from "@primer/octicons-react";
import { StarRating } from "@renderer/components/star-rating/star-rating";
import { GameStatusDropdown } from "@renderer/components";
import { gameDetailsContext } from "@renderer/context";
import { useFormat, useToast } from "@renderer/hooks";
import type { UserGameStatus } from "@types";

import "./dashboard-card.scss";
import "./stats-card.scss";

export function StatsCard() {
  const { t } = useTranslation("game_details");
  const { stats, game, shop, objectId, updateGame } =
    useContext(gameDetailsContext);
  const { numberFormatter } = useFormat();
  const { showSuccessToast, showErrorToast } = useToast();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Normalize legacy "to_play" from existing LevelDB data
  const rawStatus = game?.userStatus;
  const currentStatus: UserGameStatus =
    String(rawStatus) === "to_play" ? "plan_to_play" : (rawStatus ?? "none");

  const handleStatusChange = async (status: UserGameStatus) => {
    if (!shop || !objectId || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    try {
      const result = await window.electron.setGameUserStatus(
        shop,
        objectId,
        status
      );
      if (result.ok) {
        showSuccessToast(
          t(status === "none" ? "status_cleared" : "status_updated")
        );
        await updateGame();
      } else {
        showErrorToast(result.error || t("status_update_failed"));
      }
    } catch {
      showErrorToast(t("status_update_failed"));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (!stats && !game) return null;

  return (
    <div className="dashboard-card stats-card">
      <div className="dashboard-card__header">
        <span className="dashboard-card__header-icon">
          <StarIcon size={16} />
        </span>
        <h3 className="dashboard-card__header-title">{t("stats")}</h3>
      </div>

      <div className="dashboard-card__body">
        {game && (
          <div className="stats-card__status-row">
            <GameStatusDropdown
              value={currentStatus}
              onChange={handleStatusChange}
              disabled={isUpdatingStatus}
            />
          </div>
        )}

        <div className="stats-card__list">
          {stats && (
            <>
              <div className="stats-card__item">
                <span className="stats-card__item-label">
                  <DownloadIcon size={16} />
                  {t("download_count")}
                </span>
                <span className="stats-card__item-value">
                  {numberFormatter.format(stats.downloadCount)}
                </span>
              </div>

              <div className="stats-card__item">
                <span className="stats-card__item-label">
                  <PeopleIcon size={16} />
                  {t("player_count")}
                </span>
                <span className="stats-card__item-value">
                  {numberFormatter.format(stats.playerCount)}
                </span>
              </div>

              <div className="stats-card__item">
                <span className="stats-card__item-label">
                  <StarIcon size={16} />
                  {t("rating_count")}
                </span>
                <span className="stats-card__item-value">
                  <StarRating
                    rating={
                      stats.averageScore === 0
                        ? null
                        : (stats.averageScore ?? null)
                    }
                    size={16}
                  />
                </span>
              </div>
            </>
          )}

          {game?.playTimeInMilliseconds !== undefined && (
            <div className="stats-card__item">
              <span className="stats-card__item-label">
                <PlayTimeIcon />
                {t("play_time_short")}
              </span>
              <span className="stats-card__item-value">
                {formatPlaytime(game.playTimeInMilliseconds ?? 0, t)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayTimeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z" />
    </svg>
  );
}

function formatPlaytime(
  ms: number,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  const minutes = ms / 60000;
  if (minutes < 60) {
    return t("amount_minutes", { amount: minutes.toFixed(0) });
  }
  const hours = minutes / 60;
  return t("amount_hours", {
    amount: Math.round(hours * 10) / 10,
  });
}
