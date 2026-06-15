import { net, session } from "electron";

const ITAD_BASE = "https://isthereanydeal.com";
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
  drmfree: boolean;
  keys: number[];
  platforms: unknown[];
}

interface GiveawayEntry {
  id: number;
  url: string;
  start: number;
  expiry: number | null;
  publishAt: number;
  isPending: boolean;
  title: string;
  isMature: boolean;
  shop: number;
  counts: {
    games: number;
    waitlist: number;
    collection: number;
    comments: number;
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

function getShopName(shopId: number): string {
  return SHOP_NAMES[shopId] || `Store #${shopId}`;
}

let cachedSessionToken: string | null = null;
let cachedGiveaways: Giveaway[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

async function getSessionToken(): Promise<string> {
  if (cachedSessionToken) return cachedSessionToken;

  console.log("[ITAD] Fetching session token from giveaways page…");

  return new Promise((resolve, reject) => {
    const request = net.request({
      method: "GET",
      url: GIVEAWAYS_PAGE,
    });

    request.on("response", async (response) => {
      let body = "";
      response.on("data", (chunk) => {
        body += chunk.toString();
      });

      response.on("end", async () => {
        try {
          const cookies = await session.defaultSession.cookies.get({
            domain: "isthereanydeal.com",
            name: "sess2",
          });

          if (cookies.length > 0 && cookies[0].value) {
            cachedSessionToken = cookies[0].value;
            console.log("[ITAD] Got sess2 cookie");
            resolve(cachedSessionToken);
          } else {
            console.warn("[ITAD] No sess2 cookie set, trying without auth");
            resolve("");
          }
        } catch (err) {
          console.error("[ITAD] Failed to read cookies:", err);
          resolve("");
        }
      });

      response.on("error", (err: Error) => {
        console.error("[ITAD] Error loading giveaways page:", err);
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
    const request = net.request({
      method: "POST",
      url: GIVEAWAYS_API,
      headers: {
        "Content-Type": "application/json",
        "itad-sessiontoken": sessionToken,
      },
    });

    let body = "";
    request.on("response", (response) => {
      console.log(`[ITAD] API status: ${response.statusCode}`);

      response.on("data", (chunk) => {
        body += chunk.toString();
      });
      response.on("end", () => {
        try {
          const data = JSON.parse(body) as GiveawaysApiResponse;
          console.log(`[ITAD] Got ${data.data?.length ?? 0} giveaways`);
          resolve(data);
        } catch {
          console.error(
            "[ITAD] Failed to parse giveaways:",
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

export async function getGiveaways(): Promise<Giveaway[]> {
  if (cachedGiveaways !== null && Date.now() - lastFetchTime < CACHE_TTL_MS) {
    console.log("[ITAD] Returning cached giveaways");
    return cachedGiveaways;
  }

  try {
    const sessionToken = await getSessionToken();
    const rawData = await fetchGiveawaysRaw(sessionToken);

    if (!rawData) {
      return cachedGiveaways ?? [];
    }

    const giveaways = parseGiveaways(rawData);
    cachedGiveaways = giveaways;
    lastFetchTime = Date.now();
    return giveaways;
  } catch (err) {
    console.error("[ITAD] Failed to fetch giveaways:", err);
    return cachedGiveaways ?? [];
  }
}

export function clearGiveawayCache(): void {
  cachedGiveaways = null;
  cachedSessionToken = null;
  lastFetchTime = 0;
}
