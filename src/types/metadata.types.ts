/**
 * ProtonDB community tier plus Steam Deck compatibility. Used by the
 * MetadataFetcher integration and the optional proton visibility UI.
 * Mirrors ProtonDB's public API shape (summaries endpoint) but is
 * structured so the rest of the app can consume a single stable object.
 */
export type ProtonDbTier =
  | "borked"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "pending"
  | "unsupported";

export type DeckCompatibilityLevel =
  | "verified"
  | "playable"
  | "unsupported"
  | "unknown";

export interface ProtonCompatibility {
  tier: ProtonDbTier | null;
  confidence: string | null;
  score: number | null;
  total: number | null;
  bestReportedTier: ProtonDbTier | null;
  trendingTier: ProtonDbTier | null;
  deckCompatibility: DeckCompatibilityLevel | null;
  url: string | null;
  fetchedAt: string | null;
}

export interface GameMetadata {
  title: string;
  description: string;
  shortDescription: string;
  releaseDate: string | null;
  developers: string[];
  publishers: string[];
  genres: string[];
  tags: string[];
  platform: string | null;
  supportedLanguages: string[];
  screenshots: Screenshot[];
  gridCovers: ImageAsset[];
  backgrounds: ImageAsset[];
  banners: ImageAsset[];
  steamReviewScore: number | null;
  ignReviewScore: number | null;
  metacriticScore: number | null;
  vndbRating: number | null;
  technicalInfo: TechnicalInfo | null;
  vndbData: VNData | null;
  /**
   * ProtonDB / Steam Deck compatibility snapshot. Only populated for
   * Steam shops today (ProtonDB only indexes Steam appIds); null
   * elsewhere.
   */
  protonCompatibility: ProtonCompatibility | null;
  sources: MetadataSources;
}

export interface Screenshot {
  id: string;
  thumbnailUrl: string;
  fullUrl: string;
  width: number;
  height: number;
}

export interface ImageAsset {
  id: string;
  url: string;
  width: number;
  height: number;
  source: "steamgriddb" | "steam" | "hydra";
  type: "grid" | "hero" | "logo" | "icon" | "background" | "banner";
}

export interface TechnicalInfo {
  resolutionSupport: string[];
  fpsCaps: number[];
  widescreenSupport: boolean;
  ultraWideSupport: boolean;
  hdrSupport: boolean;
  fourKSupport: boolean;
  controllerSupport: string;
  drmInfo: string;
  saveGameLocation: string;
  essentialFixes: FixGuide[];
  /**
   * Game engine name (e.g. "Unity", "Unreal Engine 5", "Source"). Mined
   * from PCGamingWiki's infobox via the parser; defaults to null when
   * no engine row is present.
   */
  engine: string | null;
}

export interface FixGuide {
  title: string;
  description: string;
  url: string;
}

export interface VNData {
  originalTitle: string;
  aliases: string[];
  length: string;
  rating: number;
  popularity: number;
  tags: VNTag[];
  coverImageUrl: string | null;
  screenshots: string[];
}

export interface VNTag {
  id: string;
  name: string;
  category: string;
  spoilerLevel: number;
}

export interface MetadataSources {
  title?: string;
  description?: string;
  shortDescription?: string;
  releaseDate?: string;
  developers?: string;
  publishers?: string;
  genres?: string;
  tags?: string;
  platform?: string;
  supportedLanguages?: string;
  screenshots?: string;
  gridCovers?: string;
  backgrounds?: string;
  banners?: string;
  ignReviewScore?: string;
  steamReviewScore?: string;
  metacriticScore?: string;
  vndbRating?: string;
  technicalInfo?: string;
  vndbData?: string;
  protonCompatibility?: string;
}

export type UserGameStatus =
  | "not_played"
  | "playing"
  | "on_hold"
  | "played"
  | "beaten"
  | "completed"
  | "abandoned"
  | "plan_to_play"
  | "none";

export interface MetadataSearchResult {
  title: string;
  objectId: string;
  shop: string;
  source: string;
  iconUrl: string | null;
  genres: string[];
  developers: string[];
  publishers: string[];
  tags?: string[];
  releaseYear: number | null;
  description: string;
  similarityScore: number;
}

export interface MetadataMergePreview {
  field: string;
  currentValue: string;
  newValue: string;
  source: string;
}
