import { gamesSublevel, gamesShopAssetsSublevel, levelKeys } from "@main/level";
import { createGame } from "./library-sync";
import { AchievementWatcherManager } from "./achievements/achievement-watcher-manager";
import { scanEpicGames } from "./platform-scanners/epic-scanner";
import { scanGogGames } from "./platform-scanners/gog-scanner";
import { scanBattleNetGames } from "./platform-scanners/battlenet-scanner";
import { scanAmazonGames } from "./platform-scanners/amazon-scanner";
import { scanUbisoftGames } from "./platform-scanners/ubisoft-scanner";
import { scanXboxGames } from "./platform-scanners/xbox-scanner";
import { scanRockstarGames } from "./platform-scanners/rockstar-scanner";
import { scanItchIoGames } from "./platform-scanners/itchio-scanner";
import { scanHumbleGames } from "./platform-scanners/humble-scanner";
import type {
  Game,
  PlatformGame,
  AllPlatformsScanResult,
  GameShop,
} from "@types";
import { logger } from "./logger";
import { autoMatchGame } from "./metadata-search-aggregator";
import { getGameAssets } from "@main/events/catalogue/get-game-assets";
import { WindowManager } from "./window-manager";

export class PlatformScanner {
  /**
   * Runs all platform scanners and returns combined results.
   */
  static scanAll(): AllPlatformsScanResult {
    return {
      epic: scanEpicGames(),
      gog: scanGogGames(),
      "battle-net": scanBattleNetGames(),
      amazon: scanAmazonGames(),
      ubisoft: scanUbisoftGames(),
      xbox: scanXboxGames(),
      rockstar: scanRockstarGames(),
      "itch-io": scanItchIoGames(),
      humble: scanHumbleGames(),
    };
  }

  /**
   * Imports a single discovered platform game into the Hydra library.
   */
  static async importGame(game: PlatformGame): Promise<void> {
    const gameKey = levelKeys.game(game.shop, game.objectId);
    const existingGame = await gamesSublevel.get(gameKey).catch(() => null);

    let linkedShop: GameShop | null = existingGame?.linkedShop ?? null;
    let linkedObjectId: string | null = existingGame?.linkedObjectId ?? null;

    if (game.shop !== "steam" && game.shop !== "custom" && !linkedShop) {
      const match = await autoMatchGame(game.title);
      if (match) {
        linkedShop = match.shop;
        linkedObjectId = match.objectId;
      }
    }

    if (existingGame) {
      const updated: Game = {
        ...existingGame,
        title: game.title,
        objectId: game.objectId,
        shop: game.shop,
        isDeleted: false,
        source: game.shop,
        autoImported: true,
        acquisitionSource:
          existingGame.acquisitionSource ?? `${game.shop}_scan`,
        executablePath: game.executablePath ?? existingGame.executablePath,
        linkedShop,
        linkedObjectId,
      };

      await gamesSublevel.put(gameKey, updated);
    } else {
      const newGame: Game = {
        title: game.title,
        objectId: game.objectId,
        shop: game.shop,
        iconUrl: game.iconUrl,
        libraryHeroImageUrl: null,
        logoImageUrl: null,
        playTimeInMilliseconds: 0,
        lastTimePlayed: null,
        remoteId: null,
        isDeleted: false,
        source: game.shop,
        autoImported: true,
        acquisitionSource: `${game.shop}_scan`,
        executablePath: game.executablePath,
        linkedShop,
        linkedObjectId,
      };

      await gamesSublevel.put(gameKey, newGame);
    }

    if (linkedShop && linkedObjectId) {
      try {
        const assets = await getGameAssets(linkedObjectId, linkedShop);
        if (assets) {
          const existingAssets = await gamesShopAssetsSublevel
            .get(gameKey)
            .catch(() => null);
          const updatedAssets = {
            updatedAt: Date.now(),
            objectId: game.objectId,
            shop: game.shop,
            title: game.title,
            iconUrl: existingAssets?.iconUrl || assets.iconUrl || null,
            libraryHeroImageUrl:
              existingAssets?.libraryHeroImageUrl ||
              assets.libraryHeroImageUrl ||
              "",
            libraryImageUrl:
              existingAssets?.libraryImageUrl || assets.libraryImageUrl || "",
            logoImageUrl:
              existingAssets?.logoImageUrl || assets.logoImageUrl || "",
            logoPosition: existingAssets?.logoPosition || null,
            coverImageUrl:
              existingAssets?.coverImageUrl || assets.coverImageUrl || "",
            downloadSources: existingAssets?.downloadSources || [],
          };
          await gamesShopAssetsSublevel.put(gameKey, updatedAssets);
        }
      } catch (err) {
        logger.error(
          `[PlatformScanner] Failed to prefetch assets for synced game ${game.title}:`,
          err
        );
      }
    }

    const savedGame = await gamesSublevel.get(gameKey).catch(() => null);
    if (savedGame) {
      await createGame(savedGame).catch(() => {});
      AchievementWatcherManager.firstSyncWithRemoteIfNeeded(
        savedGame.shop,
        savedGame.objectId
      );
    }
  }

