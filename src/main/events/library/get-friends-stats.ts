import { registerEvent } from "../register-event";

export interface FriendPlaytimeStats {
  userId: string;
  displayName: string;
  profileImageUrl: string | null;
  totalPlaytimeHours: number;
  gamesPlayed: number;
}

// TODO: Implement friends stats via Hydra Cloud API when the endpoint is available.
// For now, returns an empty array. The spec (Section 4) calls for fetching friend
// stats from GET /profile/friends with includeStats parameter.
const getFriendsStats = async (): Promise<FriendPlaytimeStats[]> => {
  return [];
};

registerEvent("getFriendsStats", getFriendsStats);
