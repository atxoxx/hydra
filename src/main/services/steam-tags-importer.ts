import { HydraApi } from "./hydra-api";
import { networkLogger as logger } from "./logger";

export interface SteamTagsResult {
  tags: string[];
  categories: string[];
}

export class SteamTagsImporter {
  private static readonly CACHE = new Map<string, SteamTagsResult | null>();
  private static readonly CACHE_TTL = 24 * 60 * 60 * 1000;
  private static readonly CACHE_TIMESTAMPS = new Map<string, number>();

  static async getTags(
    shop: string,
    objectId: string
  ): Promise<SteamTagsResult | null> {
    if (shop !== "steam") return null;

    const cacheKey = `${shop}:${objectId}`;

    const cached = this.CACHE.get(cacheKey);
    const timestamp = this.CACHE_TIMESTAMPS.get(cacheKey);
    if (
      (cached || cached === null) &&
      timestamp &&
      Date.now() - timestamp < this.CACHE_TTL
    ) {
      return cached;
    }

    try {
      const data = await HydraApi.get<{
        tags: string[];
        categories: string[];
      } | null>(`/games/${shop}/${objectId}/steam-tags`, { needsAuth: false });

      if (data === null || data === undefined) {
        this.CACHE.set(cacheKey, null);
        this.CACHE_TIMESTAMPS.set(cacheKey, Date.now());
        return null;
      }

      const result: SteamTagsResult = {
        tags: data.tags ?? [],
        categories: data.categories ?? [],
      };

      this.CACHE.set(cacheKey, result);
      this.CACHE_TIMESTAMPS.set(cacheKey, Date.now());
      return result;
    } catch (error) {
      logger.error("Steam tags fetch failed:", error);
      return null;
    }
  }
}
