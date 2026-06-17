# Game Metadata Enhancement — Specification

## Overview

Comprehensive refactor of how game metadata is obtained, stored, and displayed. Introduces multi-source metadata merging (Hydra API + Steam + SteamGridDB + PCGamingWiki + IGN + VNDB), user-editable metadata fields, user status tags, improved HowLongToBeat integration, and a redesigned metadata editing experience within the game settings modal.

---

## 1. Metadata Source Architecture

### 1.1 Source Priority & Merging Strategy

All available metadata sources are queried **in parallel**, and results are **merged** into a unified metadata object. When multiple sources provide the same field, the priority is:

| Priority | Source       | Primary Data Provided                                   |
| -------- | ------------ | ------------------------------------------------------- |
| 1        | Hydra API    | Core game data (title, description, devs, publishers)   |
| 2        | Steam Store  | descriptions, genres, screenshots, release date, movies |
| 3        | SteamGridDB  | Cover art, hero images, icons, logos, grid covers       |
| 4        | PCGamingWiki | Technical specs, fix guides, compatibility data         |
| 5        | IGN          | Reviews, ratings, editorial descriptions                |
| 6        | VNDB         | Visual novel metadata (last resort for all games)       |

**Merging rules**:

- First non-null/non-empty value wins (Higher priority source takes precedence)
- Arrays (genres, developers, publishers, tags) are union-merged (all unique values combined)
- Images are best-quality-wins (highest resolution available)
- Sources are marked per-field for transparency

### 1.2 New Metadata Sources

#### SteamGridDB (`src/main/services/steamgriddb-api.ts` — NEW)

- **API**: https://www.steamgriddb.com/api/v2
- **Requires**: User-provided API key (configured in Settings → Integrations)
- **Data fetched**:
  - `grids` — Steam-style grid covers (460x215, 920x430, 600x900)
  - `heroes` — Hero/background images (1920x620, 3840x1240)
  - `logos` — Transparent game logos (various sizes)
  - `icons` — Square icons (various sizes)
- **Caching**: 24-hour TTL per game title → image search. Images cached to disk.
- **Rate limiting**: Respect API rate limits; key-based authentication.

#### PCGamingWiki (`src/main/services/pcgamingwiki-api.ts` — NEW)

- **API**: https://www.pcgamingwiki.com/w/api.php (MediaWiki API)
- **Data fetched**:
  - Technical specifications (resolution support, FPS caps, widescreen, 4K, HDR)
  - Fix/improvement guides (essential tweaks, skip intro videos)
  - Controller support details
  - Save game location info
  - DRM information
- **Matching**: Search by game title → parse MediaWiki page for structured data.

#### IGN Metadata (`src/main/services/ign-metadata.ts` — NEW)

- **API**: IGDB API (via Hydra backend) or IGN scraping
- **Data fetched**:
  - IGN review score/rating
  - Editorial summary/verdict
  - Community rating
- **Matching**: IGDB ID lookup from game title.

#### VNDB (`src/main/services/vndb-api.ts` — NEW)

- **API**: https://api.vndb.org/kana (REST API)
- **Activation**: Tried for all games as a last-resort fallback
- **Data fetched**:
  - VN title (original + English)
  - Developer/publisher (VN-specific)
  - Release date
  - Length estimate (very short → very long)
  - Rating (Bayesian)
  - Tags (VN categories/contents)
  - Cover image
- **Matching**: Search by title → match by closest Levenshtein distance.

#### Steam Tags Importer (`src/main/services/steam-tags-importer.ts` — NEW)

- **API**: Steam Store web scraping or internal Steam API
- **Data fetched**: User-defined tags (e.g., "Roguelike", "Open World", "Cute", "Difficult")
- **Storage**: Merged into the game's tags alongside other metadata tags.

### 1.3 Unified Metadata Fetcher (`src/main/services/metadata-fetcher.ts` — NEW)

```
MetadataFetcher.fetchAll(gameTitle, shop, objectId) → UnifiedMetadata
├── Hydra API (existing route already provides shopDetails)
├── SteamGridDB.fetchImages(title) → ImageAsset[]
├── PCGamingWiki.fetchTechnicalInfo(title) → TechnicalInfo
├── IGN.fetchReview(title) → ReviewData
├── VNDB.fetchVNData(title) → VNData
└── SteamTags.fetchTags(objectId) → string[]
```

