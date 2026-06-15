# Catalogue Watchlist Spec

## Overview

Add a **watchlist/wishlist** feature to the Hydra Launcher catalogue that lets users track games they want to play later. Users can browse the catalogue, add games to their watchlist via a rich-form modal, view their watchlist on a dedicated page, and filter catalogue results by watchlist status.

---

## 1. Concept & Relationship to Existing Features

| Feature | Relationship |
|---|---|
| **Favorites** | Separate concept. Favorites = "I love this game / quick access". Watchlist = "I want to play this later / wishlist". Both can coexist on the same game. |
| **Collections** | Separate. Watchlist is a flat list, not a collection. Users can still assign a watchlisted game to any collection. |
| **Library** | A game already in the user's library **cannot** be added to the watchlist. If the user tries, show a notification: "Game is already in your library." When a watchlisted game is later added to the library (via the catalogue + button), **ask the user** if they want to remove it from the watchlist. |

---

## 2. Game Item Card (Catalogue) — Watchlist Button

### Placement
- A **watchlist button** is added to the **right side** of each catalogue game item (both `GameItem` modern view and `GameItemClassics` classics view).
- Positioned alongside the existing "+" add-to-library button.
- **Always visible** (not just on hover).

### Icon
- Use a **list/clipboard icon** from `@primer/octicons-react`:
  - **Not watchlisted**: `ListUnorderedIcon` (outline)
  - **Watchlisted**: `ChecklistIcon` (filled variant) — to indicate it's already on the watchlist

### States
| State | Appearance |
|---|---|
| Not watchlisted | Outline list icon, clickable |
| Watchlisted | Filled list icon, clickable (toggles off) |
| Loading | Disabled / spinner while IPC call is in-flight |

### Click Behavior
- Clicking the button opens a **rich form modal** (see §3 below).
- If the game is **already in the user's library**, show a toast/notification instead: `"This game is already in your library"` — do not open the modal.

---

## 3. Watchlist Modal (Rich Form)

Opened when the user clicks the watchlist button on a catalogue game card.

### Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| Game title | Read-only text | — | Displayed as modal title: `"Add [Game Title] to your watchlist"` |
| Priority | Dropdown/select | Yes | Options: `Must-play`, `Want`, `Later` (default: `Want`) |
| Notes | Textarea | No | Free-text personal notes. Max 500 chars. |
| Cancel / Add buttons | Actions | — | "Cancel" closes modal. "Add to Watchlist" saves and closes. |

### Behavior
- When reopening the modal for an already-watchlisted game, pre-fill with existing values and change the button text to "Update Watchlist".
- Close modal on "Cancel" or clicking outside.
- Show a brief success toast on add/update: `"Added [Game] to watchlist"` / `"Updated [Game] watchlist"`.

---

## 4. Data Model

### Storage
- **Local-only** (LevelDB). No cloud sync in this initial version.
- Follows the same pattern as favorites: a boolean field on the `Game` type + a dedicated LevelDB sublevel for watchlist metadata.

### LevelDB Schema

**On Game document** (`games` sublevel):
```typescript
// Add to existing Game interface (src/types/level.types.ts):
watched?: boolean;
```

**New sublevel**: `watchlist` (keyed by `shop:objectId`)
```typescript
interface WatchlistEntry {
  shop: GameShop;
  objectId: string;
  title: string;
  addedAt: string; // ISO date string
  priority: "must-play" | "want" | "later";
  notes: string; // optional, max 500 chars
}
```

### IPC Events (Main Process)

| Event Name | Direction | Purpose |
|---|---|---|
| `getWatchlist` | Renderer → Main | Fetch all watchlist entries |
| `addToWatchlist` | Renderer → Main | Add/update a watchlist entry (upsert) |
| `removeFromWatchlist` | Renderer → Main | Remove a game from watchlist |
| `isGameWatchlisted` | Renderer → Main | Check if a specific game is watchlisted |

### Preload API

