import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Modal, Avatar } from "@renderer/components";
import type { FriendOwnershipEntry } from "@renderer/features/friend-game-ownership-slice";

import "./sidebar-friends-modal.scss";

export interface SidebarFriendsModalProps {
  visible: boolean;
  gameTitle: string;
  ownership: FriendOwnershipEntry | null;
  onClose: () => void;
}

export function SidebarFriendsModal({
  visible,
  gameTitle,
  ownership,
  onClose,
}: Readonly<SidebarFriendsModalProps>) {
  const navigate = useNavigate();
  const { t } = useTranslation("sidebar");

  const handleFriendClick = (friendId: string) => {
    onClose();
    navigate(`/profile/${friendId}`);
  };

  const friends = ownership?.friends ?? [];
  const onlineFriends = friends.filter((f) => f.isOnline);
  const offlineFriends = friends.filter((f) => !f.isOnline);

  return (
    <Modal
      visible={visible}
      title={t("friends_own_game", { title: gameTitle })}
      onClose={onClose}
    >
      <div className="sidebar-friends-modal">
        {friends.length === 0 ? (
          <p className="sidebar-friends-modal__empty">
            {t("no_friends_own_game")}
          </p>
        ) : (
          <>
            {onlineFriends.length > 0 && (
              <div className="sidebar-friends-modal__section">
                <h4 className="sidebar-friends-modal__section-title">
                  {t("friends_online")} ({onlineFriends.length})
                </h4>
                <ul className="sidebar-friends-modal__list">
                  {onlineFriends.map((friend) => (
                    <li key={friend.id}>
                      <button
                        type="button"
                        className="sidebar-friends-modal__friend"
                        onClick={() => handleFriendClick(friend.id)}
                      >
                        <Avatar
                          size={40}
                          src={friend.profileImageUrl}
                          alt={friend.displayName}
                        />
                        <div className="sidebar-friends-modal__friend-info">
                          <span className="sidebar-friends-modal__friend-name">
                            {friend.displayName}
                          </span>
                          <span className="sidebar-friends-modal__friend-status sidebar-friends-modal__friend-status--online">
                            {t("online")}
                          </span>
                        </div>
                        <span className="sidebar-friends-modal__status-orb sidebar-friends-modal__status-orb--online" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {offlineFriends.length > 0 && (
              <div className="sidebar-friends-modal__section">
                <h4 className="sidebar-friends-modal__section-title">
                  {t("friends_offline")} ({offlineFriends.length})
                </h4>
                <ul className="sidebar-friends-modal__list">
                  {offlineFriends.map((friend) => (
                    <li key={friend.id}>
                      <button
                        type="button"
                        className="sidebar-friends-modal__friend"
                        onClick={() => handleFriendClick(friend.id)}
                      >
                        <Avatar
                          size={40}
                          src={friend.profileImageUrl}
                          alt={friend.displayName}
                        />
                        <div className="sidebar-friends-modal__friend-info">
                          <span className="sidebar-friends-modal__friend-name">
                            {friend.displayName}
                          </span>
                          <span className="sidebar-friends-modal__friend-status">
                            {t("offline")}
                          </span>
                        </div>
                        <span className="sidebar-friends-modal__status-orb" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
