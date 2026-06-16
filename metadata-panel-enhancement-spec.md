# Metadata Panel Enhancement — Specification

## Overview

Redesign the "Metadata" category in the game settings modal (`game-options-modal.tsx`) to be a full-featured metadata editor inspired by Playnite's Game Edit dialog. The panel provides inline editing of all text metadata fields, a multi-source image search engine, a game status dropdown, and a "Download Metadata" search flow with selective field merging.

---

## Current State

### What exists today

- **Metadata category** in game-options-modal shows `GameAssetsSettings` (icon/logo/hero image search via Google Images) + a "Search Metadata" button that opens `MetadataSearchModal`
- **MetadataSearchModal** has source tabs (Hydra/Steam/IGDB/VNDB), searches the Hydra catalogue API, shows a result list with limited preview (genres, devs, publishers, description snippet), and applies only title+icon
- **StatsCard** has a user status dropdown (from previous implementation)
- **metadata-cache** LevelDB sublevel exists but is unused in the current flow
- **metadata-fetcher.ts** orchestrates SteamGridDB, PCGamingWiki, VNDB, IGN, Steam Tags — but these services aren't wired into the UI
- **Image search** uses Google Image Scraper only (`google-image-scraper.ts`)

### Limitations

1. No inline text metadata editing — only image management
2. Metadata search only applies title+icon, ignoring genres, devs, publishers, description
3. Metadata search uses only Hydra catalogue API, not the dedicated metadata services
4. Image search is Google-only; no SteamGridDB, IGDB, or Steam CDN
5. Auto-fetch picks first result blindly
6. Status dropdown only on overview tab, not in settings where it belongs contextually
7. No caching of fetched metadata for offline/perf

---

## Design Decisions

### Layout: Playnite-style sub-tabs

The metadata panel splits into two sub-tabs, both always accessible:

- **General**: All text metadata fields (title, description, release date, platform, genres, developers, publishers, tags) + game status dropdown + "Download Metadata" button
- **Media**: Image search/editor for icon, logo, hero (the existing `GameAssetsSettings` enhanced with multi-source search)

### Image search: 4 sources with tabs

- **SteamGridDB**: High-quality custom covers, heroes, logos, icons (requires API key in settings)
- **IGDB**: Official game media (screenshots, covers)
- **Steam CDN**: Official Steam store assets
- **Google Images**: Broad fallback

Each source has its own tab in the Media sub-tab. User picks source → searches → sees grid of thumbnails → previews → applies.

### Status dropdown: Playnite set + Abandoned

Not Played, Playing, On Hold, Played, Beaten, Completed, Abandoned, Plan to Play.
Positioned prominently at the top of the General sub-tab.
Stored as `userStatus` field on the Game record in LevelDB.

### Metadata storage: Game record (LevelDB)

New fields added to the `Game` interface:

- `description?: string | null`
- `genres?: string[] | null`
- `developers?: string[] | null`
- `publishers?: string[] | null`
- `tags?: string[] | null`
- `releaseDate?: string | null` (ISO date string)
- `userStatus?: UserGameStatus | null`
- `userStatusUpdatedAt?: string | null`

These persist directly in the game's LevelDB record. No separate sublevel needed.

### Save behavior: Explicit Save button + toast

All metadata changes batch-save when the user clicks "Save Changes". A success toast confirms. Modified fields get a subtle highlight until saved. Title editing follows the same batch-save pattern within the metadata panel (separate from the General settings tab title field).

### Tag input: Chip/tag with suggestions

Genres, developers, publishers, and tags use a chip-based input:

- Type to see filtered suggestions (from existing values across the library)
- Press Enter/Tab to add the chip
- Click X on a chip to remove it
- Suggestion dropdown appears below the input

### Metadata search flow: Picker → Preview → Merge → Edit

