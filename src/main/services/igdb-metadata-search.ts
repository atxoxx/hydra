import { HydraApi } from "./hydra-api";
import { networkLogger as logger } from "./logger";
import type { MetadataSearchResult } from "@types";

/**
 * Search for game metadata via IGDB, proxied through the Hydra catalogue API.
 *
 * Unlike Playnite (which uses a dedicated backend proxy for IGDB),
 * we leverage Hydra's own catalogue which already indexes IGDB-sourced
 * game data. We search broadly across all shops to maximize results.
 */
export async function searchIGDB(
  query: string,
  limit = 10
): Promise<MetadataSearchResult[]> {
  try {
    const results = await HydraApi.get<
      Array<{
        title: string;
        objectId: string;
        shop: string;
        iconUrl: string | null;
        genres: string[];
        developers: string[];
        publishers: string[];
        releaseYear: number | null;
        description: string;
      }>
    >(
      "/catalogue/search/suggestions",
      { query, limit },
      { needsAuth: false }
    );

    if (!Array.isArray(results)) return [];

    return results.map((r) => ({
      ...r,
      source: "igdb",
      similarityScore: 1,
      genres: Array.isArray(r.genres) ? r.genres : [],
      developers: Array.isArray(r.developers) ? r.developers : [],
      publishers: Array.isArray(r.publishers) ? r.publishers : [],
    }));
  } catch (err) {
    logger.error("IGDB search failed:", err);
    return [];
  }
}
