import axios, { AxiosError } from "axios";
import { networkLogger as logger } from "./logger";

export type AssetType = "icon" | "logo" | "hero";

export interface AssetSearchResult {
  id: string;
  thumbnailUrl: string;
  fullImageUrl: string;
  sourceUrl: string;
  sourceName: string;
  width: number | null;
  height: number | null;
}

export interface SearchGameAssetsResponse {
  results: AssetSearchResult[];
  query: string;
}

const MAX_RESULTS = 15;
const MIN_RESULTS_BEFORE_RELAX = 5;

const QUERY_TEMPLATES: Record<AssetType, string> = {
  icon: '"{title}" icon',
  logo: '"{title}" logo png transparent',
  hero: '"{title}" banner',
};

const ASPECT_RATIO_RANGES: Record<
  AssetType,
  { min: number; max: number; orientation: string }
> = {
  icon: { min: 0.8, max: 1.2, orientation: "square-ish" },
  logo: { min: 1.5, max: Infinity, orientation: "horizontal" },
  hero: { min: 2.0, max: Infinity, orientation: "wide" },
};

const CHROME_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const COMMON_HEADERS = {
  "User-Agent": CHROME_USER_AGENT,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// Order matters: more specific patterns first so we don't match unrelated
// `vqd=` substrings (e.g. urls inside inline JSON).
const VQD_PATTERNS: RegExp[] = [
  // <input name="vqd" value="...">
  /<input[^>]+name=["']vqd["'][^>]+value=["']([^"']+)["']/i,
  /<input[^>]+value=["']([^"']+)["'][^>]+name=["']vqd["']/i,
  // Inline JSON: "vqd":"..."
  /vqd["']\s*:\s*["']([^"']+)["']/,
  // JS redirect target: window.location.replace("/dchr/...?...&vqd=...")
  /\.location\.replace\([^)]*vqd=([^&"')\s]+)/,
  // Fallback: any visible vqd= token in the HTML or response URL
  /vqd=([0-9]{1,2}[-–][0-9A-Za-z_-]{4,})/,
];

/**
 * Build a DuckDuckGo image-search query string for a given asset type.
 */
function buildQuery(
  gameTitle: string,
  assetType: AssetType,
  withQuotes = true
): string {
  const template = QUERY_TEMPLATES[assetType];
  const title = withQuotes ? `"${gameTitle}"` : gameTitle;
  return template.replace('"{title}"', title).replace("{title}", title);
}

function extractSourceName(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function getAspectRatio(
  width: number | null,
  height: number | null
): number | null {
  if (width === null || height === null || height === 0) return null;
  return width / height;
}

function matchesAssetType(
  result: AssetSearchResult,
  assetType: AssetType
): boolean {
  const ratio = getAspectRatio(result.width, result.height);
  if (ratio === null) return true; // Unknown dimensions — rank lower but include

  const range = ASPECT_RATIO_RANGES[assetType];
  return ratio >= range.min && ratio <= range.max;
}

function filterByAssetType(
  results: AssetSearchResult[],
  assetType: AssetType
): AssetSearchResult[] {
  const matching = results.filter((r) => matchesAssetType(r, assetType));
  const nonMatching = results.filter((r) => !matchesAssetType(r, assetType));

  if (matching.length >= MIN_RESULTS_BEFORE_RELAX) {
    return matching.slice(0, MAX_RESULTS);
  }

  return [...matching, ...nonMatching].slice(0, MAX_RESULTS);
}

/**
 * Extracts a VQD token from a DuckDuckGo HTML response or the response's
 * final URL (post-redirect). Returns null if no token can be found.
 */
function extractVqd(html: string, finalUrl?: string | null): string | null {
  for (const pattern of VQD_PATTERNS) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }
  if (finalUrl) {
    try {
      const url = new URL(finalUrl);
      const token = url.searchParams.get("vqd");
      if (token) return token;
    } catch {
      // ignore — fall through
    }
  }
  return null;
}

/**
 * Fetch the DuckDuckGo HTML page that hosts the search and extract a VQD
 * token. Falls back between the image-context URL and the plain search URL,
 * because DDG sometimes serves a redirect-only response on the image URL.
 */
async function fetchVqdToken(query: string): Promise<string | null> {
  const urlCandidates = [
    `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iar=images&iax=images&ia=images`,
    `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
  ];

  for (const url of urlCandidates) {
    try {
      const response = await axios.get<string>(url, {
        headers: COMMON_HEADERS,
        timeout: 8000,
        // Follow DDG's JS-driven redirect so we can read the final URL.
        maxRedirects: 5,
        // DDG returns 200 even when it has nothing; treat 2xx and 3xx as ok.
        validateStatus: (s) => s >= 200 && s < 400,
        responseType: "text",
        // Discourage axios from trying Brotli (the DDG response is plain HTML).
        decompress: true,
      });

      const finalUrl =
        (response.request?.res?.responseUrl as string | undefined) ?? url;
      const token = extractVqd(String(response.data ?? ""), finalUrl);
      if (token) {
        logger.log(`DuckDuckGo VQD token acquired: ${token.slice(0, 12)}…`);
        return token;
      }
    } catch (err) {
      const ax = err as AxiosError;
      logger.warn(
        `DuckDuckGo VQD fetch failed for ${url}:`,
        ax.code ?? ax.message
      );
    }
  }
  return null;
}

/**
 * Call DuckDuckGo's `i.js` endpoint with a valid VQD token and return the
 * raw result rows (image, thumbnail, url, width, height).
 */
async function fetchImageResults(
  query: string,
  vqd: string
): Promise<RawDdgRow[]> {
  const params = new URLSearchParams({
    l: "wt-wt",
    o: "json",
    q: query,
    vqd,
    f: ",,,",
    p: "1",
    s: "0", // explicit page index
  });
  const url = `https://duckduckgo.com/i.js?${params.toString()}`;

  try {
    const response = await axios.get<{ results?: RawDdgRow[] }>(url, {
      headers: {
        ...COMMON_HEADERS,
        Accept: "application/json,text/plain,*/*",
        Referer: "https://duckduckgo.com/",
      },
      timeout: 8000,
      validateStatus: (s) => s >= 200 && s < 400,
    });

    const results = response.data?.results;
    return Array.isArray(results) ? results : [];
  } catch (err) {
    const ax = err as AxiosError;
    logger.error(
      `DuckDuckGo i.js fetch failed (${ax.code ?? "unknown"}):`,
      ax.message
    );
    return [];
  }
}

interface RawDdgRow {
  image?: string;
  thumbnail?: string;
  url?: string;
  width?: string | number;
  height?: string | number;
}

/**
 * Map a single DDG result row to the standardized AssetSearchResult shape.
 */
function mapResult(row: RawDdgRow): AssetSearchResult | null {
  const fullImageUrl = row.image;
  if (!fullImageUrl) return null;
  const thumbnailUrl = row.thumbnail || fullImageUrl;
  const sourceUrl = row.url || fullImageUrl;
  return {
    id: hashCode(fullImageUrl),
    thumbnailUrl,
    fullImageUrl,
    sourceUrl,
    sourceName: extractSourceName(sourceUrl),
    width:
      row.width != null && !isNaN(parseInt(String(row.width), 10))
        ? parseInt(String(row.width), 10)
        : null,
    height:
      row.height != null && !isNaN(parseInt(String(row.height), 10))
        ? parseInt(String(row.height), 10)
        : null,
  };
}

/**
 * Run a single DuckDuckGo image query and return standardized results.
 * Returns an empty array on any error rather than throwing — callers decide
 * whether to escalate.
 */
async function runSingleQuery(query: string): Promise<AssetSearchResult[]> {
  const vqd = await fetchVqdToken(query);
  if (!vqd) return [];

  const rows = await fetchImageResults(query, vqd);
  if (rows.length === 0) return [];

  const mapped: AssetSearchResult[] = [];
  for (const row of rows) {
    const m = mapResult(row);
    if (m) mapped.push(m);
  }
  return mapped;
}

async function withBackoff<T>(
  fn: () => Promise<T>,
  attempts = 2,
  baseDelayMs = 600
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i + 1 < attempts) {
        await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1)));
      }
    }
  }
  throw lastError;
}

/**
 * Public API: search for game assets via DuckDuckGo (no headless browser).
 *
 * Strategy:
 *  1. Quoted, asset-typed query — strongest match.
 *  2. If 0 results or transient error, retry an unquoted query after a short
 *     backoff so we don't hammer DDG.
 */
export async function searchGameAssets(
  gameTitle: string,
  assetType: AssetType
): Promise<SearchGameAssetsResponse> {
  const title = gameTitle.trim();
  if (!title) return { results: [], query: "" };

  const effectiveTitle = title.length < 3 ? `${title} game` : title;

  // Attempt 1: quoted query
  const quotedQuery = buildQuery(effectiveTitle, assetType, true);
  try {
    const results = await withBackoff(() => runSingleQuery(quotedQuery));
    if (results.length > 0) {
      const filtered = filterByAssetType(results, assetType);
      logger.log(
        `DuckDuckGo quoted search returned ${filtered.length} results for "${quotedQuery}"`
      );
      return { results: filtered, query: quotedQuery };
    }
  } catch (error) {
    logger.error("DuckDuckGo quoted search failed:", error);
  }

  // Small delay keeps two DDG calls from being rejected as a burst.
  await new Promise((resolve) => setTimeout(resolve, 700));

  // Attempt 2: unquoted fallback
  const unquotedQuery = buildQuery(effectiveTitle, assetType, false);
  try {
    const results = await withBackoff(() => runSingleQuery(unquotedQuery), 2);
    const filtered = filterByAssetType(results, assetType);
    logger.log(
      `DuckDuckGo unquoted search returned ${filtered.length} results for "${unquotedQuery}"`
    );
    return { results: filtered, query: unquotedQuery };
  } catch (error) {
    logger.error("DuckDuckGo unquoted search failed:", error);
    return { results: [], query: unquotedQuery };
  }
}

/**
 * Get query templates (used by frontend for display purposes).
 */
export function getAssetQueryTemplate(assetType: AssetType): string {
  return QUERY_TEMPLATES[assetType];
}
