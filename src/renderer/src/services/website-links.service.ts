import type { GameShop } from "@types";

export interface WebsiteLink {
  id: WebsiteId;
  name: string;
  iconId: WebsiteId;
  url: string;
  isEmbeddable: boolean;
}

export type WebsiteId =
  | "steam"
  | "steamdb"
  | "protondb"
  | "pcgamingwiki"
  | "twitch"
  | "nexusmods"
  | "moddb"
  | "gamefaqs"
  | "metacritic"
  | "howlongtobeat"
  | "igdb"
  | "youtube";

export const DEFAULT_WEBSITE_ORDER: WebsiteId[] = [
  "steam",
  "steamdb",
  "protondb",
  "pcgamingwiki",
  "twitch",
  "nexusmods",
  "moddb",
  "gamefaqs",
  "metacritic",
  "howlongtobeat",
  "igdb",
  "youtube",
];

const WEBSITE_META: Record<
  WebsiteId,
  { nameKey: string; isEmbeddable: boolean }
> = {
  steam: { nameKey: "steam", isEmbeddable: false },
  steamdb: { nameKey: "steamdb", isEmbeddable: true },
  protondb: { nameKey: "protondb", isEmbeddable: true },
  pcgamingwiki: { nameKey: "pcgamingwiki", isEmbeddable: true },
  twitch: { nameKey: "twitch", isEmbeddable: true },
  nexusmods: { nameKey: "nexusmods", isEmbeddable: true },
  moddb: { nameKey: "moddb", isEmbeddable: true },
  gamefaqs: { nameKey: "gamefaqs", isEmbeddable: false },
  metacritic: { nameKey: "metacritic", isEmbeddable: false },
  howlongtobeat: { nameKey: "howlongtobeat", isEmbeddable: true },
  igdb: { nameKey: "igdb", isEmbeddable: true },
  youtube: { nameKey: "youtube", isEmbeddable: true },
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanTitleForSearch(title: string): string {
  let cleaned = title;

  // Remove common edition/version strings (case-insensitive)
  const noisePatterns = [
    /\bgame\s+of\s+the\s+year\s+edition\b/i,
    /\bgoty\b/i,
    /\bcomplete\s+edition\b/i,
    /\bpremium\s+edition\b/i,
    /\bdefinitive\s+edition\b/i,
    /\bdeluxe\s+edition\b/i,
    /\bdigital\s+deluxe\b/i,
    /\bgold\s+edition\b/i,
    /\bspecial\s+edition\b/i,
    /\bdirector'?s\s+cut\b/i,
    /\benhanced\s+edition\b/i,
    /\blegendary\s+edition\b/i,
    /\banniversary\s+edition\b/i,
    /\bremastered\b/i,
    /\bultimate\s+edition\b/i,
  ];

  for (const pattern of noisePatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  // If there's a colon or a dash, usually the part before it is the main title.
  // E.g., "The Witcher 3: Wild Hunt" or "Cyberpunk 2077 - Phantom Liberty"
  // But we should only split if the first part is at least 3 characters.
  if (cleaned.includes(":") || cleaned.includes(" - ")) {
    const mainTitle = cleaned.split(/:\s*|\s+-\s*/)[0].trim();
    if (mainTitle.length >= 3) {
      cleaned = mainTitle;
    }
  }

  return cleaned.trim() || title;
}

export function buildWebsiteLinks(params: {
  objectId: string;
  shop: GameShop;
  gameTitle: string;
}): WebsiteLink[] {
  const { objectId, shop, gameTitle } = params;
  const cleanedTitle = cleanTitleForSearch(gameTitle);
  const encodedTitle = encodeURIComponent(cleanedTitle);
  const slug = slugify(cleanedTitle);
  const nexusSlug = cleanedTitle.toLowerCase().replace(/[^a-z0-9]/g, "");
  const isSteamGame = shop === "steam";

  const builders: Record<WebsiteId, () => string> = {
    steam: () =>
      isSteamGame
        ? `https://store.steampowered.com/app/${objectId}/`
        : `https://store.steampowered.com/search/?term=${encodedTitle}`,
    steamdb: () =>
      isSteamGame
        ? `https://steamdb.info/app/${objectId}/`
        : `https://steamdb.info/search/?a=app&q=${encodedTitle}`,
    protondb: () =>
      isSteamGame
        ? `https://www.protondb.com/app/${objectId}`
        : `https://www.protondb.com/search?q=${encodedTitle}`,
    pcgamingwiki: () =>
      isSteamGame
        ? `https://pcgamingwiki.com/api/appid.php?appid=${objectId}`
        : `https://www.pcgamingwiki.com/wiki/Special:Search?search=${encodedTitle}`,
    twitch: () => `https://www.twitch.tv/directory/category/${slug}`,
    nexusmods: () => `https://www.nexusmods.com/games/${nexusSlug}`,
    moddb: () => `https://www.moddb.com/games/${slug}`,
    gamefaqs: () => `https://gamefaqs.gamespot.com/search?q=${encodedTitle}`,
    metacritic: () => `https://www.metacritic.com/search/${encodedTitle}/`,
    howlongtobeat: () => `https://howlongtobeat.com/?q=${encodedTitle}`,
    igdb: () => `https://www.igdb.com/games/${slug}`,
    youtube: () =>
      `https://www.youtube.com/results?search_query=${encodedTitle}+gameplay`,
  };

  return DEFAULT_WEBSITE_ORDER.map((id) => {
    const meta = WEBSITE_META[id];
    return {
      id,
      name: meta.nameKey,
      iconId: id,
      url: builders[id](),
      isEmbeddable: meta.isEmbeddable,
    };
  });
}
