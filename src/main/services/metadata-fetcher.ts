import { networkLogger as logger } from "./logger";
import { SteamGridDBApi } from "./steamgriddb-api";
import { PCGamingWikiAPI } from "./pcgamingwiki-api";
import { VNDBApi } from "./vndb-api";
import { IGNMetadataService } from "./ign-metadata";
import { SteamTagsImporter } from "./steam-tags-importer";
import { ProtonDbApi } from "./protondb-api";
import { db } from "@main/level";
import { levelKeys } from "@main/level/sublevels";
import { ALL_SHOPS } from "@types";
import type { GameMetadata, GameShop, ImageAsset } from "@types";

const METADATA_CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface CachedMetadata {
  data: GameMetadata;
  timestamp: number;
}

const memoryCache = new Map<string, CachedMetadata>();

export class MetadataFetcher {
  static async fetchMetadata(
    shop: string,
    objectId: string,
    gameTitle: string,
    options?: {
      skipCache?: boolean;
      sources?: string[];
    }
  ): Promise<GameMetadata | null> {
    const cacheKey = `${shop}:${objectId}`;
    const skipCache = options?.skipCache ?? false;

    if (!skipCache) {
      const memCached = memoryCache.get(cacheKey);
      if (memCached && Date.now() - memCached.timestamp < METADATA_CACHE_TTL) {
        return memCached.data;
      }
    }

    try {
      const existing = await MetadataFetcher.getExistingDetails(shop, objectId);

      const results = await Promise.allSettled([
        MetadataFetcher.fetchSteamGridDBImages(gameTitle),
        MetadataFetcher.fetchPCGamingWikiInfo(gameTitle),
        MetadataFetcher.fetchVNDBData(gameTitle),
        MetadataFetcher.fetchIGNReview(gameTitle),
        MetadataFetcher.fetchSteamTags(shop, objectId),
        MetadataFetcher.fetchProtonDbCompat(shop, objectId),
      ]);

      const [
        sgdbResult,
        pcgwResult,
        vndbResult,
        ignResult,
        tagsResult,
        protonResult,
      ] = results;

      const metadata: GameMetadata = {
        title: existing?.title ?? gameTitle,
        description: existing?.description ?? "",
        shortDescription: existing?.shortDescription ?? "",
        releaseDate: existing?.releaseDate ?? null,
        developers: existing?.developers ?? [],
        publishers: existing?.publishers ?? [],
        genres: existing?.genres ?? [],
        tags: [],
        platform: existing?.platform ?? null,
        supportedLanguages: existing?.supportedLanguages ?? [],
        screenshots: existing?.screenshots ?? [],
        gridCovers: [],
        backgrounds: [],
        banners: [],
        steamReviewScore: null,
        ignReviewScore: null,
        metacriticScore: null,
        vndbRating: null,
        technicalInfo: null,
        vndbData: null,
        protonCompatibility: null,
        sources: {},
      };

      if (sgdbResult.status === "fulfilled" && sgdbResult.value) {
        metadata.gridCovers = sgdbResult.value.grids;
        metadata.backgrounds = sgdbResult.value.heroes;
        metadata.banners = sgdbResult.value.logos;
        metadata.sources.gridCovers = "steamgriddb";
        metadata.sources.backgrounds = "steamgriddb";
        metadata.sources.banners = "steamgriddb";
      }

      if (pcgwResult.status === "fulfilled" && pcgwResult.value) {
        metadata.technicalInfo = {
          resolutionSupport: pcgwResult.value.resolutionSupport,
          fpsCaps: pcgwResult.value.fpsCaps,
          widescreenSupport: pcgwResult.value.widescreenSupport,
          ultraWideSupport: pcgwResult.value.ultraWideSupport,
          hdrSupport: pcgwResult.value.hdrSupport,
          fourKSupport: pcgwResult.value.fourKSupport,
          controllerSupport: pcgwResult.value.controllerSupport,
          drmInfo: pcgwResult.value.drmInfo,
          saveGameLocation: pcgwResult.value.saveGameLocation,
          essentialFixes: pcgwResult.value.essentialFixes,
          // New field — PCGamingWiki infobox regex-extracted on best effort.
          engine: pcgwResult.value.engine ?? null,
        };
        metadata.sources.technicalInfo = "pcgamingwiki";
      }

      if (vndbResult.status === "fulfilled" && vndbResult.value) {
        metadata.vndbData = vndbResult.value;
        metadata.vndbRating = vndbResult.value.rating;
        metadata.sources.vndbData = "vndb";
        metadata.sources.vndbRating = "vndb";

        const vnTags = vndbResult.value.tags.map((t) => t.name);
        metadata.tags = [...new Set([...metadata.tags, ...vnTags])];
        metadata.sources.tags = "vndb";
      }

      if (ignResult.status === "fulfilled" && ignResult.value) {
        metadata.ignReviewScore = ignResult.value.score;
        metadata.sources.ignReviewScore = "ign";
      }

      if (tagsResult.status === "fulfilled" && tagsResult.value) {
        metadata.tags = [
          ...new Set([
            ...metadata.tags,
            ...tagsResult.value.tags,
            ...tagsResult.value.categories,
          ]),
        ];
        metadata.sources.tags = "steam";
      }

      if (protonResult.status === "fulfilled" && protonResult.value) {
        metadata.protonCompatibility = protonResult.value;
        metadata.sources.protonCompatibility = "protondb";
      }

      MetadataFetcher.setWithEviction(cacheKey, {
        data: metadata,
        timestamp: Date.now(),
      });

      return metadata;
    } catch (error) {
      logger.error("Metadata fetcher failed:", error);
      return null;
    }
  }

