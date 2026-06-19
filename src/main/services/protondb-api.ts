import axios from "axios";
import { networkLogger as logger } from "./logger";
import type {
  DeckCompatibilityLevel,
  ProtonCompatibility,
  ProtonDbTier,
} from "@types";

/**
 * ProtonDB community scraping client.
 *
 * The ProtonDB public API exposes per-app summaries at:
 *   GET https://www.protondb.com/api/v1/reports/summaries/{appId}.json
 *
 * The payload looks like:
 *   {
 *     "appId": 123,
 *     "tier": "gold" | "borked" | ...,
 *     "confidence": "high" | "medium" | "low",
 *     "score": 0..100,
 *     "total": <report count>,
 *     "bestReportedTier": ...,
 *     "trendingTier": ...,
 *     "deckCompatibility": "verified" | "playable" | "unsupported" | "unknown"
 *   }
 *
 * If ProtonDB doesn't have a summary yet (e.g. the appId is unknown),
 * the endpoint returns 404. We treat that as "no info" and return null
 * — the caller decides what to display.
 *
 * Caching follows the same in-memory TTL convention used by the rest of
 * the metadata services (ign-metadata, vndb-api, pcgamingwiki-api).
 */
const BASE_URL = "https://www.protondb.com/api/v1";

const VALID_TIERS: ProtonDbTier[] = [
  "borked",
  "bronze",
  "silver",
  "gold",
  "platinum",
  "pending",
  "unsupported",
];

const VALID_DECK: DeckCompatibilityLevel[] = [
  "verified",
  "playable",
  "unsupported",
  "unknown",
];

export class ProtonDbApi {
  private static readonly CACHE = new Map<string, ProtonCompatibility | null>();
  private static readonly CACHE_TTL = 24 * 60 * 60 * 1000;
  private static readonly CACHE_TIMESTAMPS = new Map<string, number>();
  private static readonly INFLIGHT = new Map<
    string,
    Promise<ProtonCompatibility | null>
  >();

  /**
   * Fetch compatibility info for a Steam appId. Returns null when ProtonDB
   * has no record (404) or the request fails — the callers already degrade
   * gracefully so this never throws.
   */
  static async getCompatibility(appId: string): Promise<ProtonCompatibility | null> {
    if (!appId) return null;

    // Normalize so numeric strings all share a cache slot.
    const normalized = String(parseInt(appId, 10));
    if (!normalized) return null;

    const cached = ProtonDbApi.CACHE.get(normalized);
    const timestamp = ProtonDbApi.CACHE_TIMESTAMPS.get(normalized);
    if (
      timestamp !== undefined &&
      (cached !== undefined || cached === null) &&
      Date.now() - timestamp < ProtonDbApi.CACHE_TTL
    ) {
      return cached ?? null;
    }

    // De-duplicate concurrent fetches for the same appId.
    const inflight = ProtonDbApi.INFLIGHT.get(normalized);
    if (inflight) return inflight;

    const request = ProtonDbApi.fetchAndCache(normalized).finally(() => {
      ProtonDbApi.INFLIGHT.delete(normalized);
    });
    ProtonDbApi.INFLIGHT.set(normalized, request);
    return request;
  }

  private static async fetchAndCache(
    appId: string
  ): Promise<ProtonCompatibility | null> {
    try {
      const response = await axios.get(
        `${BASE_URL}/reports/summaries/${appId}.json`,
        {
          // ProtonDB occasionally rate-limits; a 4s ceiling keeps us from
          // blocking the whole metadata pipeline if their edge is slow.
          timeout: 4000,
          headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (Hydra Launcher)",
          },
          // Don't throw for 4xx; we want to map 404 → null explicitly.
          validateStatus: (status) => status >= 200 && status < 500,
        }
      );

      if (response.status === 404 || !response.data || response.status >= 400) {
        logger.debug(`ProtonDB has no summary for appId=${appId}`);
        ProtonDbApi.CACHE.set(appId, null);
        ProtonDbApi.CACHE_TIMESTAMPS.set(appId, Date.now());
        return null;
      }

      const data = response.data;
      const compat: ProtonCompatibility = {
        tier: normalizeTier(data.tier),
        confidence:
          typeof data.confidence === "string" ? data.confidence : null,
        score: typeof data.score === "number" ? data.score : null,
        total: typeof data.total === "number" ? data.total : null,
        bestReportedTier: normalizeTier(data.bestReportedTier),
        trendingTier: normalizeTier(data.trendingTier),
        deckCompatibility: normalizeDeck(data.deckCompatibility),
        url: `https://www.protondb.com/app/${appId}`,
        fetchedAt: new Date().toISOString(),
      };

      ProtonDbApi.CACHE.set(appId, compat);
      ProtonDbApi.CACHE_TIMESTAMPS.set(appId, Date.now());
      return compat;
    } catch (error) {
      logger.warn(`ProtonDB fetch failed for appId=${appId}:`, error);
      // Cache the failure so we don't immediately re-hit a broken edge.
      ProtonDbApi.CACHE.set(appId, null);
      ProtonDbApi.CACHE_TIMESTAMPS.set(appId, Date.now());
      return null;
    }
  }

  static clearCache(): void {
    ProtonDbApi.CACHE.clear();
    ProtonDbApi.CACHE_TIMESTAMPS.clear();
  }
}

function normalizeTier(value: unknown): ProtonDbTier | null {
  if (typeof value !== "string") return null;
  const lower = value.toLowerCase() as ProtonDbTier;
  return VALID_TIERS.includes(lower) ? lower : null;
}

function normalizeDeck(value: unknown): DeckCompatibilityLevel | null {
  if (typeof value !== "string") return null;
  const lower = value.toLowerCase() as DeckCompatibilityLevel;
  return VALID_DECK.includes(lower) ? lower : null;
}
