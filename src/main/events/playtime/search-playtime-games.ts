import { registerEvent } from "../register-event";
import { searchProvider } from "@main/services/playtime-providers/playtime-aggregator";
import {
  getCachedSearch,
  setCachedSearch,
} from "@main/services/playtime-providers/cache";
import type { PlaytimeProviderId, PlaytimeSearchResult } from "@types";

export interface SearchPlaytimeArgs {
  provider: PlaytimeProviderId;
  query: string;
}

export type SearchPlaytimeResult = PlaytimeSearchResult[];

export function registerSearchPlaytimeGames() {
  registerEvent(
    "searchPlaytimeGames",
    async (
      _event,
      { provider, query }: SearchPlaytimeArgs
    ): Promise<SearchPlaytimeResult> => {
      try {
        const trimmed = (query ?? "").trim();
        if (trimmed.length < 2) return [];

        const cached = getCachedSearch(provider, trimmed);
        if (cached) return cached;

        const results = await searchProvider(provider, trimmed);
        setCachedSearch(provider, trimmed, results);
        return results;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[searchPlaytimeGames] failed:", error);
        return [];
      }
    }
  );
}