1. User clicks "Download Metadata" button in the General sub-tab
2. Modal opens with source tabs (Hydra/Steam/IGDB/VNDB/SteamGridDB)
3. User searches within the selected source
4. Results show in a list with full metadata preview (not just title+icon)
5. User selects a result → preview panel shows all fields with **per-field checkboxes**
6. User checks which fields to apply, clicks "Apply Selected"
7. Fields populate the General tab form
8. User can manually edit any field before clicking "Save Changes"

### Caching: Aggressive with refresh

- Metadata fetched from external sources caches in the existing `metadata-cache` LevelDB sublevel
- Cache TTL: 7 days
- Cached data shows immediately with a "Cached" label + "Refresh" button
- Images cache locally after download

### API key: Global Settings page

SteamGridDB API key is configured in Hydra's main Settings → "Metadata Sources" section.
If key is missing and user selects SteamGridDB tab, a contextual prompt appears.

---

## Phase 1: Data Model & Storage

### 1.1 Extend Game interface (LevelDB)

**File**: `src/types/level.types.ts` and `src/types/metadata.types.ts`

Add fields to `Game`:

```ts
description?: string | null;
genres?: string[] | null;
developers?: string[] | null;
publishers?: string[] | null;
tags?: string[] | null;
releaseDate?: string | null; // ISO 8601 date string
userStatus?: UserGameStatus | null;
userStatusUpdatedAt?: string | null;
```

### 1.2 Update UserGameStatus enum

Ensure `UserGameStatus` type includes all Playnite+Abandoned values:

```ts
export type UserGameStatus =
  | "not_played"
  | "playing"
  | "on_hold"
  | "played"
  | "beaten"
  | "completed"
  | "abandoned"
  | "plan_to_play";
```

### 1.3 Create save-game-metadata IPC handler

**New file**: `src/main/events/library/save-game-metadata.ts`

- Accepts: `{ shop, objectId, metadata: Partial<GameMetadataFields> }`
- Reads current Game record, merges metadata fields, writes back
- Validates: shop+objectId must exist in games sublevel
- Returns updated Game record

### 1.4 Register IPC event

Add `"saveGameMetadata"` to `src/main/events/index.ts`, `src/preload/index.ts`, `src/renderer/src/declaration.d.ts`

---

## Phase 2: Image Search Engine (Multi-Source)

### 2.1 Create SteamGridDB image search method

**File**: `src/main/services/steamgriddb-api.ts` (extend existing)

- Add method: `searchImages(gameName: string, type: "icon" | "logo" | "hero" | "grid" | "banner"): Promise<AssetSearchResult[]>`
- Calls SteamGridDB `/search/autocomplete/{gameName}` then `/grids/{gameId}?dimensions=...` for each type
- Respects API key from levelDB user preferences
- Returns standardized `AssetSearchResult[]`

### 2.2 Create IGDB image search service

**New file**: `src/main/services/igdb-image-search.ts`

- Uses Hydra API as proxy (IGDB requires OAuth2)
- Calls `/catalogue/igdb/images?query=&type=`
- Maps to standardized `AssetSearchResult[]`

### 2.3 Create Steam CDN image search service

**New file**: `src/main/services/steam-cdn-image-search.ts`

- Uses existing Steam app details to extract image URLs
- Falls back to known CDN patterns: `https://cdn.cloudflare.steamstatic.com/steam/apps/{appId}/...`
- Returns standardized `AssetSearchResult[]`

### 2.4 Create unified image search IPC handler

**New file**: `src/main/events/catalogue/search-game-assets-multi.ts`

- Accepts: `{ gameTitle, assetType, source: "steamgriddb" | "igdb" | "google" | "steamcdn" }`
- Routes to appropriate service
- Merges results from multiple sources when `source` is "all"
- Caches results in metadata-cache sublevel (TTL 7 days)
- Returns `SearchGameAssetsResponse`

### 2.5 Register IPC event

Add `"searchGameAssetsMulti"` to events, preload, declarations

---

## Phase 3: Game Status Management

### 3.1 Create game status dropdown component

**New file**: `src/renderer/src/components/game-status-dropdown/game-status-dropdown.tsx`

