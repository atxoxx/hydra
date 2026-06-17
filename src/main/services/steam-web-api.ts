import axios from "axios";
import { logger } from "./logger";

/** Response from IPlayerService/GetOwnedGames */
export interface SteamOwnedGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url: string;
  img_logo_url: string;
  playtime_windows_forever: number;
  playtime_mac_forever: number;
  playtime_linux_forever: number;
  rtime_last_played: number;
  has_community_visible_stats?: boolean;
  playtime_disconnected?: number;
}

interface GetOwnedGamesResponse {
  response: {
    game_count: number;
    games: SteamOwnedGame[];
  };
}

interface GetPlayerSummariesResponse {
  response: {
    players: Array<{
      steamid: string;
      personaname: string;
      avatar: string;
      avatarfull: string;
      avatarmedium: string;
      profileurl: string;
      personastate: number;
    }>;
  };
}

const STEAM_API_BASE = "https://api.steampowered.com";

export class SteamWebApi {
  /**
   * Fetches all owned games for a given SteamID64.
   * @param steamId64 - The 17-digit SteamID64
   * @param apiKey - Steam Web API key
   * @param includeFreeGames - Whether to include free games (default: true)
   */
  static async getOwnedGames(
    steamId64: string,
    apiKey: string,
    includeFreeGames = true
  ): Promise<SteamOwnedGame[]> {
    try {
      const response = await axios.get<GetOwnedGamesResponse>(
        `${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v0001/`,
        {
          params: {
            key: apiKey,
            steamid: steamId64,
            include_appinfo: 1,
            include_extended_appinfo: 1,
            include_played_free_games: includeFreeGames ? 1 : 0,
          },
          timeout: 15000,
        }
      );

      return response.data.response.games ?? [];
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(
        `[SteamAPI] Failed to fetch owned games for ${steamId64}: ${message}`
      );
      throw err;
    }
  }

  /**
   * Fetches owned games using an access_token (from BrowserWindow login)
   * instead of a Web API key.
   */
  static async getOwnedGamesWithToken(
    steamId64: string,
    accessToken: string,
    includeFreeGames = true
  ): Promise<SteamOwnedGame[]> {
    try {
      const response = await axios.get<GetOwnedGamesResponse>(
        `${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v0001/`,
        {
          params: {
            access_token: accessToken,
            steamid: steamId64,
            include_appinfo: 1,
            include_extended_appinfo: 1,
            include_played_free_games: includeFreeGames ? 1 : 0,
            include_free_sub: 1,
          },
          timeout: 15000,
        }
      );

      return response.data.response.games ?? [];
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(
        `[SteamAPI] Failed to fetch owned games with token for ${steamId64}: ${message}`
      );
      throw err;
    }
  }

  /**
   * Fetches player summaries for given SteamID64s.
   * Returns empty array for empty input; throws on API errors.
   */
  static async getPlayerSummaries(
    steamIds: string[],
    apiKey: string
  ): Promise<
    Array<{ steamid: string; personaname: string; avatarfull: string }>
  > {
    if (steamIds.length === 0) return [];

    const response = await axios.get<GetPlayerSummariesResponse>(
      `${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v0002/`,
      {
        params: {
          key: apiKey,
          steamids: steamIds.join(","),
        },
        timeout: 10000,
      }
    );

    return response.data.response.players.map((p) => ({
      steamid: p.steamid,
      personaname: p.personaname,
      avatarfull: p.avatarfull,
    }));
  }

  /**
   * Checks if a specific appId is owned by the user using their access token.
   * Calls GetOwnedGames with appids_filter for a lightweight single-game check.
   * Returns true if the game is in the user's Steam library.
   */
  static async checkGameOwnership(
    steamId64: string,
    accessToken: string,
    appId: number
  ): Promise<boolean> {
    try {
      const response = await axios.get<GetOwnedGamesResponse>(
        `${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v0001/`,
        {
          params: {
            access_token: accessToken,
            steamid: steamId64,
            include_appinfo: 0,
            include_extended_appinfo: 0,
            include_played_free_games: 1,
            appids_filter: [appId],
          },
          timeout: 10000,
        }
      );

      const games = response.data.response.games ?? [];
      return games.some((g) => g.appid === appId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(
        `[SteamAPI] Failed to check ownership for appId ${appId}: ${message}`
      );
      return false;
    }
  }

  /**
   * Fetches player summaries using an access_token (from BrowserWindow login).
   */
  static async getPlayerSummariesWithToken(
    steamIds: string[],
    accessToken: string
  ): Promise<
    Array<{ steamid: string; personaname: string; avatarfull: string }>
  > {
    if (steamIds.length === 0) return [];

    const response = await axios.get<GetPlayerSummariesResponse>(
      `${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v0002/`,
      {
        params: {
          access_token: accessToken,
          steamids: steamIds.join(","),
        },
        timeout: 10000,
      }
    );

    return response.data.response.players.map((p) => ({
      steamid: p.steamid,
      personaname: p.personaname,
      avatarfull: p.avatarfull,
    }));
  }
}
