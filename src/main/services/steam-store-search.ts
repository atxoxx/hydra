import axios from "axios";
import type { MetadataSearchResult } from "@types";
import type { SteamAppDetails } from "@types";
import { networkLogger as logger } from "./logger";

const STEAM_STORE_API = "https://store.steampowered.com";

interface StoreSearchItem {
  id: number;
  name: string;
  tiny_image?: string;
}

interface StoreSearchResponse {
  items?: StoreSearchItem[];
  total?: number;
}

interface AppDetailsResponse {
  [key: string]: {
    success: boolean;
    data: SteamAppDetails;
  };
}

/**
 * Extract release year from the Steam release date string.
 * Steam dates come in formats like "1 Jan, 2020" or "Jan 2020" or "2020".
 */
function extractReleaseYear(dateStr: string): number | null {
  if (!dateStr) return null;
  // Try "DD Mon, YYYY" or "Mon YYYY" or "YYYY"
  const yearMatch = dateStr.match(/(\d{4})/);
  return yearMatch ? parseInt(yearMatch[1], 10) : null;
}

/**
 * Get app details for a single Steam app ID.
 */
async function getAppDetails(
  appId: number
): Promise<SteamAppDetails | null> {
  try {
    const response = await axios.get<AppDetailsResponse>(
      `${STEAM_STORE_API}/api/appdetails`,
      {
        params: { appids: appId, l: "english", cc: "us" },
        timeout: 8000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }
    );

    const appData = response.data?.[String(appId)];
    if (appData?.success && appData.data) {
      return appData.data;
    }
    return null;
  } catch (err) {
    logger.error(`Failed to get Steam app details for ${appId}`, err);
    return null;
  }
}

/**
 * Run async tasks with a concurrency limit to avoid rate limiting.
 */
async function withConcurrencyLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  const executing: Promise<void>[] = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const p = task()
      .then(
        (value) => { results[i] = { status: "fulfilled", value }; },
        (reason) => { results[i] = { status: "rejected", reason }; }
      )
      .finally(() => {
        const idx = executing.indexOf(p);
        if (idx !== -1) executing.splice(idx, 1);
      });

    executing.push(p);

    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.allSettled(executing);
  return results;
}

/**
 * Search the real Steam Store for games matching the query.
 *
 * Follows the Playnite UniversalSteamMetadata pattern:
 * 1. Call storesearch API to find matching games
 * 2. For each result, call appdetails to get full metadata
 * 3. Map to MetadataSearchResult format
 */
export async function searchSteamStore(
  query: string,
  limit = 10
): Promise<MetadataSearchResult[]> {
  try {
    // Step 1: Search the Steam store
    const searchResponse = await axios.get<StoreSearchResponse>(
      `${STEAM_STORE_API}/api/storesearch/`,
      {
        params: { term: query, l: "english" },
        timeout: 8000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }
    );

    const items = searchResponse.data?.items;
    if (!items || items.length === 0) {
      return [];
    }

    // Step 2: Fetch details for each result with concurrency limit (max 3 parallel)
    const topItems = items.slice(0, limit);

    const tasks = topItems.map((item) => async (): Promise<MetadataSearchResult> => {
      // Stagger requests slightly to avoid rate limiting
      const details = await getAppDetails(item.id);

      if (!details) {
        return {
          title: item.name,
          objectId: String(item.id),
          shop: "steam",
          source: "steam",
          iconUrl: item.tiny_image || null,
          genres: [] as string[],
          developers: [] as string[],
          publishers: [] as string[],
          releaseYear: null,
          description: "",
          similarityScore: 1,
        };
      }

      const tags = Array.isArray(details.categories)
        ? details.categories.map((c) => c.description)
        : [];

      return {
        title: details.name,
        objectId: String(details.steam_appid),
        shop: "steam",
        source: "steam",
        iconUrl:
          item.tiny_image ||
          `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${details.steam_appid}/header.jpg`,
        genres: (Array.isArray(details.genres)
          ? details.genres.map((g) => g.name)
          : []) as string[],
        developers: (Array.isArray(details.developers) ? details.developers : []) as string[],
        publishers: (Array.isArray(details.publishers) ? details.publishers : []) as string[],
        releaseYear: extractReleaseYear(details.release_date?.date ?? ""),
        description:
          details.short_description ||
          details.about_the_game ||
          details.detailed_description ||
          "",
        similarityScore: 1,
        tags,
      };
    });

    const results = await withConcurrencyLimit(tasks, 3);

    return results
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<MetadataSearchResult>).value);
  } catch (err) {
    logger.error("Steam store search failed:", err);
    return [];
  }
}