- **Parallel execution**: All sources fire simultaneously via `Promise.allSettled()`.
- **Graceful degradation**: Individual source failures don't block the rest.
- **Caching**: In-memory LRU cache (100 entries, 5-min TTL) + LevelDB persistence layer.
- **Throttling**: Per-source request debouncing (300ms).

---

## 2. Data Model Changes

### 2.1 Extended Game Metadata (`src/types/metadata.types.ts` — NEW)

```ts
export interface GameMetadata {
  /** Basic info */
  title: string;
  description: string;
  shortDescription: string;
  releaseDate: string | null;

  /** People / Studios */
  developers: string[];
  publishers: string[];

  /** Classification */
  genres: string[];
  tags: string[];
  platform: string | null;
  supportedLanguages: string[];

  /** Images (beyond existing icon/logo/hero) */
  screenshots: Screenshot[];
  gridCovers: ImageAsset[];
  backgrounds: ImageAsset[];
  banners: ImageAsset[];

  /** Ratings */
  steamReviewScore: number | null;
  ignReviewScore: number | null;
  metacriticScore: number | null;
  vndbRating: number | null;

  /** Technical (PCGamingWiki) */
  technicalInfo: TechnicalInfo | null;

  /** VNDB data */
  vndbData: VNData | null;

  /** Source tracking per field */
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
  length: string; // "very_short" | "short" | "medium" | "long" | "very_long"
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
  title?: string; // source name
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
  technicalInfo?: string;
  vndbData?: string;
}
```

### 2.2 User Status Tags

New fields added to the `Game` interface in `src/types/level.types.ts`:

```ts
export type UserGameStatus =
  | "playing"
  | "on_hold"
  | "completed"
  | "to_play"
  | "abandoned"
  | "none";

// Added to Game interface:
export interface Game {
  // ... existing fields ...
  userStatus?: UserGameStatus | null;
  userStatusUpdatedAt?: Date | null;
}
```

### 2.3 Extended LevelDB Schema

New sublevel: `metadata_cache` — stores fetched metadata keyed by `{shop}:{objectId}`.

```
metadata_cache  → Key: "steam:12345" → Value: GameMetadata (JSON)
```

### 2.4 HowLongToBeat Extended Types

Extended `HowLongToBeatCategory` in `src/types/how-long-to-beat.types.ts`:

```ts
export interface HowLongToBeatCategory {
  title: string; // "Main Story", "Main + Extra", "Completionist"
  duration: string; // "40 Hours"
  accuracy: string; // "00"
}

export interface HowLongToBeatGameData {
  id: number;
  name: string;
  categories: HowLongToBeatCategory[];
  reviewScore: number;
  platforms: string[];
  imageUrl: string | null;
  similarityScore: number; // How well the match is (0-1)
}

export interface HowLongToBeatProgress {
  category: string; // "Main Story"
  userPlaytimeSeconds: number;
  estimatedSeconds: number;
  progressPercent: number; // 0-100
  remainingSeconds: number;
}
```

---

## 3. Game Page Changes

### 3.1 Overview Tab — Metadata Chips Row

**Location**: Between dashboard cards grid and the Description card.

New component: `MetadataChipsRow` (`src/renderer/src/pages/game-details/dashboard-cards/metadata-chips-row.tsx` — NEW)

Displays a horizontal row of styled chips:

```
[🎮 Action] [🎮 RPG] [🎮 Open World] | [👨‍💻 CD Projekt Red] | [🏢 CD Projekt] | [📅 2020]
```

- Genres: pill-shaped chips with distinct accent colors (each genre gets a color from a palette)
- Developers: slightly transparent chip with person icon
- Publishers: slightly transparent chip with building icon
- Release Year: subtle chip
- Tags: smaller, more compact chips (lower opacity)

### 3.2 Stats Card — User Status Integration

**Modify**: `StatsCard` component (`src/renderer/src/pages/game-details/dashboard-cards/stats-card.tsx`)

Add a **user status display** at the top of the Stats card:

