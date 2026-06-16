import { HowLongToBeatProvider } from "./how-long-to-beat-provider";
import { BackloggedProvider } from "./backlogged-provider";
import { IgdbSteamProvider } from "./igdb-steam-provider";
import {
  AUTO_MATCH_THRESHOLD,
  type PlaytimeProvider,
  type PlaytimeProviderId,
  type PlaytimeSearchResult,
} from "./types";

const providers: Record<PlaytimeProviderId, PlaytimeProvider> = {
  howlongtobeat: new HowLongToBeatProvider(),
  backlogged: new BackloggedProvider(),
  igdb_steam: new IgdbSteamProvider(),
};

export function getProvider(id: PlaytimeProviderId): PlaytimeProvider {
  return providers[id];
}

export function listProviders(): PlaytimeProviderId[] {
  return ["howlongtobeat", "backlogged", "igdb_steam"];
}

export interface AutoMatchInput {
  title: string;
  releaseYear?: number | null;
  appId?: number | null;
}

/**
 * Search every provider in parallel and return the highest-similarity
 * hit that meets the AUTO_MATCH_THRESHOLD. If none qualify, return
 * `null` so the renderer can render the empty-state UI.
 */
export async function autoMatchPlaytime(
  input: AutoMatchInput,
  signal?: AbortSignal
): Promise<PlaytimeSearchResult | null> {
  const promises = listProviders().map((id) =>
    providers[id]
      .search(input.title, signal)
      .then((results) => ({ id, results }))
      .catch(() => ({ id, results: [] as PlaytimeSearchResult[] }))
  );

  const responses = await Promise.all(promises);
  const flat: PlaytimeSearchResult[] = responses.flatMap((r) => r.results);

  if (flat.length === 0) return null;

  // Apply a small bonus for matching release year when the user told
  // us about it. This rarely helps (the title alone is the strong
  // signal) but is cheap insurance against obvious false matches.
  const enriched = flat.map((r) => {
    if (!input.releaseYear || !r.releaseYear) return r;
    const sameYear = input.releaseYear === r.releaseYear;
    return {
      ...r,
      similarityScore: Math.min(1, r.similarityScore + (sameYear ? 0.05 : 0)),
    };
  });

  enriched.sort((a, b) => b.similarityScore - a.similarityScore);
  const top = enriched[0];

  if (top.similarityScore < AUTO_MATCH_THRESHOLD) return null;
  return top;
}

/**
 * Search a single provider and return its results sorted by similarity.
 * Used by the Edit picker's typeahead search.
 */
export async function searchProvider(
  providerId: PlaytimeProviderId,
  query: string,
  signal?: AbortSignal
): Promise<PlaytimeSearchResult[]> {
  const provider = providers[providerId];
  const results = await provider.search(query, signal).catch(() => []);
  return [...results].sort((a, b) => b.similarityScore - a.similarityScore);
}
