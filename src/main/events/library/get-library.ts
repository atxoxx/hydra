import path from "node:path";
import fs from "node:fs";

import type { LibraryGame } from "@types";
import { registerEvent } from "../register-event";
import {
  downloadsSublevel,
  gameAchievementsSublevel,
  gamesShopAssetsSublevel,
  gamesShopCacheSublevel,
  gamesSublevel,
  levelKeys,
} from "@main/level";

const lookupCachedPlatform = async (
  gameKey: string
): Promise<string | null> => {
  const prefix = `${gameKey}:`;
  try {
    const entries = await gamesShopCacheSublevel.iterator().all();
    for (const [key, value] of entries) {
      if (
        typeof key === "string" &&
        key.startsWith(prefix) &&
        value?.platform
      ) {
        return value.platform;
      }
    }
  } catch {
    return null;
  }
  return null;
};

const getLibrary = async (): Promise<LibraryGame[]> => {
  return gamesSublevel
    .iterator()
    .all()
    .then((results) => {
      const migrationPuts: Promise<void>[] = [];

      return Promise.all(
        results
          .filter(([_key, game]) => game.isDeleted === false)
          .map(async ([key, game]) => {
            const download = await downloadsSublevel.get(key);
            let gameAssets = await gamesShopAssetsSublevel.get(key);
            if (game.shop === "custom" && game.linkedShop && game.linkedObjectId) {
              const linkedKey = levelKeys.game(game.linkedShop, game.linkedObjectId);
              const linkedAssets = await gamesShopAssetsSublevel.get(linkedKey).catch(() => null);
              if (linkedAssets) {
                gameAssets = {
                  ...linkedAssets,
                  ...gameAssets,
                  iconUrl: gameAssets?.iconUrl || linkedAssets.iconUrl,
                  libraryHeroImageUrl: gameAssets?.libraryHeroImageUrl || linkedAssets.libraryHeroImageUrl,
                  libraryImageUrl: gameAssets?.libraryImageUrl || linkedAssets.libraryImageUrl,
                  logoImageUrl: gameAssets?.logoImageUrl || linkedAssets.logoImageUrl,
                  coverImageUrl: gameAssets?.coverImageUrl || linkedAssets.coverImageUrl,
                };
              }
            }
            const achievements = await gameAchievementsSublevel
              .get(key)
              .catch(() => null);

            const validAchievementNames = new Set(
              achievements?.achievements?.map((a) =>
                (a.name ?? "").toUpperCase()
              ) || []
            );

            const unlockedAchievementCount =
              achievements?.unlockedAchievements?.filter(
                (unlocked) =>
                  validAchievementNames.has(
                    (unlocked.name ?? "").toUpperCase()
                  ) && unlocked.unlockTime > 0
              ).length ??
              game.unlockedAchievementCount ??
              0;

            // Verify installer still exists, clear if deleted externally
            let installerSizeInBytes = game.installerSizeInBytes;
            if (installerSizeInBytes && download?.folderName) {
              const installerPath = path.join(
                download.downloadPath,
                download.folderName
              );

              if (!fs.existsSync(installerPath)) {
                installerSizeInBytes = null;
                migrationPuts.push(
                  gamesSublevel
                    .put(key, { ...game, installerSizeInBytes: null })
                    .catch(() => {})
                );
              }
            }

            if (
              game.shop === "launchbox" &&
              (!game.platform || game.platform === null)
            ) {
              const cachedPlatform = await lookupCachedPlatform(key);
              if (cachedPlatform) {
                game.platform = cachedPlatform;
                migrationPuts.push(
                  gamesSublevel.put(key, game).catch(() => {})
                );
              }
            }

            // Verify installed folder still exists, clear if deleted externally
            let installedSizeInBytes = game.installedSizeInBytes;
            if (installedSizeInBytes && game.executablePath) {
              const executableDir = path.dirname(game.executablePath);

              if (!fs.existsSync(executableDir)) {
                installedSizeInBytes = null;
                migrationPuts.push(
                  gamesSublevel
                    .put(key, {
                      ...game,
                      installerSizeInBytes,
                      installedSizeInBytes: null,
                    })
                    .catch(() => {})
                );
              }
            }

            // Migration: populate acquisitionSource for existing games
            let acquisitionSource = game.acquisitionSource;
            if (!acquisitionSource) {
              if (game.shop === "launchbox") {
                acquisitionSource = "launchbox";
              } else if (game.shop === "custom") {
                acquisitionSource = "manual";
              } else if (download) {
                acquisitionSource = "hydra_catalogue";
              } else {
                acquisitionSource = "manual";
              }
              game.acquisitionSource = acquisitionSource;
              migrationPuts.push(gamesSublevel.put(key, game).catch(() => {}));
            }

            return {
              id: key,
              ...game,
              installerSizeInBytes,
              installedSizeInBytes,
              download: download ?? null,
              unlockedAchievementCount,
              achievementCount: game.achievementCount ?? 0,
              acquisitionSource,
              // Spread gameAssets last to ensure all image URLs are properly set
              ...gameAssets,
              // Preserve custom image URLs from game if they exist
              customIconUrl: game.customIconUrl,
              customLogoImageUrl: game.customLogoImageUrl,
              customHeroImageUrl: game.customHeroImageUrl,
            };
          })
      ).then((library) => {
        // Await all migration writes after the response is built
        Promise.allSettled(migrationPuts);
        return library;
      });
    });
};

registerEvent("getLibrary", getLibrary);
