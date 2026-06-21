import { getSteamAppDetails, HydraApi, logger, autoMatchGame, WindowManager } from "@main/services";
import { getGameAssets } from "./get-game-assets";


import type {
  ShopDetails,
  GameShop,
  ShopAssets,
  ShopDetailsWithAssets,
} from "@types";

import { registerEvent } from "../register-event";
import {
  gamesSublevel,
  gamesShopAssetsSublevel,
  gamesShopCacheSublevel,
  levelKeys,
} from "@main/level";

interface LaunchboxBasic {
  objectId: string;
  title: string;
  iconUrl: string | null;
  libraryHeroImageUrl: string | null;
  libraryImageUrl: string | null;
  logoImageUrl: string | null;
  logoPosition: string | null;
  coverImageUrl: string | null;
  releaseDate: string | null;
  releaseYear: number | null;
}

interface LaunchboxShopDetailsAssets {
  objectId: string;
  shop: GameShop;
  title: string;
  iconUrl: string | null;
  libraryHeroImageUrl: string | null;
  libraryImageUrl: string | null;
  logoImageUrl: string | null;
}

interface LaunchboxShopDetailsData {
  title: string;
  platform?: string | null;
  description: string | null;
  releaseDate: string | null;
  developers: string[];
  publishers: string[];
  genres: string[];
  headerImage: string | null;
  website: string | null;
  screenshots: string[];
  assets: LaunchboxShopDetailsAssets | null;
}

interface LaunchboxShopDetailsEntry {
  objectId: string;
  shop: GameShop;
  platform?: string | null;
  skus?: string[];
  data: LaunchboxShopDetailsData;
}

const mapLaunchboxToShopDetails = (
  objectId: string,
  basic: LaunchboxBasic | null,
  entry: LaunchboxShopDetailsEntry | null
): ShopDetails => {
  const data = entry?.data ?? null;
  const description = data?.description ?? "";

  return {
    objectId,
    name: data?.title ?? basic?.title ?? "",
    platform: entry?.platform ?? data?.platform ?? undefined,
    skus: entry?.skus ?? undefined,
    steam_appid: 0,
    detailed_description: description,
    about_the_game: description,
    short_description: "",
    developers: data?.developers ?? [],
    publishers: data?.publishers ?? [],
    genres: (data?.genres ?? []).map((name, index) => ({
      id: String(index),
      name,
    })),
    movies: undefined,
    supported_languages: "",
    screenshots: (data?.screenshots ?? []).map((url, index) => ({
      id: index,
      path_thumbnail: url,
      path_full: url,
    })),
    pc_requirements: { minimum: "", recommended: "" },
    mac_requirements: { minimum: "", recommended: "" },
    linux_requirements: { minimum: "", recommended: "" },
    release_date: {
      coming_soon: false,
      date: data?.releaseDate ?? basic?.releaseDate ?? "",
    },
    content_descriptors: { ids: [] },
  };
};

const getGenericShopDetails = async (
  objectId: string,
  shop: GameShop,
  language: string
): Promise<ShopDetailsWithAssets | null> => {
  const [cachedData, cachedAssets] = await Promise.all([
    gamesShopCacheSublevel.get(
      levelKeys.gameShopCacheItem(shop, objectId, language)
    ),
    gamesShopAssetsSublevel.get(levelKeys.game(shop, objectId)),
  ]);

  const cacheHasNewFields =
    cachedData && (cachedData.platform || cachedData.skus);
  if (cachedData && cacheHasNewFields) {
    return { ...cachedData, assets: cachedAssets ?? null };
  }

  const [basic, detailsResponse] = await Promise.all([
    HydraApi.get<LaunchboxBasic | null>(`/games/${shop}/${objectId}`, null, {
      needsAuth: false,
    }).catch((err) => {
      logger.error(`Failed to fetch basic game info for ${shop}`, err);
      return null;
    }),
    HydraApi.post<LaunchboxShopDetailsEntry[]>(
      `/games/shop-details`,
      { shop, objectIds: [objectId] },
      { needsAuth: false }
    ).catch((err) => {
      logger.error(`Failed to fetch shop details for ${shop}`, err);
      return [] as LaunchboxShopDetailsEntry[];
    }),
  ]);

  const detailsEntry = Array.isArray(detailsResponse)
    ? (detailsResponse.find((entry) => entry.objectId === objectId) ?? null)
    : null;
  const data = detailsEntry?.data ?? null;

  if (!data && !basic) return null;

  const mapped = mapLaunchboxToShopDetails(objectId, basic, detailsEntry);

  gamesShopCacheSublevel
    .put(levelKeys.gameShopCacheItem(shop, objectId, language), mapped)
    .catch((err) => {
      logger.error(`Could not cache game details for ${shop}`, err);
    });

  const assets: ShopAssets | null =
    data?.assets || basic
      ? {
          objectId,
          shop,
          title: data?.assets?.title ?? basic?.title ?? mapped.name,
          iconUrl: data?.assets?.iconUrl ?? basic?.iconUrl ?? null,
          libraryHeroImageUrl:
            data?.assets?.libraryHeroImageUrl ??
            basic?.libraryHeroImageUrl ??
            null,
          libraryImageUrl:
            data?.assets?.libraryImageUrl ?? basic?.libraryImageUrl ?? null,
          logoImageUrl:
            data?.assets?.logoImageUrl ?? basic?.logoImageUrl ?? null,
          logoPosition: basic?.logoPosition ?? null,
          coverImageUrl: basic?.coverImageUrl ?? null,
          downloadSources: [],
        }
      : (cachedAssets ?? null);

  if (assets) {
    gamesShopAssetsSublevel
      .put(levelKeys.game(shop, objectId), {
        ...assets,
        updatedAt: Date.now(),
      })
      .catch((err) => {
        logger.error(`Could not cache assets for ${shop}`, err);
      });
  }

  return { ...mapped, assets };
};