- Shows current status as a prominent badge with icon
- Clicking opens a dropdown/popover to change status
- Status options with icons:
  - 🟢 **Playing** — Currently playing
  - 🟡 **On Hold** — Paused/taking a break
  - ✅ **Completed** — Finished the game
  - 📋 **To Play** — Planned to play
  - ❌ **Abandoned** — Dropped the game

### 3.3 HowLongToBeat Card — Progress Tracking

**Modify**: `HowLongToBeatCard` component (`src/renderer/src/pages/game-details/dashboard-cards/how-long-to-beat-card.tsx`)

Add progress visualization:

- For each HLTB category, show a thin progress bar beneath the duration
- Progress = `userPlaytime / estimatedTime * 100` (capped at 100%)
- Color gradient: teal (0%) → amber (50%) → green (100%)
- "Submit playtime" button (icon-only, subtle) that submits to HLTB

New sub-component: `HLTBProgressBar` — thin animated progress bar beneath each duration.

---

## 4. Metadata Modal Redesign

### 4.1 Category Rename

- Rename the existing "assets" category to **"metadata"**
- Icon: Keep the existing `ImageIcon` or switch to a document/info icon
- Translation key: `"settings_category_metadata"`

### 4.2 Sub-Tab Structure

The metadata panel uses **3 sub-tabs** (internal to the panel, not the sidebar categories):

| Sub-tab | Name        | Content                                                     |
| ------- | ----------- | ----------------------------------------------------------- |
| 1       | **Images**  | Existing image editing (icon, logo, hero) + new image types |
| 2       | **Details** | All text metadata fields (editable)                         |
| 3       | **Tags**    | Genre, user tags, status management                         |

#### Images Sub-tab

- **Expanded** from current `GameAssetsSettings`:
  - Icon (existing)
  - Logo (existing)
  - Hero (existing)
  - **NEW**: Grid covers (SteamGridDB)
  - **NEW**: Backgrounds
  - **NEW**: Banners
  - **NEW**: Screenshots (gallery view, click to set as hero/background)
- Each image type has: preview, browse button, search button (fetches from SteamGridDB + Hydra), reset to default
- "Auto-fetch all" button fetches images for all types from SteamGridDB

#### Details Sub-tab

- **Form fields** (all editable):
  - Title (text input)
  - Short description (text area, 2 rows)
  - Full description (text area, 6 rows, rich text?)
  - Developers (tag input — type and press Enter to add)
  - Publishers (tag input)
  - Release date (date picker or text input)
  - Platform (dropdown: Windows, macOS, Linux, etc.)
  - Supported languages (multi-select or tag input)
- **Save button** at the bottom
- **Revert to original** link per field (when metadata was fetched from a source)

#### Tags Sub-tab

- **Genre chips**: Toggle on/off from available genres
- **Custom tags**: Tag input to add/remove custom tags
- **User status**: Dropdown with all status options
- **Add suggested tags** button: fetches tags from Steam/IGDB for this game

### 4.3 Metadata Search Overlay

**Existing**: `MetadataSearchModal` — currently only updates title + icon for custom games.
**Refactored**: Becomes a comprehensive metadata search tool.

#### Search UI

- **Per-source tabs** at the top: Hydra | Steam | SteamGridDB | IGDB | VNDB
- Search bar queries the selected source
- Results show: game title, source, preview of key metadata (genres, year, dev)
- Selecting a result opens a **diff preview** overlay

#### Selective Merge Preview (Diff Overlay)

- Shows two columns: "Current" vs "Found"
- Each metadata field is listed with:
  - **Checkbox** to include/exclude from merge
  - Current value (or "—" if empty)
  - Found value (highlighted in green/yellow)
  - Source indicator (e.g., "from SteamGridDB")
- **"Apply Selected"** button updates only checked fields
- **"Apply All"** button for fast full merge
- **"Cancel"** to discard

#### Images from Search

- When searching SteamGridDB, results show **image grids** (not just metadata text)
- User can select individual images to apply to specific slots (icon, hero, etc.)
- Preview shows image at full resolution before applying

### 4.4 Layout Architecture

