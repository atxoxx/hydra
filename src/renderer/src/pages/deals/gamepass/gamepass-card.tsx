import type { GamePassGame } from "./gamepass-service";
import "./gamepass-card.scss";

interface GamePassCardProps {
  game: GamePassGame;
  onClick: () => void;
  onPlay: (e: React.MouseEvent) => void;
}

export function GamePassCard({ game, onClick, onPlay }: GamePassCardProps) {
  const coverUrl = game.coverImageUrl
    ? `${game.coverImageUrl}?mode=scale&q=90&h=300&w=200`
    : "";

  return (
    <div
      className="gamepass-card"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      title={game.name}
      aria-label={game.name}
    >
      <div className="gamepass-card__cover">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={game.name}
            className="gamepass-card__cover-image"
            loading="lazy"
          />
        ) : (
          <div className="gamepass-card__cover-placeholder">
            <span>{game.name.charAt(0).toUpperCase()}</span>
          </div>
        )}
        <button
          type="button"
          className="gamepass-card__play-button"
          onClick={onPlay}
          aria-label={`Play ${game.name} on Xbox`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M4 2.5v11l9-5.5z" />
          </svg>
        </button>
      </div>
      <div className="gamepass-card__info">
        <span className="gamepass-card__title">{game.name}</span>
        {game.categories.length > 0 && (
          <div className="gamepass-card__categories">
            {game.categories.slice(0, 2).map((cat) => (
              <span key={cat} className="gamepass-card__category-tag">
                {cat}
              </span>
            ))}
            {game.categories.length > 2 && (
              <span className="gamepass-card__category-more">
                +{game.categories.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
