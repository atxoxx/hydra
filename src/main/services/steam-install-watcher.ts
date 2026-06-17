import { findInstalledGame } from "./steam-family-scanner";
import { getSteamLibraryFolders } from "./steam-vdf-parser";
import { getSteamLocation } from "./steam";
import { gamesSublevel, levelKeys } from "@main/level";
import { logger } from "./logger";

/**
 * Tracks active ACF manifest watchers keyed by gameKey.
 * Each entry has an interval ID that can be cleared to stop polling.
 */
const activeWatchers = new Map<string, ReturnType<typeof setInterval>>();

/**
 * Maximum time to poll for install completion (1 hour).
 */
const MAX_WATCH_DURATION_MS = 60 * 60 * 1000;

/**
 * Polling interval in milliseconds.
 */
const POLL_INTERVAL_MS = 10_000;

/**
 * Starts polling ACF manifest files to detect when a Steam game
 * finishes installing. Once detected, updates the game's executablePath
 * in LevelDB and stops watching.
 *
 * @param appId - The Steam App ID being installed
 */
export function startSteamInstallWatcher(appId: string): void {
  const gameKey = levelKeys.game("steam", appId);

  // Don't start a second watcher for the same game
  if (activeWatchers.has(gameKey)) return;

  logger.info(`[SteamInstallWatcher] Starting watcher for app ${appId}`);

  const startedAt = Date.now();

  const intervalId = setInterval(async () => {
    try {
      // Check if we've exceeded the maximum watch duration
      if (Date.now() - startedAt > MAX_WATCH_DURATION_MS) {
        logger.info(
          `[SteamInstallWatcher] Timed out watching app ${appId}`
        );
        stopSteamInstallWatcher(appId);
        return;
      }

      // Get current Steam library folders
      const steamPath = await getSteamLocation().catch(() => null);
      if (!steamPath) return;

      const libraryFolders = getSteamLibraryFolders(steamPath).map(
        (f) => f.path
      );

      // Check if the game is now installed
      const result = findInstalledGame(libraryFolders, Number(appId));

      if (result.installed && result.exePath) {
        logger.info(
          `[SteamInstallWatcher] Game ${appId} installed at ${result.exePath}`
        );

        // Update the game's executable path in LevelDB
        const game = await gamesSublevel.get(gameKey).catch(() => null);
        if (game) {
          await gamesSublevel.put(gameKey, {
            ...game,
            executablePath: result.exePath,
            isDeleted: false,
          });
        }

        stopSteamInstallWatcher(appId);
      }
    } catch (err) {
      logger.error(
        "[SteamInstallWatcher] Error polling:",
        err instanceof Error ? err.message : String(err)
      );
    }
  }, POLL_INTERVAL_MS);

  activeWatchers.set(gameKey, intervalId);
}

/**
 * Stops polling for install completion for a given app ID.
 */
export function stopSteamInstallWatcher(appId: string): void {
  const gameKey = levelKeys.game("steam", appId);
  const intervalId = activeWatchers.get(gameKey);

  if (intervalId) {
    clearInterval(intervalId);
    activeWatchers.delete(gameKey);
    logger.info(`[SteamInstallWatcher] Stopped watcher for app ${appId}`);
  }
}
