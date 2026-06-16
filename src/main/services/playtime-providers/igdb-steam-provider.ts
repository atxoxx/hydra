import type {
  PlaytimeProvider,
  PlaytimeSearchResult,
  PlaytimeGameData,
} from "./types";

/**
 * Combined IGDB / Steam playtime provider.
 *
 * Stub: returns empty search results and null for direct fetches until
 * the underlying data source (Steam stats / IGDB playtime fields) is
 * wired up. This keeps the provider registration in place so the UI
 * can render the option without fabricating data.
 */
export class IgdbSteamProvider implements PlaytimeProvider {
  public readonly id = "igdb_steam" as const;

  public async search(
    _query: string,
    _signal?: AbortSignal
  ): Promise<PlaytimeSearchResult[]> {
    return [];
  }

  public async fetchById(
    _externalId: string,
    _signal?: AbortSignal
  ): Promise<PlaytimeGameData | null> {
    return null;
  }
}