```
Game Options Modal
├── Sidebar Categories
│   ├── General
│   ├── Locations
│   ├── Metadata       ← renamed from "assets"
│   ├── Hydra Cloud
│   ├── Compatibility
│   ├── Downloads
│   └── Danger Zone
└── Panel (varies per category)
    └── [Metadata Panel]
        ├── Search Bar + "Search Metadata" button
        ├── Sub-tab Bar: [ Images | Details | Tags ]
        ├── Sub-tab Content
        └── Metadata Search Overlay (modal on top)
```

---

## 5. HowLongToBeat Improvements

### 5.1 Better Game Matching

**Current**: The Hydra API handles matching. Client just displays results.

**Improvement**: Add client-side fallback matching when API returns no results:

- Clean game title (remove editions, platform suffixes)
- Try alternative titles from `alternateNames` if available
- Levenshtein distance fuzzy matching with HLTB search results
- VNDB fallback: for games with VN data, use VN title for HLTB search

### 5.2 Progress Tracking

Show how close the user is to each HLTB completion category:

```
Main Story      40 Hours    ████████████░░░░░░░░ 45%
Main + Extra    55 Hours    ████████░░░░░░░░░░░░ 33%
Completionist   80 Hours    ██████░░░░░░░░░░░░░░ 23%
```

**Calculation**: `userPlaytimeSeconds / estimatedTimeSeconds * 100`

- Parsed from HLTB "X Hours" or "X Mins" strings
- Capped at 100% (complete)

### 5.3 Playtime Submission to HLTB

"Submit playtime" button on the HLTB card:

- **Visible only when**: user is logged in to Hydra (cloud sync not required)
- **Flow**: User clicks → confirmation dialog → Hydra API proxy submits to HLTB
- **Requires**: Backend endpoint `POST /games/:shop/:objectId/hltb/submit` that bridges to HLTB

---

## 6. User Status Tags Implementation

### 6.1 Storage

- **LevelDB**: Added to `Game` schema in `games` sublevel
- **Fields**: `userStatus: UserGameStatus | null`, `userStatusUpdatedAt: Date | null`
- **Local only**: Not synced via Hydra Cloud

### 6.2 UI

- **Set status**: From Stats card dropdown (on game page)
- **Display**: In Stats card as a colored badge + in library game cards (future)
- **Status colors**:
  - Playing: `#16b195` (brand teal)
  - On Hold: `#d4a853` (amber)
  - Completed: `#2ecc71` (green)
  - To Play: `#3498db` (blue)
  - Abandoned: `#95a5a6` (gray)

### 6.3 IPC Events

- `setGameUserStatus(shop, objectId, status)` → updates status in LevelDB
- Status is read as part of existing `game` data from LevelDB

---

## 7. Playtime Editing

### 7.1 Keep Current UX

- The existing `ChangeGamePlaytimeModal` with hours + minutes inputs is preserved
- No changes to the playtime editing flow
- The modal remains accessible from the Danger Zone section

---

## 8. Implementation Phases

### Phase 1: Backend — Metadata Sources

| #   | Task                                    | File(s)                                                     |
| --- | --------------------------------------- | ----------------------------------------------------------- |
| 1   | Create `steamgriddb-api.ts` service     | `src/main/services/steamgriddb-api.ts` (NEW)                |
| 2   | Create `pcgamingwiki-api.ts` service    | `src/main/services/pcgamingwiki-api.ts` (NEW)               |
| 3   | Create `ign-metadata.ts` service        | `src/main/services/ign-metadata.ts` (NEW)                   |
| 4   | Create `vndb-api.ts` service            | `src/main/services/vndb-api.ts` (NEW)                       |
| 5   | Create `steam-tags-importer.ts` service | `src/main/services/steam-tags-importer.ts` (NEW)            |
| 6   | Create unified `metadata-fetcher.ts`    | `src/main/services/metadata-fetcher.ts` (NEW)               |
| 7   | Create metadata cache sublevel          | `src/main/level/sublevels/metadata-cache.ts` (NEW)          |
| 8   | Add IPC handlers for metadata fetching  | `src/main/events/metadata/*.ts` (NEW)                       |
| 9   | Add preload + declaration bindings      | `src/preload/index.ts`, `src/renderer/src/declaration.d.ts` |

### Phase 2: Data Model

