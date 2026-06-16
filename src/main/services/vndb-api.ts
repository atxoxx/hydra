import axios from "axios";
import { networkLogger as logger } from "./logger";

export interface VNDBSearchResult {
  id: string;
  title: string;
  alttitle: string | null;
  original: string | null;
  released: string | null;
  platforms: string[];
  languages: string[];
  developers: Array<{ id: string; name: string; original: string | null }>;
  rating: number;
  popularity: number;
  length: number | null;
  tags: Array<{
    id: number;
    name: string;
    category: string;
    rating: number;
    spoiler: number;
  }>;
  image: { url: string | null } | null;
  screenshots: Array<{
    url: string;
    width: number;
    height: number;
  }>;
}

/**
 * Narrowed, sanitized payload used for multi-result searches. Keeps the public
 * surface minimal and ensures screenshots are url-only.
 */
export interface VNDBSearchEntry {
  id: string;
  title: string;
  released: string | null;
  developers: Array<{ id: string; name: string; original: string | null }>;
  tags: Array<{
    id: number;
    name: string;
    category: string;
    rating: number;
    spoiler: number;
  }>;
  image: { url: string | null } | null;
}

export interface VNDBGameData {
  originalTitle: string;
  aliases: string[];
  length: string;
  rating: number;
  popularity: number;
  tags: Array<{
    id: string;
    name: string;
    category: string;
    spoilerLevel: number;
  }>;
  coverImageUrl: string | null;
  screenshots: string[];
}

const BASE_URL = "https://api.vndb.org/kana";

const LENGTH_MAP: Record<number, string> = {
  1: "very_short",
  2: "short",
  3: "medium",
  4: "long",
  5: "very_long",
};

export class VNDBApi {
  private static readonly CACHE = new Map<string, VNDBGameData | null>();
  private static readonly CACHE_TTL = 24 * 60 * 60 * 1000;
  private static readonly CACHE_TIMESTAMPS = new Map<string, number>();

  static async searchGame(
    gameTitle: string
  ): Promise<VNDBGameData | null> {
    const cacheKey = gameTitle.toLowerCase().trim();

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
      const response = await axios.post<VNDBSearchResult[]>(
        `${BASE_URL}/vn`,
        {
          filters: ["search", "=", gameTitle],
          fields:
            "title, alttitle, original, released, platforms, languages, developers, rating, popularity, length, tags.name, tags.category, tags.rating, tags.spoiler, image.url, screenshots.url, screenshots.width, screenshots.height",
          sort: "rating",
          results: 3,
        },
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      const results = response.data;
      if (!results || results.length === 0) {
        this.CACHE.set(cacheKey, null);
        this.CACHE_TIMESTAMPS.set(cacheKey, Date.now());
        return null;
      }

      const vn = results[0];
      const gameData: VNDBGameData = {
        originalTitle: vn.original || vn.title,
        aliases: [vn.alttitle, vn.title].filter(
          (t): t is string => t !== null && t !== vn.original
        ),
        length: LENGTH_MAP[vn.length ?? 0] || "medium",
        rating: vn.rating / 10,
        popularity: vn.popularity,
        tags: (vn.tags || []).map((tag) => ({
          id: String(tag.id),
          name: tag.name,
          category: tag.category,
          spoilerLevel: tag.spoiler,
        })),
        coverImageUrl: vn.image?.url || null,
        screenshots: (vn.screenshots || []).slice(0, 5).map((s) => s.url),
      };

      this.CACHE.set(cacheKey, gameData);
      this.CACHE_TIMESTAMPS.set(cacheKey, Date.now());
      return gameData;
    } catch (error) {
      logger.error("VNDB search failed:", error);
      return null;
    }
  }

  /**
   * Multi-result search. Returns the top N matches (capped by caller) sorted by
   * similarity score so the modal can render a list of candidates rather than
   * just one best match. Uses a dedicated (lighter) fields mask. Cached in the
   * same store as `searchGame` so repeated queries (e.g. when switching source
   * tabs) don't re-hit VNDB.
   */
  static async searchMany(
    gameTitle: string,
    limit = 10
  ): Promise<VNDBSearchEntry[]> {
    if (!gameTitle.trim()) return [];

    const cacheKey = `many:${limit}:${gameTitle.toLowerCase().trim()}`;
    const cachedTimestamp = this.CACHE_TIMESTAMPS.get(cacheKey);
    if (
      cachedTimestamp &&
      Date.now() - cachedTimestamp < this.CACHE_TTL &&
      this.CACHE.has(cacheKey)
    ) {
      return (this.CACHE.get(cacheKey) ?? []) as unknown as VNDBSearchEntry[];
    }

    try {
      const response = await axios.post<VNDBSearchResult[]>(
        `${BASE_URL}/vn`,
        {
          filters: ["search", "=", gameTitle],
          fields:
            "id, title, released, developers.name, developers.original, tags.name, tags.category, tags.spoiler, tags.rating, image.url",
          // VNDB's `search` operator orders by similarity (best match first),
          // which is exactly what the metadata search UI wants.
          sort: "searchrank",
          results: limit,
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 8000,
        }
      );

      const results = response.data;
      if (!Array.isArray(results) || results.length === 0) {
        this.CACHE.set(cacheKey as any, null);
        this.CACHE_TIMESTAMPS.set(cacheKey, Date.now());
        return [];
      }

      const entries: VNDBSearchEntry[] = results.map((vn) => ({
        id: vn.id,
        title: vn.title,
        released: vn.released,
        developers: vn.developers ?? [],
        tags: vn.tags ?? [],
        image: vn.image ?? null,
      }));

      this.CACHE.set(cacheKey as any, entries as any);
      this.CACHE_TIMESTAMPS.set(cacheKey, Date.now());
      return entries;
    } catch (error) {
      logger.error("VNDB searchMany failed:", error);
      return [];
    }
  }
}