```typescript
// Add to preload context bridge:
getWatchlist: () => Promise<WatchlistEntry[]>;
addToWatchlist: (data: { shop: GameShop; objectId: string; title: string; priority: WatchlistPriority; notes: string }) => Promise<void>;
removeFromWatchlist: (shop: GameShop, objectId: string) => Promise<void>;
isGameWatchlisted: (shop: GameShop, objectId: string) => Promise<boolean>;
```

---

## 5. Watchlist Page

### Route
- `/watchlist` — new route added to the renderer router and sidebar navigation.

### Sidebar Entry
- Add a new entry in `src/renderer/src/components/sidebar/routes.tsx`:
  - Path: `/watchlist`
  - Name key: `"watchlist"` (i18n)
  - Icon: `ListUnorderedIcon`
  - Position: after `/activity` (last in the list)

### Layout
- **Grid view** similar to the catalogue classics mode — 3 columns, responsive down to 1 column.
- Each watchlist item shows:
  - Game cover image (if available)
  - Game title
  - Priority badge (color-coded: Must-play = red/high, Want = yellow/medium, Later = gray/low)
  - Date added
  - Notes snippet (first line)
  - Download sources (from catalogue data)
  - Action buttons: "Remove from watchlist", "Add to library" (same + button), "View details"
- Sort options: Date added (newest first — default), Priority, Title (A-Z).
- Empty state: `"Your watchlist is empty. Browse the catalogue to add games."` with a link to `/catalogue`.

### Badge / Update Indicator
- When the user opens the watchlist page, check each watchlisted game for **new download sources** (by fetching current catalogue data for each game).
- If a game has new download sources since `addedAt`, show a **"New sources" badge** on that watchlist item.
- This check runs once per page open; results are cached for the session.

---

## 6. Catalogue Filter

- Add a **"Watchlist" filter chip** in the right filters sidebar of the catalogue (both modern and classics modes).
- The filter has two toggle states:
  - **Off** (default): Show all catalogue results
  - **On**: Show only games that are in the user's watchlist (filtered client-side from search results)
- Visual: A filter orb with a distinct color (e.g., purple/indigo), labelled "Watchlist".
- When the filter is active, watchlisted games can optionally be highlighted/pinned to the top of results.

---

## 7. Edge Cases & Behaviors

| Scenario | Behavior |
|---|---|
| Game already in library → click watchlist | Show toast: "This game is already in your library." Do not open modal. |
| Game is watchlisted → add to library via + button | After successful add-to-library, show a confirmation modal: `"[Game] was added to your library. Remove from watchlist?"` with options "Keep" and "Remove". |
| Game removed from library → still in watchlist | Keep the watchlist entry. User may want to re-add it later. |
| Duplicate add attempt | If already watchlisted, open modal in "edit" mode with pre-filled values. |
| Offline | Works fully offline (local-only storage). |
| Notes exceed 500 chars | Client-side validation — prevent submission and show error. |
| Game deleted from Hydra catalogue | Stale watchlist entries are simply displayed as-is; no auto-cleanup needed for MVP. |

---

## 8. Files to Create / Modify

### New Files
| File | Purpose |
|---|---|
| `src/renderer/src/pages/watchlist/watchlist.tsx` | Watchlist page component |
| `src/renderer/src/pages/watchlist/watchlist.scss` | Watchlist page styles |
| `src/renderer/src/pages/watchlist/watchlist-item.tsx` | Individual watchlist item component |
| `src/main/events/watchlist/get-watchlist.ts` | IPC handler — get all watchlist entries |
| `src/main/events/watchlist/add-to-watchlist.ts` | IPC handler — add/update watchlist entry |
| `src/main/events/watchlist/remove-from-watchlist.ts` | IPC handler — remove from watchlist |
| `src/main/events/watchlist/is-game-watchlisted.ts` | IPC handler — check if game is watchlisted |
| `src/main/events/watchlist/index.ts` | Barrel export for watchlist events |
| `src/renderer/src/features/watchlist-slice.ts` | Redux slice for watchlist state |
| `src/renderer/src/components/watchlist-modal/watchlist-modal.tsx` | Add-to-watchlist modal component |
| `src/renderer/src/components/watchlist-modal/watchlist-modal.scss` | Modal styles |
| `src/renderer/src/hooks/use-watchlist.ts` | Hook for watchlist operations |

