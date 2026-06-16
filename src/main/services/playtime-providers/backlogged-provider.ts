import type {
  PlaytimeProvider,
  PlaytimeSearchResult,
  PlaytimeGameData,
} from "./types";

/**
 * Backlogged (backloggd.com) provider.
 *
 * Backloggd does not currently offer a public API, so this provider
 * is implemented as a stub that resolves to empty results. We keep the
 * class so the UI can render the provider option, and the implementation
 * can be filled in once a stable scraping endpoint is verified against
 * the site's terms of service.
 */
export class BackloggedProvider implements PlaytimeProvider {
  public readonly id = "backlogged" as const;

  public async search(
    _query: string,
    _signal?: AbortSignal
  ): Promise<PlaytimeSearchResult[]> {
    // Backloggd does not have a public API. Returning empty means the
    // renderer simply shows zero matches for this provider, falling
    // back to the empty-state UI with the "Search manually" CTA.
    return [];
  }

  public async fetchById(
    _externalId: string,
    _signal?: AbortSignal
  ): Promise<PlaytimeGameData | null> {
    return null;
  }
}