| #   | Task                                 | File(s)                               |
| --- | ------------------------------------ | ------------------------------------- |
| 10  | Add metadata types                   | `src/types/metadata.types.ts` (NEW)   |
| 11  | Add `userStatus` field to Game       | `src/types/level.types.ts`            |
| 12  | Extend HLTB types                    | `src/types/how-long-to-beat.types.ts` |
| 13  | Add settings for SteamGridDB API key | UserPreferences type, settings UI     |

### Phase 3: Game Page UI

| #   | Task                                  | File(s)                                                                            |
| --- | ------------------------------------- | ---------------------------------------------------------------------------------- |
| 14  | Create `MetadataChipsRow` component   | `src/renderer/src/pages/game-details/dashboard-cards/metadata-chips-row.tsx` (NEW) |
| 15  | Integrate chips row into Overview tab | `src/renderer/src/pages/game-details/tabs/overview-tab.tsx`                        |
| 16  | Add user status to Stats card         | `src/renderer/src/pages/game-details/dashboard-cards/stats-card.tsx`               |
| 17  | Add HLTB progress bars to HLTB card   | `src/renderer/src/pages/game-details/dashboard-cards/how-long-to-beat-card.tsx`    |
| 18  | Add HLTB submit button                | `src/renderer/src/pages/game-details/dashboard-cards/how-long-to-beat-card.tsx`    |

### Phase 4: Metadata Modal Redesign

| #   | Task                                          | File(s)                                |
| --- | --------------------------------------------- | -------------------------------------- |
| 19  | Rename "assets" → "metadata" category         | `game-options-modal.tsx`, translations |
| 20  | Create sub-tab bar component                  | `metadata-sub-tabs.tsx` (NEW)          |
| 21  | Create Images sub-tab (extend existing)       | Extend `game-assets-settings.tsx`      |
| 22  | Create Details sub-tab form                   | `metadata-details-form.tsx` (NEW)      |
| 23  | Create Tags sub-tab                           | `metadata-tags-form.tsx` (NEW)         |
| 24  | Refactor MetadataSearchModal with source tabs | `metadata-search-modal.tsx`            |
| 25  | Create diff/merge preview overlay             | `metadata-merge-preview.tsx` (NEW)     |

### Phase 5: HowLongToBeat Improvements

| #   | Task                                 | File(s)                                |
| --- | ------------------------------------ | -------------------------------------- |
| 26  | Client-side fallback matching        | `how-long-to-beat-card.tsx` / new hook |
| 27  | Progress calculation utilities       | `src/shared/hltb-utils.ts` (NEW)       |
| 28  | VNDB fallback for HLTB matching      | `vndb-api.ts`                          |
| 29  | Backend endpoint for HLTB submission | `src/main/events/`                     |
| 30  | Submit button UI                     | `how-long-to-beat-card.tsx`            |

### Phase 6: User Status Tags

| #   | Task                                     | File(s)                                                 |
| --- | ---------------------------------------- | ------------------------------------------------------- |
| 31  | Add `userStatus` to Game type            | `src/types/level.types.ts`                              |
| 32  | IPC handler for setting status           | `src/main/events/library/set-game-user-status.ts` (NEW) |
| 33  | Status dropdown in Stats card            | `stats-card.tsx`                                        |
| 34  | Status display in library cards (future) | Library card components                                 |

### Phase 7: Polish & Integration

| #   | Task                             | File(s)                                    |
| --- | -------------------------------- | ------------------------------------------ |
| 35  | i18n keys for all new UI         | `src/locales/en/translation.json` + others |
| 36  | SCSS for all new components      | Various `.scss` files                      |
| 37  | SteamGridDB API key settings UI  | Settings page                              |
| 38  | Typecheck + lint + test          | Project-wide                               |
| 39  | Code review + edge case handling | All new/modified files                     |

---

## 9. Files Summary

### New Files

