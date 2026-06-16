import { net, session } from "electron";

const ITAD_BASE = "https://isthereanydeal.com";
const ITAD_HOMEPAGE = `${ITAD_BASE}/`;
const GIVEAWAYS_PAGE = `${ITAD_BASE}/giveaways/`;
const GIVEAWAYS_API = `${ITAD_BASE}/giveaways/api/list/?tab=live`;

/* Matches actual API response from /giveaways/api/list/ */
interface GiveawayGame {
  id: string;
  slug: string;
  title: string;
  type: number;
  mature: boolean;
  assets: {
    boxart: string;
    banner145: string;
    banner300: string;
    banner400: string;
    banner600: string;
  };
  drmfree?: boolean;
  keys?: number[];
  platforms?: unknown[];
}

interface GiveawayEntry {
  id: number;
  url: string;
  start?: number;
  expiry: number | null;
  publishAt: number;
  isPending: boolean;
  title: string;
  isMature: boolean;
  shop: number | null;
  counts: {
    games: number;
    waitlist: number;
    collection: number;
    comments?: number;
  };
  games: GiveawayGame[];
}

interface GiveawaysApiResponse {
  done: boolean;
  data: GiveawayEntry[];
}

export interface Giveaway {
  title: string;
  gameTitle: string;
  link: string;
  expiryDate: Date | null;
  shopName: string;
  gameCount: number;
  boxartUrl: string | null;
}

export interface GiveawayResult {
  giveaways: Giveaway[];
  fromCache: boolean;
  error: string | null;
}

/* ITAD shop IDs → human-readable names.
   Based on observed values and ITAD's known store list. */
const SHOP_NAMES: Record<number, string> = {
  1: "GOG",
  2: "Steam",
  3: "Humble Store",
  4: "Origin",
  5: "Epic Games",
  7: "Ubisoft Store",
  8: "Gamesplanet",
  9: "GamersGate",
  10: "Green Man Gaming",
  11: "IndieGala",
  12: "Fanatical",
  13: "itch.io",
  14: "MacGameStore",
  15: "Microsoft Store",
  16: "Mobile",
  17: "Nintendo eShop",
  18: "PlayStation Store",
  19: "Xbox",
  20: "Amazon",
  21: "Battle.net",
  22: "Battlestate Games",
  24: "Bethesda",
  25: "Blizzard",
  27: "Discord",
  28: "EA app",
  29: "Epic Games Store",
  30: "Google Stadia",
  31: "Kartridge",
  32: "Kickstarter",
  33: "Minecraft",
  34: "Nintendo",
  35: "Oculus",
  36: "Rockstar Games",
  37: "Square Enix Store",
  38: "Twitch",
  39: "Uplay",
  40: "WeGame",
  41: "Wargaming",
  42: "Xbox Game Pass",
  43: "Apple App Store",
  44: "Google Play",
  45: "Netflix",
  46: "Prime Gaming",
  47: "Legacy Games",
  48: "Meta Quest",
  61: "Steam",
};

function getShopName(shopId: number | null | undefined): string {
  if (shopId == null) return "";
  return SHOP_NAMES[shopId] || `Store #${shopId}`;
}

