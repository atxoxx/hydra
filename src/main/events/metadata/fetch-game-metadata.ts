import { ipcMain } from "electron";
import { MetadataFetcher } from "@main/services/metadata-fetcher";
import {
  getMetadataCache,
  setMetadataCache,
} from "@main/level/sublevels/metadata-cache";
import {
  searchAllSources,
  searchSteamFirst,
} from "@main/services/metadata-search-aggregator";
import { VNDBApi } from "@main/services/vndb-api";
import { networkLogger as logger } from "@main/services/logger";
import type { MetadataSearchResult } from "@types";

ipcMain.handle(
  "fetchGameMetadata",
  async (_event, shop: string, objectId: string, gameTitle: string) => {
    try {
      const cached = await getMetadataCache(shop, objectId);
      if (cached) {
        return cached.metadata;
      }

      const metadata = await MetadataFetcher.fetchMetadata(
        shop,
        objectId,
        gameTitle
      );

      if (metadata) {
        const sources = Object.values(metadata.sources).filter(
          (s): s is string => s !== undefined
        );
        await setMetadataCache(shop, objectId, metadata, sources);
      }

      return metadata;
    } catch (error) {
      logger.error("fetchGameMetadata IPC handler failed:", error);
      return null;
    }
  }
);

/**
 * `searchGameMetadata` is the entry-point used by the metadata-search modal.
 *
 * Source tabs supported:
 *  - "all"  — default; fan-out across Steam Store + Hydra catalogue + VNDB,
 *             merge, dedupe, and enrich every candidate. This is the path
 *             the user gets when they open the modal — it almost never
 *             returns zero usable rows because at least the catalogue hits.
 *  - "steam" — Steam Store search; falls back to catalogue (steam-only) if
 *             blocked or empty. Each result is enriched via Steam appdetails.
 *  - "vndb"  — VNDB visual-novel search, useful for non-game VNs.
 *  - "igdb" / "hydra" — deprecated names kept for backward compatibility
 *             so old builds don't break; both behave like "all".
 */
type SearchSource = "all" | "steam" | "igdb" | "hydra" | "vndb";

ipcMain.handle(
  "searchGameMetadata",
  async (
    _event,
    query: string,
    source: string,
    shop?: string
  ): Promise<MetadataSearchResult[]> => {
    try {
      const trimmed = (query ?? "").trim();
      if (trimmed.length < 2) return [];

      const limit = 10;
      const normalized = (source ?? "all").toLowerCase() as SearchSource;

      if (normalized === "vndb") {
        return searchVnDb(trimmed, limit);
      }

      if (normalized === "steam") {
        return searchSteamFirst(trimmed, limit);
      }

      // Default: "all" / legacy "igdb" / legacy "hydra" — fan out everywhere.
      const [broad, vn] = await Promise.all([
        searchAllSources(trimmed, limit),
        searchVnDb(trimmed, 2).catch(() => []),
      ]);
      // If the user's `shop` parameter is set (e.g. game is on "steam"), keep
      // matching candidates ahead; otherwise preserve the merged order.
      const filtered = shop
        ? [
            ...broad.filter((r) => r.shop === shop),
            ...broad.filter((r) => r.shop !== shop),
          ]
        : broad;
      return [...filtered, ...vn].slice(0, limit);
    } catch (error) {
      logger.error("searchGameMetadata IPC handler failed:", error);
      return [];
    }
  }
);

async function searchVnDb(
  query: string,
  limit: number
): Promise<MetadataSearchResult[]> {
  try {
    const items = await VNDBApi.searchMany(query, limit);
    if (!items || items.length === 0) return [];
    return items.map((vn) => ({
      title: vn.title,
      objectId: vn.id,
      shop: "custom",
      source: "vndb",
      iconUrl: vn.image?.url || null,
      genres: (vn.tags || [])
        .filter((t) => t.category === "genre")
        .map((t) => t.name),
      developers: (vn.developers || []).map((d) => d.name),
      publishers: [],
      releaseYear: vn.released
        ? parseInt((vn.released.match(/(\d{4})/) || ["", ""])[1], 10) || null
        : null,
      description: (vn.tags || [])
        .filter((t) => (t.spoiler ?? 2) <= 1)
        .slice(0, 8)
        .map((t) => t.name)
        .filter((name, idx, arr) => arr.indexOf(name) === idx)
        .join(", "),
      similarityScore: 1,
    }));
  } catch (err) {
    logger.error("VNDB searchMany failed in fetch-game-metadata:", err);
    return [];
  }
}
