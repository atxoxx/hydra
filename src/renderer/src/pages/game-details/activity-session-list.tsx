import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { GameSession } from "../../declaration";
import { ActivitySessionItem } from "./activity-session-item";
import "./activity-session-list.scss";

export interface ActivitySessionListProps {
  sessions: GameSession[];
  loading: boolean;
  onDelete?: () => void;
}

const MAX_VISIBLE_SESSIONS = 5;

export function ActivitySessionList({
  sessions,
  loading,
  onDelete,
}: Readonly<ActivitySessionListProps>) {
  const { t } = useTranslation("activity");
  const [showAll, setShowAll] = useState(false);

  if (loading) {
    return (
      <div className="activity-session-list">
        <h4 className="activity-session-list__title">{t("session_history")}</h4>
        <div className="activity-session-list__empty">{t("loading")}</div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="activity-session-list">
        <h4 className="activity-session-list__title">{t("session_history")}</h4>
        <div className="activity-session-list__empty">
          {t("no_sessions_yet")}
        </div>
      </div>
    );
  }

  const visibleSessions = showAll
    ? sessions
    : sessions.slice(0, MAX_VISIBLE_SESSIONS);
  const remaining = sessions.length - MAX_VISIBLE_SESSIONS;

  return (
    <div className="activity-session-list">
      <h4 className="activity-session-list__title">
        {t("session_history")}
        <span className="activity-session-list__count">{sessions.length}</span>
      </h4>

      <div className="activity-session-list__items">
        {visibleSessions.map((session) => (
          <ActivitySessionItem
            key={session.id}
            session={session}
            onDelete={onDelete}
          />
        ))}
      </div>

      {remaining > 0 && (
        <button
          type="button"
          className="activity-session-list__toggle-btn"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll
            ? t("show_less") || "Show Less"
            : `+${remaining} ${t("more_sessions")}`}
        </button>
      )}
    </div>
  );
}
