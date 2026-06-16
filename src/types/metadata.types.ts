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
