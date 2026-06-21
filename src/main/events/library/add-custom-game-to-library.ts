import { registerEvent } from "../register-event";
import { gamesSublevel, gamesShopAssetsSublevel, levelKeys } from "@main/level";
import { randomUUID } from "node:crypto";
import type { GameShop } from "@types";
import { seedSteamAppIdMapping } from "@main/services/steam-appid-mapping";
import { autoMatchGame } from "@main/services";
import { getGameAssets } from "../catalogue/get-game-assets";

const addCustomGameToLibrary = async (
  _event: Electron.IpcMainInvokeEvent,
  title: string,
  executablePath: string,
  iconUrl?: string,
  logoImageUrl?: string,
  libraryHeroImageUrl?: string,
  libraryImageUrl?: string,
  coverImageUrl?: string,
  linkedShop?: GameShop | null,
  linkedObjectId?: string | null
) => {
  const objectId = randomUUID();
  const shop: GameShop = "custom";
  const gameKey = levelKeys.game(shop, objectId);

  const existingGames = await gamesSublevel.iterator().all();
  const existingGame = existingGames.find(
    ([_key, game]) => game.executablePath === executablePath && !game.isDeleted
  );

  if (existingGame) {
    throw new Error(
      "A game with this executable path already exists in your library"
    );
  }

  let finalLinkedShop = linkedShop;
  let finalLinkedObjectId = linkedObjectId;
  let finalIconUrl = iconUrl;
  let finalLogoImageUrl = logoImageUrl;
  let finalLibraryHeroImageUrl = libraryHeroImageUrl;
  let finalLibraryImageUrl = libraryImageUrl;
  let finalCoverImageUrl = coverImageUrl;

  if (!finalLinkedShop || !finalLinkedObjectId) {
    const match = await autoMatchGame(title);
    if (match) {
      finalLinkedShop = match.shop;
      finalLinkedObjectId = match.objectId;

      try {
        const assets = await getGameAssets(
          finalLinkedObjectId,
          finalLinkedShop
        );
        if (assets) {
          finalIconUrl = finalIconUrl || assets.iconUrl || undefined;
          finalLibraryHeroImageUrl =
            finalLibraryHeroImageUrl || assets.libraryHeroImageUrl || undefined;
          finalLibraryImageUrl =
            finalLibraryImageUrl || assets.libraryImageUrl || undefined;
          finalLogoImageUrl =
            finalLogoImageUrl || assets.logoImageUrl || undefined;
          finalCoverImageUrl =
            finalCoverImageUrl || assets.coverImageUrl || undefined;
        }
      } catch (err) {
        // Ignore prefetch error
      }
    }
  }

  const assets = {
    updatedAt: Date.now(),
    objectId,
    shop,
    title,
    iconUrl: finalIconUrl || null,
    libraryHeroImageUrl: finalLibraryHeroImageUrl || "",
    libraryImageUrl: finalLibraryImageUrl || finalIconUrl || "",
    logoImageUrl: finalLogoImageUrl || "",
    logoPosition: null,
    coverImageUrl: finalCoverImageUrl || finalIconUrl || "",
    downloadSources: [],
  };
  await gamesShopAssetsSublevel.put(gameKey, assets);

  const game = {
    title,
    iconUrl: finalIconUrl || null,
    logoImageUrl: finalLogoImageUrl || null,
    libraryHeroImageUrl: finalLibraryHeroImageUrl || null,
    objectId,
    shop,
    remoteId: null,
    isDeleted: false,
    playTimeInMilliseconds: 0,
    lastTimePlayed: null,
    addedToLibraryAt: new Date(),
    executablePath,
    executablePathUpdatedAt: new Date(),
    launchOptions: null,
    linkedShop: finalLinkedShop ?? null,
    linkedObjectId: finalLinkedObjectId ?? null,
    favorite: false,
    automaticCloudSync: false,
    hasManuallyUpdatedPlaytime: false,
    acquisitionSource: "manual",
  };

  await gamesSublevel.put(gameKey, game);

  // Best-effort: pre-resolve a Steam AppID so reviews work the first time
  // the user opens the reviews tab. Fire-and-forget — network failures
  // must not roll back the custom-game add.
  void seedSteamAppIdMapping(shop, objectId, title);

  return game;
};

registerEvent("addCustomGameToLibrary", addCustomGameToLibrary);
