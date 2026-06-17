import { SteamWebApi } from "./steam-web-api";
import { findInstalledGame } from "./steam-family-scanner";
import { getSteamLocation } from "./steam";
import { getSteamLibraryFolders } from "./steam-vdf-parser";
import { createGame } from "./library-sync";
import { AchievementWatcherManager } from "./achievements/achievement-watcher-manager";
import { gamesPlaytime } from "./process-watcher";
import { db, gamesSublevel, levelKeys } from "@main/level";
import { logger } from "./logger";
import type { Game, UserPreferences } from "@types";

export interface SteamSyncResult {
  imported: number;
  updated: number;
  errors: string[];
  playtimeSynced: number;
}

export class SteamGameSync {
  /**
   * Full sync: fetches owned games, checks install status,
   * imports to library, and syncs playtime (Steam is master).
   * Skips playtime updates for games currently being played.
   *
   * @param accessToken - Steam web API access token from BrowserWindow login
   * @param steamId64 - SteamID64 of the logged-in user
   */
  static async syncAll(
    accessToken: string,
    steamId64: string
  ): Promise<SteamSyncResult> {
    const result: SteamSyncResult = {
      imported: 0,
      updated: 0,
      errors: [],
      playtimeSynced: 0,
    };

    // 1. Fetch owned games from Steam Web API
    const ownedGames = await SteamWebApi.getOwnedGamesWithToken(
      steamId64,
      accessToken
    );

    logger.info(
      `[SteamSync] Fetched ${ownedGames.length} owned games for ${steamId64}`
    );

    // 2. Get library folders for install detection
    const libraryFolders = await getSteamLibraryFoldersViaLocation();

    // 3. Process each game
    for (const apiGame of ownedGames) {
      try {
        const appId = apiGame.appid;
        const objectId = String(appId);
        const shop = "steam";
        const gameKey = levelKeys.game(shop, objectId);

        // Check if game is currently being played — skip playtime update if so
        const isRunning = gamesPlaytime.has(gameKey);

        // Check install status
        const installResult = findInstalledGame(libraryFolders, appId);
        const iconUrl = apiGame.img_icon_url
          ? `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${appId}/${apiGame.img_icon_url}.jpg`
          : null;

        // Steam playtime in milliseconds (API returns minutes)
        const steamPlaytimeMs = apiGame.playtime_forever * 60 * 1000;
        const steamLastPlayed =
          apiGame.rtime_last_played > 0
            ? new Date(apiGame.rtime_last_played * 1000)
            : null;

        const existingGame = await gamesSublevel.get(gameKey);

        if (existingGame) {
          // Update existing game — Steam playtime is master,
          // but skip playtime update if the game is currently running
          const playTime = isRunning
            ? existingGame.playTimeInMilliseconds
            : steamPlaytimeMs;

          const updated: Game = {
            ...existingGame,
            title: apiGame.name,
            objectId,
            shop,
            iconUrl: iconUrl ?? existingGame.iconUrl,
            playTimeInMilliseconds: playTime,
            lastTimePlayed:
              steamLastPlayed &&
              (!existingGame.lastTimePlayed ||
                steamLastPlayed > existingGame.lastTimePlayed)
                ? steamLastPlayed
                : existingGame.lastTimePlayed,
            unsyncedDeltaPlayTimeInMilliseconds: 0,
            isDeleted: false,
            source: "steam",
            autoImported: true,
            acquisitionSource: existingGame.acquisitionSource ?? "steam_scan",
            executablePath: installResult.installed
              ? (installResult.exePath ?? existingGame.executablePath)
              : existingGame.executablePath,
          };

          await gamesSublevel.put(gameKey, updated);
          result.updated++;
          if (!isRunning) result.playtimeSynced++;
        } else {
          // New game — create fresh entry
          const newGame: Game = {
            title: apiGame.name,
            objectId,
            shop,
            iconUrl,
            libraryHeroImageUrl: null,
            logoImageUrl: null,
            playTimeInMilliseconds: steamPlaytimeMs,
            lastTimePlayed: steamLastPlayed,
            remoteId: null,
            isDeleted: false,
            source: "steam",
            autoImported: true,
            acquisitionSource: "steam_scan",
            executablePath: installResult.installed
              ? installResult.exePath
              : null,
          };

          await gamesSublevel.put(gameKey, newGame);
          result.imported++;
          if (steamPlaytimeMs > 0) result.playtimeSynced++;
        }

        // Sync to Hydra API if not a custom game
        const savedGame = await gamesSublevel.get(gameKey);
        if (savedGame) {
          await createGame(savedGame).catch(() => {});
          AchievementWatcherManager.firstSyncWithRemoteIfNeeded(
            savedGame.shop,
            savedGame.objectId
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(`Failed to sync ${apiGame.name}: ${message}`);
        logger.error(`[SteamSync] ${result.errors[result.errors.length - 1]}`);
      }
    }

    // 4. Update the last sync timestamp
    try {
      const userPreferences = await db
        .get<string, UserPreferences | null>(levelKeys.userPreferences, {
          valueEncoding: "json",
        })
        .catch(() => null);

      if (userPreferences) {
        await db.put<string, UserPreferences>(
          levelKeys.userPreferences,
          {
            ...userPreferences,
            steamLastSyncAt: new Date().toISOString(),
          },
          { valueEncoding: "json" }
        );
      }
    } catch (err) {
      logger.error("[SteamSync] Failed to update last sync timestamp", err);
    }

    logger.info(
      `[SteamSync] Complete — imported: ${result.imported}, updated: ${result.updated}, playtime synced: ${result.playtimeSynced}, errors: ${result.errors.length}`
    );

    return result;
  }

  /**
   * Reads stored credentials and runs auto-sync if available.
   * Intended to be called on app startup. Swallows errors silently.
   */
  static async autoSyncIfLoggedIn(): Promise<void> {
    try {
      const userPreferences = await db
        .get<string, UserPreferences | null>(levelKeys.userPreferences, {
          valueEncoding: "json",
        })
        .catch(() => null);

      const accessToken = userPreferences?.steamLoginAccessToken;
      const steamId64 = userPreferences?.steamLoginUserId;

      if (!accessToken || !steamId64) {
        return;
      }

      logger.info("[SteamSync] Running auto-sync on startup…");
      await SteamGameSync.syncAll(accessToken, steamId64);
    } catch (err) {
      logger.warn(
        "[SteamSync] Auto-sync failed:",
        err instanceof Error ? err.message : String(err)
      );
    }
  }
}

/**
 * Gets Steam library folder paths for install detection.
 */
async function getSteamLibraryFoldersViaLocation(): Promise<string[]> {
  try {
    const steamPath = await getSteamLocation();
    return getSteamLibraryFolders(steamPath).map((f) => f.path);
  } catch {
    return [];
  }
}