  /**
   * Scans the library for games added by other stores that lack Hydra catalogue links,
   * auto-matches them with the catalogue, and prefetches their assets.
   */
  static async autoMatchLibraryGames(): Promise<void> {
    try {
      const results = await gamesSublevel.iterator().all();
      let updatedAny = false;

      for (const [key, game] of results) {
        if (game.isDeleted) continue;
        // Match games from other stores (excluding steam/custom) that don't have a linked catalogue entry
        if (
          game.shop !== "steam" &&
          game.shop !== "custom" &&
          (!game.linkedShop || !game.linkedObjectId)
        ) {
          const match = await autoMatchGame(game.title);
          if (match) {
            game.linkedShop = match.shop;
            game.linkedObjectId = match.objectId;
            await gamesSublevel.put(key, game);
            updatedAny = true;

            // Prefetch assets
            try {
              const assets = await getGameAssets(match.objectId, match.shop);
              if (assets) {
                const existingAssets = await gamesShopAssetsSublevel
                  .get(key)
                  .catch(() => null);
                const updatedAssets = {
                  updatedAt: Date.now(),
                  objectId: game.objectId,
                  shop: game.shop,
                  title: game.title,
                  iconUrl: existingAssets?.iconUrl || assets.iconUrl || null,
                  libraryHeroImageUrl:
                    existingAssets?.libraryHeroImageUrl ||
                    assets.libraryHeroImageUrl ||
                    "",
                  libraryImageUrl:
                    existingAssets?.libraryImageUrl ||
                    assets.libraryImageUrl ||
                    "",
                  logoImageUrl:
                    existingAssets?.logoImageUrl || assets.logoImageUrl || "",
                  logoPosition: existingAssets?.logoPosition || null,
                  coverImageUrl:
                    existingAssets?.coverImageUrl || assets.coverImageUrl || "",
                  downloadSources: existingAssets?.downloadSources || [],
                };
                await gamesShopAssetsSublevel.put(key, updatedAssets);
              }
            } catch (err) {
              logger.error(
                `[PlatformScanner] Failed to prefetch assets for auto-linked game ${game.title}:`,
                err
              );
            }
          }
        }
      }

      if (updatedAny) {
        WindowManager.sendToAppWindows("on-library-batch-complete");
      }
    } catch (err) {
      logger.error("[PlatformScanner] autoMatchLibraryGames failed:", err);
    }
  }

  /**
   * Imports all games from a platform scan result.
   */
  static async importPlatformGames(
    games: PlatformGame[]
  ): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];

    for (const game of games) {
      try {
        await PlatformScanner.importGame(game);
        imported++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to import ${game.title}: ${message}`);
        logger.error(`[PlatformScanner] Import error: ${message}`);
      }
    }

    return { imported, errors };
  }
}
