import { useTranslation } from "react-i18next";
import { XIcon } from "@primer/octicons-react";
import type { GamePassGame } from "./gamepass-service";
import "./gamepass-detail-modal.scss";

interface GamePassDetailModalProps {
  game: GamePassGame;
  onClose: () => void;
  onPlay: () => void;
  getStoreUrl: (gameName: string) => string;
}

export function GamePassDetailModal({
  game,
  onClose,
  onPlay,
  getStoreUrl,
}: GamePassDetailModalProps) {
  const { t } = useTranslation("deals");

  const releaseDate = game.releaseDate
    ? new Date(game.releaseDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="gamepass-detail-backdrop" onClick={onClose}>
      <div
        className="gamepass-detail-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={game.name}
      >
        <button
          type="button"
          className="gamepass-detail-modal__close"
          onClick={onClose}
          aria-label={t("close")}
        >
          <XIcon size={18} />
        </button>

        <div className="gamepass-detail-modal__hero">
          {game.backgroundImageUrl ? (
            <img
              src={`${game.backgroundImageUrl}?mode=scale&q=90&h=400&w=800`}
              alt=""
              className="gamepass-detail-modal__hero-image"
            />
          ) : (
            <div className="gamepass-detail-modal__hero-placeholder" />
          )}
        </div>

        <div className="gamepass-detail-modal__body">
          <div className="gamepass-detail-modal__header">
            <div className="gamepass-detail-modal__title-row">
              <h2 className="gamepass-detail-modal__title">{game.name}</h2>
            </div>

            {(game.developers.length > 0 || game.publishers.length > 0) && (
              <div className="gamepass-detail-modal__meta-row">
                {game.developers.length > 0 && (
                  <span className="gamepass-detail-modal__meta">
                    {game.developers.join(", ")}
                  </span>
                )}
                {game.publishers.length > 0 && (
                  <span className="gamepass-detail-modal__meta">
                    {game.publishers.join(", ")}
                  </span>
                )}
                {game.categories.length > 0 && (
                  <span className="gamepass-detail-modal__meta">
                    {game.categories.join(", ")}
                  </span>
                )}
              </div>
            )}
          </div>

          {game.description && (
            <div className="gamepass-detail-modal__description">
              <p>{game.description}</p>
            </div>
          )}

          {releaseDate && (
            <div className="gamepass-detail-modal__detail">
              <span className="gamepass-detail-modal__detail-label">
                {t("release_date")}:
              </span>
              <span className="gamepass-detail-modal__detail-value">
                {releaseDate}
              </span>
            </div>
          )}

          <div className="gamepass-detail-modal__actions">
            <button
              type="button"
              className="gamepass-detail-modal__play-button"
              onClick={onPlay}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M4 2.5v11l9-5.5z" />
              </svg>
              {t("play_on_xbox")}
            </button>

            <a
              href={getStoreUrl(game.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="gamepass-detail-modal__store-link"
            >
              {t("view_on_microsoft_store")}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