- Props: `{ value: UserGameStatus | null, onChange: (status: UserGameStatus) => void, disabled?: boolean }`
- Renders a styled `<select>` or custom dropdown with status labels and color-coded indicator dots
- Statuses with labels and colors:
  - `not_played` → grey
  - `playing` → green (active)
  - `on_hold` → yellow/amber
  - `played` → blue
  - `beaten` → teal
  - `completed` → gold
  - `abandoned` → red
  - `plan_to_play` → purple

### 3.2 Create game-status-dropdown.scss

**New file**: styles for the dropdown component

### 3.3 Export from components index

Add to `src/renderer/src/components/index.ts`

---

## Phase 4: Metadata Panel — General Sub-Tab

### 4.1 Create metadata-general-section component

**New file**: `src/renderer/src/pages/game-details/modals/game-options-modal/metadata-general-section.tsx`

- Props: `{ game: LibraryGame, onMetadataChanged: () => void }`

Layout (top to bottom):

1. **Game Status dropdown** (prominent, full-width)
2. **Title field** (TextField, pre-filled with game.title)
3. **Release Date field** (TextField with type="date" or text, pre-filled)
4. **Description field** (TextArea, pre-filled)
5. **Genres** (ChipInput with suggestions from library-wide genres)
6. **Developers** (ChipInput with suggestions)
7. **Publishers** (ChipInput with suggestions)
8. **Tags** (ChipInput with suggestions)
9. **"Download Metadata" button** (opens enhanced MetadataSearchModal)
10. **"Save Changes" button** (primary, bottom of panel)

State management:

- Local state for all fields, initialized from `game` props
- `hasChanges` boolean derived by comparing local state to original game values
- Modified fields get `className="metadata-general-section__field--modified"`
- "Save Changes" button disabled when `!hasChanges`

### 4.2 Create ChipInput component

**New file**: `src/renderer/src/components/chip-input/chip-input.tsx`

- Props: `{ value: string[], onChange: (values: string[]) => void, suggestions: string[], placeholder: string, disabled?: boolean }`
- Text input with dropdown of filtered suggestions
- Enter/Tab adds chip; Backspace on empty input removes last chip
- X button on each chip to remove
- Dropdown closes on blur or selection

### 4.3 Create metadata-general-section.scss

**New file**: Styles for the general metadata form

### 4.4 Update game-options-modal to use sub-tabs

**File**: `src/renderer/src/pages/game-details/modals/game-options-modal.tsx`

- Replace the current metadata category content with a sub-tab container
- Two sub-tabs: General + Media
- Sub-tab bar uses same style as sidebar but horizontal
- Pass relevant props to each sub-component

---

## Phase 5: Enhanced Metadata Search Modal

### 5.1 Redesign MetadataSearchModal with per-field merge

**File**: `src/renderer/src/components/metadata-search-modal/metadata-search-modal.tsx`

Changes:

1. **Source tabs**: Add "SteamGridDB" tab alongside existing Hydra/Steam/IGDB/VNDB
2. **Full metadata preview**: When a result is selected, show ALL available fields:
   - Title, Release year, Description (full, not truncated to 200 chars)
   - Genres (comma-separated), Developers, Publishers
   - Cover/Icon preview image
3. **Per-field checkboxes**: Each field in the preview has a checkbox:
   - `☑` checked by default
   - User can uncheck fields they don't want to import
   - "Select All" / "Deselect All" toggle at top
4. **"Apply Selected" button**: Applies only checked fields to the game
5. **Result list enhancement**: Show more metadata in each result card (genres, release year, developer)

### 5.2 Wire metadata search to the fetcher service

**File**: `src/main/events/metadata/fetch-game-metadata.ts`

- When source is "steamgriddb", call `SteamGridDBApi.searchGames()`
- Return full `MetadataSearchResult` with all fields populated from the metadata-fetcher
- Cache results per query+source with 7-day TTL

### 5.3 Apply flow after modal closes

