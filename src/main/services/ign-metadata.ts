import { HydraApi } from "./hydra-api";
import { networkLogger as logger } from "./logger";

export interface IGNReviewData {
  score: number | null;
  summary: string | null;
  verdict: string | null;
}

export class IGNMetadataService {
  private static readonly CACHE = new Map<string, IGNReviewData | null>();
  private static readonly CACHE_TTL = 24 * 60 * 60 * 1000;
  private static readonly CACHE_TIMESTAMPS = new Map<string, number>();

  static async getReviewData(gameTitle: string): Promise<IGNReviewData | null> {
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
      const data = await HydraApi.get<{
        score: number | null;
        summary: string | null;
        verdict: string | null;
      } | null>(`/games/search/ign-review`, {
        params: { title: gameTitle },
        needsAuth: false,
      });

      if (data === null || data === undefined) {
        this.CACHE.set(cacheKey, null);
        this.CACHE_TIMESTAMPS.set(cacheKey, Date.now());
        return null;
      }

      const result: IGNReviewData = {
        score: data.score ?? null,
        summary: data.summary ?? null,
        verdict: data.verdict ?? null,
      };

      this.CACHE.set(cacheKey, result);
      this.CACHE_TIMESTAMPS.set(cacheKey, Date.now());
      return result;
    } catch (error) {
      logger.error("IGN metadata fetch failed:", error);
      return null;
    }
  }
}