| File                                                                          | Purpose                                      |
| ----------------------------------------------------------------------------- | -------------------------------------------- |
| `src/main/services/steamgriddb-api.ts`                                        | SteamGridDB API client for image fetching    |
| `src/main/services/pcgamingwiki-api.ts`                                       | PCGamingWiki MediaWiki API client            |
| `src/main/services/ign-metadata.ts`                                           | IGN metadata fetcher                         |
| `src/main/services/vndb-api.ts`                                               | VNDB REST API client                         |
| `src/main/services/steam-tags-importer.ts`                                    | Steam tags scraper                           |
| `src/main/services/metadata-fetcher.ts`                                       | Unified metadata orchestration               |
| `src/main/level/sublevels/metadata-cache.ts`                                  | Metadata cache sublevel                      |
| `src/main/events/metadata/fetch-game-metadata.ts`                             | IPC handler for metadata fetching            |
| `src/main/events/metadata/search-metadata.ts`                                 | IPC handler for metadata search              |
| `src/main/events/library/set-game-user-status.ts`                             | IPC handler for user status                  |
| `src/types/metadata.types.ts`                                                 | Extended metadata type definitions           |
| `src/shared/hltb-utils.ts`                                                    | HLTB duration parsing and progress utilities |
| `src/renderer/src/pages/game-details/dashboard-cards/metadata-chips-row.tsx`  | Metadata chips row component                 |
| `src/renderer/src/pages/game-details/dashboard-cards/metadata-chips-row.scss` | Chips row styles                             |
| `src/renderer/src/pages/game-details/modals/metadata-sub-tabs.tsx`            | Sub-tab bar for metadata panel               |
| `src/renderer/src/pages/game-details/modals/metadata-details-form.tsx`        | Details form for metadata editing            |
| `src/renderer/src/pages/game-details/modals/metadata-tags-form.tsx`           | Tags form for metadata editing               |
| `src/renderer/src/pages/game-details/modals/metadata-merge-preview.tsx`       | Diff/preview overlay for metadata merge      |

### Modified Files

| File                                                                            | Changes                                              |
| ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `src/types/level.types.ts`                                                      | Add `userStatus`, `userStatusUpdatedAt` to `Game`    |
| `src/types/how-long-to-beat.types.ts`                                           | Add `HowLongToBeatGameData`, `HowLongToBeatProgress` |
| `src/types/index.ts`                                                            | Export new metadata types                            |
| `src/preload/index.ts`                                                          | Add new IPC bridge methods                           |
| `src/renderer/src/declaration.d.ts`                                             | Add new type declarations                            |
| `src/renderer/src/components/metadata-search-modal/metadata-search-modal.tsx`   | Major refactor: source tabs + merge preview          |
| `src/renderer/src/pages/game-details/modals/game-options-modal.tsx`             | Rename assets→metadata, wire new sub-tabs            |
| `src/renderer/src/pages/game-details/modals/game-assets-settings.tsx`           | Extend for additional image types                    |
| `src/renderer/src/pages/game-details/tabs/overview-tab.tsx`                     | Integrate MetadataChipsRow                           |
| `src/renderer/src/pages/game-details/dashboard-cards/stats-card.tsx`            | Add user status display + dropdown                   |
| `src/renderer/src/pages/game-details/dashboard-cards/how-long-to-beat-card.tsx` | Add progress bars + submit button                    |
| `src/renderer/src/pages/game-details/sidebar/sidebar.tsx`                       | Minor: pass metadata context                         |
| `src/renderer/src/context/game-details/game-details.context.types.ts`           | Add metadata to context                              |
| `src/renderer/src/services/website-links.service.ts`                            | Possibly updated                                     |
| `src/main/level/sublevels/index.ts`                                             | Export new metadata-cache sublevel                   |
| `src/main/events/index.ts`                                                      | Register new event handlers                          |
| `src/locales/en/translation.json`                                               | Add all new translation keys                         |
| Settings page                                                                   | Add SteamGridDB API key field                        |

---

## 10. Edge Cases

| Scenario                                          | Expected Behavior                                                     |
| ------------------------------------------------- | --------------------------------------------------------------------- |
| SteamGridDB API key not configured                | SteamGridDB tab shows "API key required" prompt with link to settings |
| PCGamingWiki returns no page                      | Gracefully empty `technicalInfo`                                      |
| VNDB finds no match                               | Returns null; no error shown                                          |
| Multiple sources return conflicting data          | Higher-priority source wins; sources tracked per field                |
| User rapidly switches games                       | Pending metadata fetches are aborted via AbortController              |
| Metadata cache stale (> 24h)                      | Background refresh; shows cached data while fetching                  |
| Network offline during metadata fetch             | Sources fail silently; whatever was fetched is used                   |
| Custom game with no matching catalogue entry      | Metadata search still works; results from external sources            |
| Game title has special characters                 | URL-encoded in all API calls; cleaned for search matching             |
| Very large image download (SteamGridDB)           | Stream to disk; show progress; timeout after 30s                      |
| User imports custom game, then links to catalogue | Metadata sources update to use catalogue data as primary              |