When user clicks "Apply Selected":

1. Modal closes
2. Selected metadata fields populate the General sub-tab form
3. Fields that were applied get the "modified" highlight
4. User reviews and clicks "Save Changes"

---

## Phase 6: Media Sub-Tab Enhancements

### 6.1 Add source tabs to GameAssetsSettings

**File**: `src/renderer/src/pages/game-details/modals/game-assets-settings.tsx`

Changes:

1. **Image source tabs**: Add horizontal tab bar above the search input:
   - "SteamGridDB", "IGDB", "Steam CDN", "Google"
2. **Source-aware search**: `searchGameAssetsMulti` IPC call with selected source
3. **Source label on results**: Each thumbnail shows a small source badge
4. **SteamGridDB API key prompt**: If source is SteamGridDB and no API key is configured, show inline message with link to Settings

### 6.2 Improve auto-fetch logic

- Instead of picking the first result blindly, show top 3 results per image type
- User confirms or swaps individual picks
- "Auto-Fetch All" button picks best matches from all sources combined

### 6.3 Add grid/banner/screenshot image types

- Add "Grid Cover" (SteamGridDB), "Banner", "Screenshot" as additional asset types
- These persist similarly to icon/logo/hero

---

## Phase 7: Settings Page — Metadata Sources

### 7.1 Add Metadata Sources section to Settings

**File**: `src/renderer/src/pages/settings/` (find the settings page)

Add a "Metadata Sources" section with:

- **SteamGridDB API Key**: Text input, masked, with "Test Connection" button
- **Preferred image source**: Dropdown (SteamGridDB / IGDB / Google / Auto)
- **Auto-fetch metadata on game import**: Toggle switch

### 7.2 Store API key in user preferences

- `steamgriddbApiKey` field in UserPreferences
- Read by SteamGridDB API service via levelDB

---

## Phase 8: i18n

### 8.1 Add translation keys

**File**: `src/locales/en/translation.json`

New keys needed:

```json
{
  "metadata_status_label": "Status",
  "metadata_status_not_played": "Not Played",
  "metadata_status_playing": "Playing",
  "metadata_status_on_hold": "On Hold",
  "metadata_status_played": "Played",
  "metadata_status_beaten": "Beaten",
  "metadata_status_completed": "Completed",
  "metadata_status_abandoned": "Abandoned",
  "metadata_status_plan_to_play": "Plan to Play",
  "metadata_field_title": "Title",
  "metadata_field_release_date": "Release Date",
  "metadata_field_description": "Description",
  "metadata_field_genres": "Genres",
  "metadata_field_developers": "Developers",
  "metadata_field_publishers": "Publishers",
  "metadata_field_tags": "Tags",
  "metadata_field_platform": "Platform",
  "metadata_download_button": "Download Metadata",
  "metadata_save_changes": "Save Changes",
  "metadata_unsaved_changes": "You have unsaved changes",
  "metadata_changes_saved": "Metadata saved successfully",
  "metadata_select_all": "Select All",
  "metadata_deselect_all": "Deselect All",
  "metadata_apply_selected": "Apply Selected",
  "metadata_source_steamgriddb": "SteamGridDB",
  "metadata_subtab_general": "General",
  "metadata_subtab_media": "Media",
  "metadata_cached_label": "Cached",
  "metadata_refresh": "Refresh",
  "chip_input_placeholder": "Type and press Enter to add...",
  "chip_input_no_suggestions": "No suggestions",
  "settings_metadata_sources": "Metadata Sources",
  "settings_steamgriddb_api_key": "SteamGridDB API Key",
  "settings_steamgriddb_test": "Test Connection",
  "settings_steamgriddb_api_key_description": "Required for SteamGridDB image search. Get your API key at steamgriddb.com",
  "settings_preferred_image_source": "Preferred Image Source",
  "settings_auto_fetch_metadata": "Auto-fetch metadata on game import",
  "steamgriddb_missing_key": "SteamGridDB API key not configured. Add it in Settings → Metadata Sources."
}
```

