import { useEffect, useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { SessionWithGame } from "../../declaration";
import { ActivitySessionItem } from "../game-details/activity-session-item";
import { Search, RotateCcw } from "lucide-react";
import "./global-session-list.scss";

export function GlobalSessionList() {
  const { t } = useTranslation("activity");
  const [sessions, setSessions] = useState<SessionWithGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [limit, setLimit] = useState(20);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const all = await window.electron.getAllSessions();
      setSessions(all);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const query = searchQuery.toLowerCase();
    return sessions.filter((s) => s.gameTitle.toLowerCase().includes(query));
  }, [sessions, searchQuery]);

  const visibleSessions = useMemo(() => {
    return filteredSessions.slice(0, limit);
  }, [filteredSessions, limit]);

  const hasMore = filteredSessions.length > limit;

  if (loading && sessions.length === 0) {
    return (
      <div className="section-panel">
        <h3 className="section-panel__title">{t("recent_sessions")}</h3>
        <div className="section-panel__empty">{t("loading")}</div>
      </div>
    );
  }

  return (
    <div className="section-panel">
      <div className="global-session-list__header">
        <h3 className="section-panel__title">{t("recent_sessions")}</h3>
        <div className="global-session-list__actions">
          <div className="global-session-list__search">
            <Search size={14} className="global-session-list__search-icon" />
            <input
              type="text"
              placeholder={t("search_placeholder") || "Search game..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="global-session-list__search-input"
            />
          </div>
          <button
            type="button"
            className="global-session-list__refresh-btn"
            onClick={fetchSessions}
            title={t("refresh") || "Refresh"}
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {filteredSessions.length === 0 ? (
        <div className="section-panel__empty">
          {searchQuery
            ? t("no_results") || "No sessions found"
            : t("no_sessions_yet")}
        </div>
      ) : (
        <div className="global-session-list__items">
          {visibleSessions.map((session) => (
            <ActivitySessionItem
              key={session.id}
              session={session}
              onDelete={fetchSessions}
            />
          ))}

          {hasMore && (
            <button
              type="button"
              className="global-session-list__load-more"
              onClick={() => setLimit((prev) => prev + 20)}
            >
              {t("load_more") || "Load More"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
