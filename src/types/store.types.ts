import type { GameShop } from "./game.types";

/**
 * Represents a game owned or installed from an external store platform.
 */
export interface StoreGame {
  storeGameId: string;
  title: string;
  slug?: string;
  coverImageUrl?: string | null;
  backgroundImageUrl?: string | null;
  description?: string | null;
  developers?: string[];
  publishers?: string[];
  releaseDate?: string | null;
  genres?: string[];
  isOwned: boolean;
  isInstalled?: boolean;
  installPath?: string | null;
  executablePath?: string | null;
  launchArgs?: string[];
  storeUrl?: string | null;
  extraData?: Record<string, unknown>;
}

/**
 * Represents an authenticated store account.
 */
export interface StoreAccount {
  storeId: StoreId;
  displayName: string;
  email?: string;
  avatarUrl?: string | null;
  accountId: string;
  isAuthenticated: boolean;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiry?: number;
  extraData?: Record<string, unknown>;
}

/**
 * Result of an authentication attempt.
 */
export interface AuthResult {
  success: boolean;
  account?: StoreAccount;
  error?: string;
}

/**
 * Result of a library sync operation.
 */
export interface SyncResult {
  success: boolean;
  gamesSynced: number;
  error?: string;
}

/**
 * Supported store identifiers for non-Steam platform integrations.
 */
export type StoreId = Exclude<
  GameShop,
  "steam" | "custom" | "launchbox" | "rockstar" | "itch-io"
>;

/**
 * All supported store platform IDs.
 */
export const STORE_IDS: StoreId[] = [
  "epic",
  "gog",
  "battle-net",
  "amazon",
  "ubisoft",
  "ea",
  "xbox",
  "humble",
];

/**
 * Runtime status of a connected store.
 */
export interface StoreStatus {
  storeId: StoreId;
  storeName: string;
  storeIcon: string;
  isAuthenticated: boolean;
  isExpired: boolean;
  lastSync?: number;
  gameCount: number;
  isSyncing: boolean;
  syncingError?: string;
}

/**
 * A store game bundled with its storeId (used for unified views).
 */
export interface StoreGameWithStore extends StoreGame {
  storeId: StoreId;
}

/**
 * Supported authentication methods for store platforms.
 */
export type AuthMethod = "oauth" | "credentials" | "browser" | "client";

/**
 * Metadata for a store platform (used in UI).
 */
export interface StoreDefinition {
  id: StoreId;
  name: string;
  icon: string;
  color: string;
  accentColor: string;
  description: string;
  authMethod: AuthMethod;
}