---

## Phase 9: Integration & Polish

### 9.1 Wire save-game-metadata in metadata-general-section

- "Save Changes" calls `window.electron.saveGameMetadata(shop, objectId, metadataPatch)`
- On success: show toast, clear modified highlights, reload game context
- On error: show error toast, keep form state

### 9.2 Update game details context to include metadata fields

**File**: `src/renderer/src/context/game-details/game-details.context.types.ts`

- Ensure shopDetails includes description, genres, developers, publishers if available

### 9.3 Sync status between StatsCard and metadata panel

- StatsCard status dropdown reads from `game.userStatus`
- Changing status in metadata panel reflects in StatsCard after save

### 9.4 Handle custom games vs store games

- Custom games: all metadata fields editable freely
- Store games (Steam etc.): metadata fields show store-provided defaults; user edits create local overrides that take precedence over store data in the UI

---

## Task Summary

| #   | Phase | Task                                                  | Priority |
| --- | ----- | ----------------------------------------------------- | -------- |
| 1   | 1     | Extend Game interface with metadata fields            | Critical |
| 2   | 1     | Create save-game-metadata IPC handler + register      | Critical |
| 3   | 2     | Implement SteamGridDB image search method             | Critical |
| 4   | 2     | Create IGDB image search service                      | High     |
| 5   | 2     | Create Steam CDN image search service                 | High     |
| 6   | 2     | Create unified multi-source image search IPC handler  | Critical |
| 7   | 3     | Create GameStatusDropdown component                   | Critical |
| 8   | 3     | Add status i18n labels + styles                       | Critical |
| 9   | 4     | Create ChipInput component                            | Critical |
| 10  | 4     | Create metadata-general-section component             | Critical |
| 11  | 4     | Add metadata sub-tabs to game-options-modal           | Critical |
| 12  | 5     | Enhance MetadataSearchModal with per-field checkboxes | Critical |
| 13  | 5     | Wire search to metadata-fetcher service               | Critical |
| 14  | 5     | Implement selective merge apply flow                  | Critical |
| 15  | 6     | Add source tabs to GameAssetsSettings                 | Critical |
| 16  | 6     | Improve auto-fetch with top-3 selection               | High     |
| 17  | 6     | Add grid/banner/screenshot image types                | Medium   |
| 18  | 7     | Add Metadata Sources section to Settings              | High     |
| 19  | 7     | Store SteamGridDB API key in user prefs               | High     |
| 20  | 8     | Add all i18n keys to en/translation.json              | Critical |
| 21  | 9     | Wire save-game-metadata in General tab                | Critical |
| 22  | 9     | Sync status between StatsCard and metadata panel      | High     |
| 23  | 9     | Handle custom vs store game metadata overrides        | High     |
| 24  | —     | Typecheck + lint all changes                          | Critical |

---

## Key Edge Cases

| Scenario                                     | Expected Behavior                                                             |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| SteamGridDB API key not configured           | Show inline prompt in Media tab, fallback to Google                           |
| Metadata search returns no results           | Show "No results found" with suggestion to try different source/query         |
| User edits field then searches metadata      | Search results populate form, overwriting unsaved edits. Confirmation dialog? |
| Save fails (DB write error)                  | Show error toast, keep form state, allow retry                                |
| User closes modal with unsaved changes       | Show confirmation dialog "You have unsaved changes. Discard?"                 |
| Game has no existing metadata (fresh import) | All fields empty/inherited from store. "Download Metadata" button prominent   |
| Duplicate genres/tags entered                | ChipInput deduplicates automatically                                          |
| Very long description                        | TextArea scrolls, no character limit enforced                                 |
| Image download fails                         | Show error on the specific thumbnail, allow retry, skip to next source        |
| User rapidly switches between sub-tabs       | Component state preserved per sub-tab, no re-fetch on switch                  |
| Multiple games from same franchise           | Search uses game.title; user can type different query for better matching     |
