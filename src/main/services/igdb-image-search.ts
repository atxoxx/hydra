import { HydraApi } from "./hydra-api";
import { networkLogger as logger } from "./logger";
import type { AssetSearchResult } from "./duckduckgo-image-search";
import type { ShopAssets } from "@types";

/**
 * Search for game images via IGDB, proxied through the Hydra catalogue API.
 *
 * Since the dedicated IGDB images endpoint doesn't exist yet on the Hydra backend,
 * we search the catalogue for matching games and fetch their assets via
 * `/games/:shop/:objectId/assets`. This returns official cover/icon/logo/hero
 * images that were originally sourced from IGDB.
 */
export async function searchIGDBImages(
  gameTitle: string,
  assetType: "icon" | "logo" | "hero" | "grid" | "banner"
): Promise<AssetSearchResult[]> {
  try {
    // Search the Hydra catalogue for matching games
    const hits = await HydraApi.get<
      Array<{ objectId: string; title: string; shop: string }>
    >(
      "/catalogue/search/suggestions",
      { query: gameTitle, limit: 3 },
      { needsAuth: false }
    );

    if (!hits || hits.length === 0) return [];

    const results: AssetSearchResult[] = [];

    for (const hit of hits) {
      try {
        const assets = await HydraApi.get<ShopAssets | null>(
          `/games/${hit.shop}/${hit.objectId}/assets`,
          null,
          { needsAuth: false }
        );

        if (!assets) continue;

        const url = pickAssetUrl(assets, assetType);
        if (url) {
          results.push({
            id: `igdb-${assetType}-${hit.objectId}`,
            thumbnailUrl: url,
            fullImageUrl: url,
            sourceUrl: url,
            sourceName: "IGDB",
            width: null,
            height: null,
          });
          // Stop once we found a result with a suitable image
          break;
        }
      } catch {
        // Shop assets unavailable — try next hit
      }
    }

    return results;
  } catch (error) {
    logger.error("IGDB image search failed:", error);
    return [];
  }
}

/** Map an asset type to the best available ShopAssets field. */
function pickAssetUrl(
  assets: ShopAssets,
  assetType: "icon" | "logo" | "hero" | "grid" | "banner"
): string | null {
  switch (assetType) {
    case "icon":
      return assets.iconUrl || assets.coverImageUrl || assets.libraryImageUrl;
    case "logo":
      return assets.logoImageUrl || assets.iconUrl;
    case "hero":
    case "banner":
      return (
        assets.libraryHeroImageUrl ||
        assets.libraryImageUrl ||
        assets.coverImageUrl
      );
    case "grid":
      return (
        assets.coverImageUrl || assets.libraryImageUrl || assets.iconUrl
      );
    default:
      return assets.iconUrl || assets.libraryImageUrl;
  }
}
