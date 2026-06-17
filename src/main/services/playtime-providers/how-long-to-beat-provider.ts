import { HowLongToBeatService, HowLongToBeatEntry } from "howlongtobeat-ts";
import type {
  PlaytimeGameData,
  PlaytimeCategory,
  PlaytimeProvider,
  PlaytimeSearchResult,
} from "./types";
import {
  getCachedFetch,
  getCachedSearch,
  setCachedFetch,
  setCachedSearch,
} from "./cache";

/**
 * HowLongToBeat provider backed by the `howlongtobeat-ts` community
 * package.
 *
 * Replaces the previous custom implementation that manually:
 *   - Warmed a hidden BrowserWindow session for Next.js cookies
 *   - Discovered API endpoints by scraping homepage JS bundles
 *   - Maintained its own 350 ms sliding-window rate limiter
 *   - Parsed game details via cheerio HTML scraping
 *
 * All of those concerns are now handled (and kept up to date) by the
 * community-maintained `howlongtobeat-ts` package, which reverse-
 * engineers HLTB's `/api/bleed` endpoint per the same approach as
 * the Lacro59 Playnite plugin.
 */
export class HowLongToBeatProvider implements PlaytimeProvider {
  public readonly id = "howlongtobeat" as const;

  private readonly service = new HowLongToBeatService(0.5);

  public async search(
    query: string,
    _signal?: AbortSignal
  ): Promise<PlaytimeSearchResult[]> {
    const q = query.trim();
    if (q.length < 2) return [];

    const cached = getCachedSearch(this.id, q);
    if (cached !== null) return cached;

    try {
      const result = await this.service.search(q);

      if (!result.success || !result.data || result.data.length === 0) {
        return [];
      }

      const entries = result.data.filter(
        (entry): entry is HowLongToBeatEntry =>
          entry != null && typeof entry.id === "number" && !!entry.name
      );

      const searchResults: PlaytimeSearchResult[] = [];
      for (const entry of entries) {
        const providerGameId = String(entry.id);

        // Build the full PlaytimeGameData from the search hit and
        // cache it so fetchById returns instantly.
        const gameData = buildGameDataFromEntry(providerGameId, entry);
        if (gameData.categories.length > 0) {
          setCachedFetch(this.id, providerGameId, gameData);
        }

        searchResults.push({
          provider: this.id,
          providerGameId,
          title: entry.name.trim(),
          releaseYear: entry.releaseYear ?? null,
          platforms: entry.platforms ?? [],
          imageUrl: entry.imageUrl ?? null,
          similarityScore: entry.similarity ?? 0.95,
          estimatedSeconds: pickPrimarySeconds(entry),
        });
      }

      if (searchResults.length > 0) {
        setCachedSearch(this.id, q, searchResults);
      }
      return searchResults;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[HLTB] search failed:", errorMessage(err));
      return [];
    }
  }

  public async fetchById(
    externalId: string,
    _signal?: AbortSignal
  ): Promise<PlaytimeGameData | null> {
    const id = externalId.trim();
    if (!id) return null;

    // Return from cache — search() already built full PlaytimeGameData
    // from the package's HowLongToBeatEntry results, avoiding the need
    // for an extra HTML scrape.
    const cached = getCachedFetch(this.id, id);
    if (cached) return cached;

    // The package has no fetch-by-id method, and a cold cache means
    // search() hasn't been called yet for this session. The caller
    // (use-playtime-data) always calls autoMatchPlaytime → search()
    // before fetchById, so the cache is always warm in practice.
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*                       Mapping helpers                              */
/* ------------------------------------------------------------------ */

interface CompFieldSpec {
  key: keyof Pick<
    HowLongToBeatEntry,
    "mainTime" | "mainExtraTime" | "completionistTime" | "allStylesTime"
  >;
  label: string;
}

const COMP_FIELD_SPECS: CompFieldSpec[] = [
  { key: "mainTime", label: "Main Story" },
  { key: "mainExtraTime", label: "Main + Sides" },
  { key: "completionistTime", label: "Completionist" },
  { key: "allStylesTime", label: "All Styles" },
];

function buildGameDataFromEntry(
  id: string,
  entry: HowLongToBeatEntry
): PlaytimeGameData {
  const categories: PlaytimeCategory[] = [];

  for (const { key, label } of COMP_FIELD_SPECS) {
    const seconds = entry[key];
    if (
      typeof seconds === "number" &&
      Number.isFinite(seconds) &&
      seconds > 0
    ) {
      categories.push({
        title: label,
        duration: formatSecondsAsDuration(seconds),
        accuracy: "00",
        durationSeconds: seconds,
      });
    }
  }

  return {
    provider: "howlongtobeat" as const,
    providerGameId: id,
    title: entry.name?.trim() ?? id,
    categories,
    platforms: entry.platforms ?? [],
    imageUrl: entry.imageUrl ?? null,
  };
}

function pickPrimarySeconds(entry: HowLongToBeatEntry): number | null {
  return (
    entry.mainTime ??
    entry.mainExtraTime ??
    entry.completionistTime ??
    entry.allStylesTime ??
    null
  );
}

function formatSecondsAsDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0 Hours";
  if (seconds < 60) return `${Math.round(seconds)} Mins`;
  const totalHours = seconds / 3600;
  const rounded = Math.round(totalHours * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-6) {
    return `${Math.round(rounded)} Hours`;
  }
  return `${rounded.toFixed(1)} Hours`;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err ?? "Unknown error");
}