let cachedSessionToken: string | null = null;
let cachedGiveaways: Giveaway[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

async function getSessionToken(): Promise<string> {
  if (cachedSessionToken !== null) {
    console.log("[ITAD] Reusing cached session token");
    return cachedSessionToken;
  }

  console.log("[ITAD] Fetching session token from ITAD homepage…");

  return new Promise((resolve, reject) => {
    const request = net.request({
      method: "GET",
      url: ITAD_HOMEPAGE,
    });

    request.on("response", (response) => {
      let body = "";
      response.on("data", (chunk) => {
        body += chunk.toString();
      });

      response.on("end", async () => {
        console.log(
          `[ITAD] ITAD homepage loaded, status: ${response.statusCode}`
        );

        // Try to extract sess2 directly from Set-Cookie headers
        // (avoids race condition with session cookie store)
        const setCookieHeaders = response.headers["set-cookie"];
        let extractedToken: string | null = null;

        if (setCookieHeaders) {
          const cookieStrings = Array.isArray(setCookieHeaders)
            ? setCookieHeaders
            : [setCookieHeaders];
          for (const cookieStr of cookieStrings) {
            const match = cookieStr.match(/sess2=([^;]+)/);
            if (match) {
              extractedToken = match[1];
              console.log("[ITAD] Extracted sess2 from Set-Cookie header");
              break;
            }
          }
        }

        if (extractedToken) {
          cachedSessionToken = extractedToken;
          try {
            await session.defaultSession.cookies.set({
              url: ITAD_BASE,
              name: "sess2",
              value: extractedToken,
              path: "/",
            });
            console.log("[ITAD] Stored sess2 in cookie jar");
          } catch (err) {
            console.warn("[ITAD] Failed to store sess2 in cookie jar:", err);
          }
          resolve(cachedSessionToken);
          return;
        }

        // Fallback: read from Electron cookie store
        try {
          const cookies = await session.defaultSession.cookies.get({
            domain: "isthereanydeal.com",
            name: "sess2",
          });

          if (cookies.length > 0 && cookies[0].value) {
            cachedSessionToken = cookies[0].value;
            console.log("[ITAD] Got sess2 from cookie store");
            resolve(cachedSessionToken);
            return;
          }

          // Also try dot-prefixed domain
          const cookiesDot = await session.defaultSession.cookies.get({
            domain: ".isthereanydeal.com",
            name: "sess2",
          });

          if (cookiesDot.length > 0 && cookiesDot[0].value) {
            cachedSessionToken = cookiesDot[0].value;
            console.log("[ITAD] Got sess2 from cookie store (.domain)");
            resolve(cachedSessionToken);
            return;
          }

          console.warn(
            "[ITAD] No sess2 cookie found — proceeding without auth"
          );
          resolve("");
        } catch (err) {
          console.error("[ITAD] Failed to read cookies:", err);
          resolve("");
        }
      });

      response.on("error", (err: Error) => {
        console.error("[ITAD] Error loading ITAD homepage:", err);
        reject(err);
      });
    });

    request.on("error", (err: Error) => {
      console.error("[ITAD] Request error:", err);
      reject(err);
    });

    request.end();
  });
}

async function fetchGiveawaysRaw(
  sessionToken: string
): Promise<GiveawaysApiResponse | null> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      Origin: ITAD_BASE,
      Referer: GIVEAWAYS_PAGE,
      "ITAD-SessionToken": sessionToken || "",
    };

    // ITAD API requires the sess2 cookie to be sent as BOTH a Cookie header
    // AND the ITAD-SessionToken header. Electron's net.request may not
    // automatically include cookies set programmatically, so send it explicitly.
    if (sessionToken) {
      headers["Cookie"] = `sess2=${sessionToken}`;
    }

    const request = net.request({
      method: "POST",
      url: GIVEAWAYS_API,
      headers,
    });

    let body = "";
    request.on("response", (response) => {
      const statusCode = response.statusCode ?? 0;
      console.log(`[ITAD] API status: ${statusCode}`);

      if (statusCode < 200 || statusCode >= 300) {
        console.error(
          `[ITAD] API returned HTTP ${statusCode} — treating as failure`
        );
        // Consume the response body to free resources
        response.on("data", () => {});
        response.on("end", () => {
          resolve(null);
        });
        return;
      }

      response.on("data", (chunk) => {
        body += chunk.toString();
      });
      response.on("end", () => {
        try {
          const data = JSON.parse(body) as GiveawaysApiResponse;
          const count = data.data?.length ?? 0;
          console.log(`[ITAD] Parsed ${count} giveaways from API`);
          resolve(data);
        } catch {
          console.error(
            "[ITAD] Failed to parse giveaways response:",
            body.substring(0, 300)
          );
          resolve(null);
        }
      });
      response.on("error", (err: Error) => {
        console.error("[ITAD] Error reading response:", err);
        reject(err);
      });
    });

    request.on("error", (err: Error) => {
      console.error("[ITAD] Request error:", err);
      reject(err);
    });

    request.write(JSON.stringify({ offset: 0, sort: null, filter: null }));
    request.end();
  });
}

function parseGiveaways(data: GiveawaysApiResponse): Giveaway[] {
  if (!data?.data) return [];

  return data.data.map((entry) => {
    const firstGame = entry.games?.[0];
    const gameTitle = firstGame?.title ?? entry.title;
    const boxartUrl = firstGame?.assets?.boxart ?? null;

    return {
      title: entry.title,
      gameTitle,
      link: entry.url || `https://isthereanydeal.com/giveaways/`,
      expiryDate: entry.expiry ? new Date(entry.expiry * 1000) : null,
      shopName: getShopName(entry.shop),
      gameCount: entry.games?.length ?? 0,
      boxartUrl,
    };
  });
}

/**
 * Fetches giveaways from the ITAD API.
 * Retry logic is handled by the frontend (GiveawayPanel).
 *
 * @param forceRefresh - If true, bypasses the cache and forces a fresh fetch.
 * @returns A GiveawayResult containing the giveaways, cache status, and any error message.
 */
export async function getGiveaways(
  forceRefresh = false
): Promise<GiveawayResult> {
  // Return cached data if valid and not forcing refresh
  if (
    !forceRefresh &&
    cachedGiveaways !== null &&
    Date.now() - lastFetchTime < CACHE_TTL_MS
  ) {
    console.log("[ITAD] Returning cached giveaways");
    return { giveaways: cachedGiveaways, fromCache: true, error: null };
  }

  // Force clear session token cache on forced refresh
  if (forceRefresh) {
    console.log(
      "[ITAD] Force refresh requested — clearing session token cache"
    );
    cachedSessionToken = null;
  }

  try {
    const sessionToken = await getSessionToken();
    const rawData = await fetchGiveawaysRaw(sessionToken);

    if (!rawData) {
      console.warn("[ITAD] No data received from API");
      // Fall back to stale cache if available
      if (cachedGiveaways !== null) {
        return { giveaways: cachedGiveaways, fromCache: true, error: null };
      }
      return {
        giveaways: [],
        fromCache: false,
        error: "API request failed or returned an error",
      };
    }

    const giveaways = parseGiveaways(rawData);
    console.log(`[ITAD] Successfully fetched ${giveaways.length} giveaways`);

    cachedGiveaways = giveaways;
    lastFetchTime = Date.now();

    return { giveaways, fromCache: false, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ITAD] Failed to fetch giveaways:", message);

    // Fall back to stale cache if available
    if (cachedGiveaways !== null) {
      return { giveaways: cachedGiveaways, fromCache: true, error: message };
    }

    return { giveaways: [], fromCache: false, error: message };
  }
}

export function clearGiveawayCache(): void {
  cachedGiveaways = null;
  cachedSessionToken = null;
  lastFetchTime = 0;
}
