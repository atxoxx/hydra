const CATALOG_API_BASE = "https://catalog.gamepass.com/sigls/v2";
const GAME_PASS_CATALOG_ID = "fdd9e2a7-0fee-49f6-ad69-4354098401ff";
const EA_PLAY_CATALOG_ID = "1d33fbb9-b895-4732-a8ca-a55c8b99fa2c";
const PRODUCT_DETAIL_API =
  "https://displaycatalog.mp.microsoft.com/v7.0/products";

const CACHE_KEY = "hydra_gamepass_cache";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const REGION_STORAGE_KEY = "hydra_gamepass_region";

export interface GamePassCatalogProduct {
  id: string;
}

export interface GamePassGame {
  productId: string;
  name: string;
  description: string;
  coverImageUrl: string;
  backgroundImageUrl: string;
  iconUrl: string | null;
  developers: string[];
  publishers: string[];
  categories: string[];
  releaseDate: string | null;
  productType: "Game" | "EaGame" | "Collection";
  isChildProduct: boolean;
  parentProductId: string;
}

export interface GamePassRegion {
  code: string;
  name: string;
  flag: string;
  language: string;
}

export const GAMEPASS_REGIONS: GamePassRegion[] = [
  { code: "US", name: "United States", flag: "🇺🇸", language: "en-us" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", language: "en-gb" },
  { code: "CA", name: "Canada", flag: "🇨🇦", language: "en-ca" },
  { code: "FR", name: "France", flag: "🇫🇷", language: "fr-fr" },
  { code: "DE", name: "Germany", flag: "🇩🇪", language: "de-de" },
  { code: "JP", name: "Japan", flag: "🇯🇵", language: "ja-jp" },
  { code: "AU", name: "Australia", flag: "🇦🇺", language: "en-au" },
  { code: "BR", name: "Brazil", flag: "🇧🇷", language: "pt-br" },
  { code: "MX", name: "Mexico", flag: "🇲🇽", language: "es-mx" },
  { code: "ES", name: "Spain", flag: "🇪🇸", language: "es-es" },
  { code: "IT", name: "Italy", flag: "🇮🇹", language: "it-it" },
  { code: "KR", name: "Korea", flag: "🇰🇷", language: "ko-kr" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱", language: "nl-nl" },
  { code: "PL", name: "Poland", flag: "🇵🇱", language: "pl-pl" },
  { code: "PT", name: "Portugal", flag: "🇵🇹", language: "pt-pt" },
  { code: "RU", name: "Russia", flag: "🇷🇺", language: "ru-ru" },
  { code: "SE", name: "Sweden", flag: "🇸🇪", language: "sv-se" },
  { code: "TR", name: "Turkey", flag: "🇹🇷", language: "tr-tr" },
  { code: "TW", name: "Taiwan", flag: "🇹🇼", language: "zh-tw" },
  { code: "HK", name: "Hong Kong", flag: "🇭🇰", language: "zh-hk" },
  { code: "SG", name: "Singapore", flag: "🇸🇬", language: "en-sg" },
  { code: "IN", name: "India", flag: "🇮🇳", language: "en-in" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", language: "en-za" },
  { code: "AR", name: "Argentina", flag: "🇦🇷", language: "es-ar" },
  { code: "CL", name: "Chile", flag: "🇨🇱", language: "es-cl" },
  { code: "CO", name: "Colombia", flag: "🇨🇴", language: "es-co" },
  { code: "NO", name: "Norway", flag: "🇳🇴", language: "nb-no" },
  { code: "DK", name: "Denmark", flag: "🇩🇰", language: "da-dk" },
  { code: "FI", name: "Finland", flag: "🇫🇮", language: "fi-fi" },
  { code: "AT", name: "Austria", flag: "🇦🇹", language: "de-at" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭", language: "de-ch" },
  { code: "BE", name: "Belgium", flag: "🇧🇪", language: "fr-be" },
  { code: "IE", name: "Ireland", flag: "🇮🇪", language: "en-ie" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿", language: "en-nz" },
  { code: "CZ", name: "Czech Republic", flag: "🇨🇿", language: "cs-cz" },
  { code: "HU", name: "Hungary", flag: "🇭🇺", language: "hu-hu" },
  { code: "GR", name: "Greece", flag: "🇬🇷", language: "el-gr" },
  { code: "IL", name: "Israel", flag: "🇮🇱", language: "he-il" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦", language: "ar-sa" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪", language: "ar-ae" },
];

interface CacheEntry {
  timestamp: number;
  region: string;
  games: GamePassGame[];
}

export function loadRegion(): string {
  try {
    const saved = localStorage.getItem(REGION_STORAGE_KEY);
    if (saved && GAMEPASS_REGIONS.some((r) => r.code === saved)) {
      return saved;
    }
  } catch {
    /* ignore */
  }
  return "US";
}

export function saveRegion(regionCode: string): void {
  try {
    localStorage.setItem(REGION_STORAGE_KEY, regionCode);
  } catch {
    /* ignore */
  }
}

function loadCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

function saveCache(region: string, games: GamePassGame[]): void {
  try {
    const entry: CacheEntry = { timestamp: Date.now(), region, games };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* storage full — keep in-memory only */
  }
}

function normalizeName(name: string): string {
  return name
    .replace("(PC)", "")
    .replace("(Windows)", "")
    .replace("(Windows 10)", "")
    .replace("for Windows 10", "")
    .replace("- Windows 10", "")
    .replace("Windows 10", "")
    .replace(/[®™©]/g, "")
    .replace(/: Windows Edition$/i, "")
    .replace(/ - Windows Edition$/i, "")
    .replace(/ Windows Edition$/i, "")
    .replace(/ - PC$/i, "")
    .replace(/ PC$/i, "")
    .replace(/ Windows$/i, "")
    .replace(/ Win10$/i, "")
    .replace(/ Win 10$/i, "")
    .trim();
}

function extractCompanies(companiesString: string): string[] {
  if (!companiesString) return [];
  const cleaned = companiesString
    .replace("Developed by ", "")
    .replace(/, Inc/g, ". Inc")
    .replace(/, INC/g, ". INC")
    .replace(/, inc/g, ". inc")
    .replace(/, Llc/g, ". Llc")
    .replace(/, LLC/g, ". LLC")
    .replace(/, Ltd/g, ". Ltd")
    .replace(/, LTD/g, ". LTD");

  // Split on known company separators (exact string matching, not regex)
  const separators = [", ", "|", "/", "+", " and ", " & "];
  let parts = [cleaned];
  for (const sep of separators) {
    parts = parts.flatMap((p) => p.split(sep));
  }

  return parts
    .map((s) =>
      s
        .replace(". Inc", ", Inc")
        .replace(". INC", ", INC")
        .replace(". inc", ", inc")
        .replace(". Llc", ", Llc")
        .replace(". LLC", ", LLC")
        .replace(". Ltd", ", Ltd")
        .replace(". LTD", ", LTD")
        .trim()
    )
    .filter(Boolean);
}

async function fetchCatalogProducts(
  catalogId: string,
  language: string,
  market: string
): Promise<GamePassCatalogProduct[]> {
  const url = `${CATALOG_API_BASE}?id=${catalogId}&language=${language}&market=${market}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Catalog fetch failed: ${response.status}`);
  const raw = await response.json();
  // The API returns an array where the first entry is a header object
  // (e.g. {siglId, title, ...}) followed by product entries {id: "..."}.
  // Filter out entries that don't have an id field.
  return (Array.isArray(raw) ? raw : []).filter(
    (entry: any) => typeof entry.id === "string" && entry.id.length > 0
  );
}

async function fetchProductDetails(
  productIds: string[],
  language: string,
  market: string
): Promise<GamePassGame[]> {
  const bigIds = productIds.join(",");
  const url = `${PRODUCT_DETAIL_API}?bigIds=${encodeURIComponent(bigIds)}&market=${market}&languages=${language}&MS-CV=F.1`;

  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Product detail fetch failed: ${response.status}`);

  const data = await response.json();
  return parseProductData(data);
}

function parseProductData(catalogData: any): GamePassGame[] {
  if (!catalogData?.Products) return [];

  const games: GamePassGame[] = [];

  for (const product of catalogData.Products) {
    if (product.ProductBSchema === "ProductAddOn;3") continue;

    const localized = product.LocalizedProperties?.[0];
    if (!localized) continue;

    const marketProps = product.MarketProperties?.[0];
    const images = localized.Images || [];

    const posterImage = images.find(
      (img: any) => img.ImagePurpose === "Poster"
    );
    const heroImage = images.find(
      (img: any) => img.ImagePurpose === "SuperHeroArt"
    );
    const boxArt = images.find((img: any) => img.ImagePurpose === "BoxArt");
    const logoImage = images.find((img: any) => img.ImagePurpose === "Logo");

    const coverUrl = posterImage
      ? `https:${posterImage.Uri}`
      : boxArt
        ? `https:${boxArt.Uri}`
        : "";

    const game: GamePassGame = {
      productId: product.ProductId,
      name: normalizeName(localized.ProductTitle || ""),
      description: localized.ProductDescription || "",
      coverImageUrl: coverUrl,
      backgroundImageUrl: heroImage ? `https:${heroImage.Uri}` : coverUrl,
      iconUrl: boxArt
        ? `https:${boxArt.Uri}`
        : logoImage
          ? `https:${logoImage.Uri}`
          : null,
      developers: extractCompanies(localized.DeveloperName || ""),
      publishers: extractCompanies(localized.PublisherName || ""),
      categories: product.Properties?.Categories || [],
      releaseDate: marketProps?.OriginalReleaseDate
        ? new Date(marketProps.OriginalReleaseDate).toISOString()
        : null,
      productType: "Game",
      isChildProduct: false,
      parentProductId: "",
    };

    games.push(game);
  }

  return games;
}

export async function getGamePassGames(
  regionCode: string
): Promise<GamePassGame[]> {
  const region =
    GAMEPASS_REGIONS.find((r) => r.code === regionCode) ?? GAMEPASS_REGIONS[0];

  // Check cache
  const cached = loadCache();
  if (cached && cached.region === regionCode) {
    return cached.games;
  }

  const allGames: GamePassGame[] = [];

  // Fetch main GamePass catalog
  let catalogProducts: GamePassCatalogProduct[] = [];
  try {
    catalogProducts = await fetchCatalogProducts(
      GAME_PASS_CATALOG_ID,
      region.language,
      region.code
    );
    console.log(
      `[GamePass] Fetched ${catalogProducts.length} catalog products for ${regionCode}`
    );
  } catch (err) {
    console.error("[GamePass] Failed to fetch main catalog:", err);
  }

  // Fetch EA Play catalog
  let eaProducts: GamePassCatalogProduct[] = [];
  try {
    eaProducts = await fetchCatalogProducts(
      EA_PLAY_CATALOG_ID,
      region.language,
      region.code
    );
    console.log(
      `[GamePass] Fetched ${eaProducts.length} EA Play products for ${regionCode}`
    );
  } catch (err) {
    console.warn("[GamePass] EA Play catalog not available:", err);
  }

  const allProductIds = [
    ...catalogProducts.map((p) => p.id),
    ...eaProducts.map((p) => p.id),
  ];

  console.log(`[GamePass] Total product IDs to fetch: ${allProductIds.length}`);

  // Fetch details in batches of 20
  const batchSize = 20;
  for (let i = 0; i < allProductIds.length; i += batchSize) {
    const batch = allProductIds.slice(i, i + batchSize);
    try {
      const details = await fetchProductDetails(
        batch,
        region.language,
        region.code
      );
      allGames.push(...details);
    } catch (err) {
      console.error(
        `[GamePass] Failed to fetch batch ${i / batchSize + 1}:`,
        err
      );
    }
  }

  console.log(`[GamePass] Parsed ${allGames.length} games total`);

  // Sort alphabetically
  allGames.sort((a, b) => a.name.localeCompare(b.name));

  // Only cache if we actually got results
  if (allGames.length > 0) {
    saveCache(regionCode, allGames);
  }

  return allGames;
}

export function getCachedGamePassGames(): GamePassGame[] | null {
  const cached = loadCache();
  if (cached && cached.region === loadRegion()) {
    return cached.games;
  }
  return null;
}

export function getXboxDeepLink(productId: string): string {
  return `msxbox://game/?productId=${productId}`;
}

export function getXboxStoreUrl(gameName: string): string {
  const encoded = encodeURIComponent(gameName);
  return `https://www.xbox.com/en-us/games/store/search?q=${encoded}`;
}