const getLocalizedSteamAppDetails = async (
  objectId: string,
  language: string
): Promise<ShopDetails | null> => {
  if (language === "english") {
    return getSteamAppDetails(objectId, language);
  }

  return getSteamAppDetails(objectId, language);
};

const getGameShopDetails = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  shop: GameShop,
  language: string
): Promise<ShopDetailsWithAssets | null> => {
  if (shop === "custom") {
    const gameKey = levelKeys.game(shop, objectId);
    const game = await gamesSublevel.get(gameKey).catch(() => null);

    if (game?.linkedShop && game?.linkedObjectId) {
      // Redirect to the linked source to fetch full details
      return getGameShopDetails(
        _event,
        game.linkedObjectId,
        game.linkedShop as GameShop,
        language
      );
    }

    if (game && (!game.linkedShop || !game.linkedObjectId)) {
      const match = await autoMatchGame(game.title);
      if (match) {
        const updatedGame = {
          ...game,
          linkedShop: match.shop,
          linkedObjectId: match.objectId,
        };
        await gamesSublevel.put(gameKey, updatedGame);

        try {
          const assets = await getGameAssets(match.objectId, match.shop);
          if (assets) {
            const existingAssets = await gamesShopAssetsSublevel.get(gameKey).catch(() => null);
            const updatedAssets = {
              updatedAt: Date.now(),
              objectId,
              shop,
              title: game.title,
              iconUrl: existingAssets?.iconUrl || assets.iconUrl || null,
              libraryHeroImageUrl: existingAssets?.libraryHeroImageUrl || assets.libraryHeroImageUrl || "",
              libraryImageUrl: existingAssets?.libraryImageUrl || assets.libraryImageUrl || "",
              logoImageUrl: existingAssets?.logoImageUrl || assets.logoImageUrl || "",
              logoPosition: existingAssets?.logoPosition || null,
              coverImageUrl: existingAssets?.coverImageUrl || assets.coverImageUrl || "",
              downloadSources: existingAssets?.downloadSources || [],
            };
            await gamesShopAssetsSublevel.put(gameKey, updatedAssets);
          }
        } catch (err) {
          logger.error("Failed to prefetch assets for newly auto-linked game:", err);
        }

        WindowManager.sendToAppWindows("on-library-batch-complete");

        return getGameShopDetails(
          _event,
          match.objectId,
          match.shop,
          language
        );
      }
    }

    return null;
  }

  if (shop === "steam") {
    const [cachedData, cachedAssets] = await Promise.all([
      gamesShopCacheSublevel.get(
        levelKeys.gameShopCacheItem(shop, objectId, language)
      ),
      gamesShopAssetsSublevel.get(levelKeys.game(shop, objectId)),
    ]);

    const appDetails = getLocalizedSteamAppDetails(objectId, language).then(
      (result) => {
        if (result) {
          result.name = cachedAssets?.title ?? result.name;

          gamesShopCacheSublevel
            .put(levelKeys.gameShopCacheItem(shop, objectId, language), result)
            .catch((err) => {
              logger.error("Could not cache game details", err);
            });

          return {
            ...result,
            assets: cachedAssets ?? null,
          };
        }

        return null;
      }
    );

    if (cachedData) {
      return {
        ...cachedData,
        assets: cachedAssets ?? null,
      };
    }

    return appDetails;
  }

  return getGenericShopDetails(objectId, shop, language);
};

registerEvent("getGameShopDetails", getGameShopDetails);
