import { useTranslation } from "react-i18next";
import type { FriendPlaytimeStats } from "../../declaration";

export interface FriendsComparisonProps {
  friendsStats: FriendPlaytimeStats[];
  isSignedIn: boolean;
  loading: boolean;
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function FriendsComparison({
  friendsStats,
  isSignedIn,
  loading,
}: FriendsComparisonProps) {
  const { t } = useTranslation("activity");

  if (loading) {
    return (
      <div className="section-panel">
        <h3 className="section-panel__title">{t("friends_comparison")}</h3>
        <div className="section-panel__empty">{t("loading")}</div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="section-panel">
        <h3 className="section-panel__title">{t("friends_comparison")}</h3>
        <div className="friends-comparison__sign-in">
          {t("sign_in_to_compare", { ns: "activity" })}
        </div>
      </div>
    );
  }

  return (
    <div className="section-panel">
      <h3 className="section-panel__title">{t("friends_comparison")}</h3>
      {friendsStats.length === 0 ? (
        <div className="friends-comparison__sign-in">
          {t("no_friends_data", { ns: "activity" })}
        </div>
      ) : (
        <div className="friends-comparison__list">
          {friendsStats.map((friend) => (
            <div key={friend.userId} className="friends-comparison__item">
              {friend.profileImageUrl ? (
                <img
                  className="friends-comparison__avatar"
                  src={friend.profileImageUrl}
                  alt={friend.displayName}
                />
              ) : (
                <div className="friends-comparison__avatar" />
              )}
              <span className="friends-comparison__name">
                {friend.displayName}
              </span>
              <span className="friends-comparison__stat">
                {formatHours(friend.totalPlaytimeHours)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
