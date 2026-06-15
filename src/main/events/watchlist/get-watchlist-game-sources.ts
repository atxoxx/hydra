import { registerEvent } from "../register-event";
import { HydraApi } from "@main/services";
import type { GameShop } from "@types";

interface WatchlistGameEntry {
  shop: GameShop;
  objectId: string;
  title: string;
}

interface CatalogueSearchEdge {
  objectId: string;
  shop: string;
  downloadSources: string[];
}

const getWatchlistGamesSources = async (
  _event: Electron.IpcMainInvokeEvent,
  entries: WatchlistGameEntry[]
): Promise<Record<string, string[]>> => {
  const results: Record<string, string[]> = {};

  await Promise.all(
    entries.map(async (entry) => {
      const key = `${entry.shop}:${entry.objectId}`;

      try {
        const response = await HydraApi.post<{
          edges: CatalogueSearchEdge[];
        }>(
          "/catalogue/search",
          {
            title: entry.title,
            take: 3,
            skip: 0,
            shops: [entry.shop],
            sortBy: "popularity",
            sortOrder: "desc",
          },
          { needsAuth: false }
        );

        const game = (response.edges ?? []).find(
          (e: CatalogueSearchEdge) =>
            e.objectId === entry.objectId && e.shop === entry.shop
        );

        results[key] = game?.downloadSources ?? [];
      } catch {
        results[key] = [];
      }
    })
  );

  return results;
};

registerEvent("getWatchlistGamesSources", getWatchlistGamesSources);