  private static async getExistingDetails(
    shop: string,
    objectId: string
  ): Promise<{
    title: string;
    description: string;
    shortDescription: string;
    releaseDate: string | null;
    developers: string[];
    publishers: string[];
    genres: string[];
    platform: string | null;
    supportedLanguages: string[];
    screenshots: Array<{
      id: string;
      thumbnailUrl: string;
      fullUrl: string;
      width: number;
      height: number;
    }>;
  } | null> {
    try {
      // gameShopCache stores ONE entry per (shop, objectId, language). Look up
      // the per-game key directly — using the user's preferred language first,
      // then falling back to common defaults. This avoids pretending a missing
      // localised entry exists in every user's locale.
      if (!ALL_SHOPS.includes(shop as GameShop)) return null;

      const userPrefs = await db
        .get<string, { language?: string } | null>(levelKeys.userPreferences, {
          valueEncoding: "json",
        })
        .catch(() => null);
      const userLang = userPrefs?.language?.trim();

      const languageCandidates = Array.from(
        new Set(
          [userLang, userLang?.split("-")[0], "en", "english"].filter(
            Boolean
          ) as string[]
        )
      );

      let gameDetails: any = null;
      for (const lang of languageCandidates) {
        const key = levelKeys.gameShopCacheItem(
          shop as GameShop,
          objectId,
          lang
        );
        const entry = await db
          .get<string, any>(key, { valueEncoding: "json" })
          .catch(() => null);
        if (entry) {
          gameDetails = entry;
          break;
        }
      }

      if (!gameDetails) return null;

      return {
        title: gameDetails.name ?? "",
        description: gameDetails.about_the_game ?? "",
        shortDescription: gameDetails.short_description ?? "",
        releaseDate: gameDetails.release_date?.date ?? null,
        developers: gameDetails.developers ?? [],
        publishers: gameDetails.publishers ?? [],
        genres: gameDetails.genres?.map((g: { name: string }) => g.name) ?? [],
        platform:
          gameDetails.platform ?? gameDetails.release_date?.platform ?? null,
        supportedLanguages:
          gameDetails.supported_languages
            ?.split(",")
            .map((l: string) => l.trim()) ?? [],
        screenshots:
          gameDetails.screenshots?.map(
            (s: { id: number; path_thumbnail: string; path_full: string }) => ({
              id: String(s.id),
              thumbnailUrl: s.path_thumbnail,
              fullUrl: s.path_full,
              width: 600,
              height: 337,
            })
          ) ?? [],
      };
    } catch {
      return null;
    }
  }

  private static async fetchSteamGridDBImages(gameTitle: string): Promise<{
    grids: ImageAsset[];
    heroes: ImageAsset[];
    logos: ImageAsset[];
    icons: ImageAsset[];
  } | null> {
    if (!SteamGridDBApi.isConfigured()) return null;

    try {
      const all = await SteamGridDBApi.getAllImages(gameTitle);

      return {
        grids: all.grids.slice(0, 10).map((img) => ({
          id: String(img.id),
          url: img.url,
          width: img.width,
          height: img.height,
          source: "steamgriddb" as const,
          type: "grid" as const,
        })),
        heroes: all.heroes.slice(0, 5).map((img) => ({
          id: String(img.id),
          url: img.url,
          width: img.width,
          height: img.height,
          source: "steamgriddb" as const,
          type: "hero" as const,
        })),
        logos: all.logos.slice(0, 5).map((img) => ({
          id: String(img.id),
          url: img.url,
          width: img.width,
          height: img.height,
          source: "steamgriddb" as const,
          type: "logo" as const,
        })),
        icons: all.icons.slice(0, 5).map((img) => ({
          id: String(img.id),
          url: img.url,
          width: img.width,
          height: img.height,
          source: "steamgriddb" as const,
          type: "icon" as const,
        })),
      };
    } catch {
      return null;
    }
  }

  private static async fetchPCGamingWikiInfo(gameTitle: string) {
    return PCGamingWikiAPI.getTechnicalInfo(gameTitle);
  }

  private static async fetchVNDBData(gameTitle: string) {
    return VNDBApi.searchGame(gameTitle);
  }

  private static async fetchIGNReview(gameTitle: string) {
    return IGNMetadataService.getReviewData(gameTitle);
  }

  private static async fetchSteamTags(shop: string, objectId: string) {
    return SteamTagsImporter.getTags(shop, objectId);
  }

  /**
   * ProtonDB only indexes Steam appIds, so we no-op for non-Steam shops.
   * Returning a never-resolving-ish undefined sequence via Promise.resolve(null)
   * keeps the surrounding Promise.allSettled shape happy.
   */
  private static async fetchProtonDbCompat(
    shop: string,
    objectId: string
  ): Promise<Awaited<ReturnType<typeof ProtonDbApi.getCompatibility>>> {
    if (shop !== "steam") return null;
    return ProtonDbApi.getCompatibility(objectId);
  }

  static clearCache(): void {
    memoryCache.clear();
  }

  private static readonly MAX_CACHE_SIZE = 200;

  private static setWithEviction(cacheKey: string, data: CachedMetadata) {
    if (memoryCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = memoryCache.keys().next().value as string | undefined;
      if (firstKey) memoryCache.delete(firstKey);
    }
    memoryCache.set(cacheKey, data);
  }
}