### Modified Files
| File | Changes |
|---|---|
| `src/types/level.types.ts` | Add `WatchlistEntry` interface, add `watched?: boolean` to `Game` |
| `src/types/index.ts` | Export `WatchlistEntry` |
| `src/preload/index.ts` | Add watchlist IPC methods to context bridge |
| `src/renderer/src/declaration.d.ts` | Add watchlist methods to Electron window type |
| `src/renderer/src/main.tsx` | Add `/watchlist` route |
| `src/renderer/src/store.ts` | Add `watchlistSlice` to store |
| `src/renderer/src/features/index.ts` | Export watchlist slice |
| `src/renderer/src/components/sidebar/routes.tsx` | Add watchlist nav entry |
| `src/renderer/src/pages/catalogue/game-item.tsx` | Add watchlist button |
| `src/renderer/src/pages/catalogue/game-item-classics.tsx` | Add watchlist button |
| `src/renderer/src/pages/catalogue/catalogue.tsx` | Add watchlist filter section |
| `src/renderer/src/pages/catalogue/catalogue.scss` | Add watchlist button / filter styles |
| `src/renderer/src/components/game-context-menu/use-game-actions.ts` | Add watchlist action to context menu (optional) |
| `locales/en/translation.json` | Add i18n strings for watchlist |

---

## 9. i18n Strings (en)

```json
{
  "watchlist": {
    "title": "Watchlist",
    "add_to_watchlist": "Add to watchlist",
    "remove_from_watchlist": "Remove from watchlist",
    "update_watchlist": "Update watchlist",
    "added_to_watchlist": "Added {{title}} to your watchlist",
    "removed_from_watchlist": "Removed {{title}} from your watchlist",
    "updated_watchlist": "Updated {{title}} watchlist",
    "already_in_library": "This game is already in your library",
    "already_in_watchlist": "This game is already in your watchlist",
    "empty_title": "Your watchlist is empty",
    "empty_description": "Browse the catalogue to add games you want to play later.",
    "browse_catalogue": "Browse catalogue",
    "priority": "Priority",
    "must_play": "Must-play",
    "want": "Want",
    "later": "Later",
    "notes": "Notes",
    "notes_placeholder": "Why do you want to play this game?",
    "date_added": "Added",
    "new_sources": "New sources",
    "remove_confirm_title": "Remove from watchlist?",
    "remove_confirm_description": "Are you sure you want to remove {{title}} from your watchlist?",
    "added_to_library_remove_title": "Added to library",
    "added_to_library_remove_description": "{{title}} was added to your library. Remove from watchlist?",
    "keep": "Keep",
    "filter_watchlist": "Watchlist",
    "sort_date_added": "Date added",
    "sort_priority": "Priority"
  }
}
```

---

## 10. Implementation Phases (Suggested Order)

| Phase | Tasks |
|---|---|
| **1. Data layer** | Create `WatchlistEntry` type, LevelDB sublevel, IPC events, preload bridge |
| **2. Redux + hooks** | Create watchlist slice, `useWatchlist` hook |
| **3. Catalogue integration** | Add watchlist button to `game-item.tsx` and `game-item-classics.tsx`, create `WatchlistModal` component |
| **4. Watchlist page** | Create `/watchlist` route, page component with grid view, sidebar link |
| **5. Catalogue filter** | Add watchlist filter chip in the right filters sidebar |
| **6. Badge/updates** | Check for new download sources on page open |
| **7. Polish** | i18n strings, edge cases, toast notifications, empty states |