---

## 11. Translation Keys (New)

```json
{
  "game_details": {
    "settings_category_metadata": "Metadata",
    "metadata_subtab_images": "Images",
    "metadata_subtab_details": "Details",
    "metadata_subtab_tags": "Tags",
    "metadata_search_title": "Search Metadata",
    "metadata_search_placeholder": "Search for a game...",
    "metadata_merge_title": "Apply Metadata",
    "metadata_merge_preview": "Review changes before applying",
    "metadata_merge_apply_selected": "Apply Selected",
    "metadata_merge_apply_all": "Apply All",
    "metadata_merge_cancel": "Cancel",
    "metadata_source_hydra": "Hydra",
    "metadata_source_steam": "Steam",
    "metadata_source_steamgriddb": "SteamGridDB",
    "metadata_source_igdb": "IGDB",
    "metadata_source_vndb": "VNDB",
    "metadata_field_title": "Title",
    "metadata_field_description": "Description",
    "metadata_field_short_description": "Short Description",
    "metadata_field_developers": "Developers",
    "metadata_field_publishers": "Publishers",
    "metadata_field_genres": "Genres",
    "metadata_field_tags": "Tags",
    "metadata_field_release_date": "Release Date",
    "metadata_field_platform": "Platform",
    "metadata_field_languages": "Languages",
    "metadata_grid_covers": "Grid Covers",
    "metadata_backgrounds": "Backgrounds",
    "metadata_banners": "Banners",
    "metadata_screenshots": "Screenshots",
    "metadata_auto_fetch_all": "Auto-fetch All Images",
    "metadata_revert_to_original": "Revert to original",
    "status_playing": "Playing",
    "status_on_hold": "On Hold",
    "status_completed": "Completed",
    "status_to_play": "To Play",
    "status_abandoned": "Abandoned",
    "status_none": "No Status",
    "status_change": "Change Status",
    "hltb_progress": "Progress",
    "hltb_submit_playtime": "Submit Playtime",
    "hltb_submit_confirm": "Submit your playtime to HowLongToBeat?",
    "hltb_submitted": "Playtime submitted!",
    "griddb_api_key_required": "SteamGridDB API key required",
    "griddb_configure_in_settings": "Configure in Settings → Integrations",
    "metadata_tags_suggested": "Suggested Tags",
    "metadata_tags_add_suggestion": "Add",
    "metadata_tags_custom": "Custom Tags",
    "metadata_tags_add_custom": "Type and press Enter to add"
  },
  "settings": {
    "integrations": "Integrations",
    "steamgriddb_api_key": "SteamGridDB API Key",
    "steamgriddb_api_key_description": "Required for fetching game covers, heroes, and icons from SteamGridDB. Get your key at steamgriddb.com."
  }
}
```

---

## 12. Non-Goals (Out of Scope)

- No changes to Big Picture mode metadata display
- No auto-sync of custom metadata across devices
- No batch metadata editing for multiple games at once
- No metadata scraping from sources requiring login (besides API keys)
- No AI-generated game descriptions or tags
- No integration with Goodreads, IMDb, or other non-gaming metadata sources
- No changes to the download/repacks system
- No changes to achievement tracking

---

## 13. Design Principles

1. **Hydra-first**: The Hydra API is always the primary source; fallbacks fill gaps.
2. **User control**: Users choose which metadata to apply and can always revert.
3. **Performance**: All source queries happen in parallel; caching minimizes repeat fetches.
4. **Graceful degradation**: Failure of any single source never blocks the others.
5. **Visual cohesion**: All new UI elements follow existing design language (glass cards, 12px radius, muted colors).
6. **Progressive disclosure**: Complex metadata editing is behind sub-tabs; simple status changes are one click.
