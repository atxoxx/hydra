# Store-to-Platform-Import Merge Spec

## Summary

Move the store login/sync/game-count functionality from the standalone `/store-integrations` page into the existing platform import cards in Settings. Games synced from stores are automatically imported into the main library and appear in the sidebar game list. The standalone store-integrations page and its tab bar entry are deleted.

---

## User Experience

### Before (current state)

- **Settings → Platform Import** has platform cards (steam, epic, gog, etc.) with a `Scan installed games` checkbox. Steam has a login/sync panel. Others have no login.
- **Tab Bar** has a "Stores" tab (LinkIcon) that opens `/store-integrations`, a dedicated page with 8 store cards (Epic, GOG, Amazon, Humble, Ubisoft, EA, Battle.net, Xbox) each with Login/Sync/Logout buttons and a grid of owned games below.
- Store-synced games live in a separate LevelDB sublevel (`storeGamesSublevel`) and do NOT appear in the sidebar game list.

### After (desired state)

- **Settings → Platform Import** cards now show inline: store connection status dot, game count badge, last sync timestamp, and action buttons (Login/Sync/Logout) for platforms with store integration support.
- **Tab Bar** no longer has the "Stores" tab.
- **`/store-integrations` page** is deleted entirely (component, SCSS, route).
- Store-synced games are automatically imported into the main `gamesSublevel` with their platform's `GameShop` value, so they appear in the sidebar game list alongside locally-scanned games.
- The existing "Scan for Games" button runs local file-system scanning only.
- Each platform card has its own individual Sync button.

---

## Design Decisions (from user interviews)

| #   | Decision                                                              | Rationale                                                                                                                 |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | Store-synced games use **same `GameShop` values** as platform imports | Epic store-synced games get `shop="epic"`, merging into the same sidebar filters and badges                               |
| 2   | **Show all games, filterable**                                        | Uninstalled owned games appear in the sidebar. Users can use the existing "Installed / Not installed" sidebar filter      |
| 3   | **Keep scan and sync separate**                                       | The `Scan installed games` checkbox stays. Scanning finds games on disk. Syncing fetches owned library from store servers |
| 4   | **Auto-import** synced games                                          | No discovery wizard for store sync. Games land in the library immediately                                                 |
| 5   | **Auto-sync on login + startup**                                      | Sync runs on login and at app startup for connected stores. Manual Sync button also available                             |
| 6   | **Delete** the store-integrations page                                | The entire page, its SCSS, and route are removed                                                                          |
| 7   | **Popup BrowserWindow** for OAuth                                     | Store logins open a dedicated Electron BrowserWindow (same as current approach)                                           |
| 8   | **Add EA** to the platform import list                                | EA gets its own platform card with login/sync                                                                             |
| 9   | **Auto-detect + Sync** for Humble/Amazon                              | No login button — they auto-detect local data. A Sync button refreshes                                                    |
| 10  | **Persist status in LevelDB**                                         | Store status loads immediately on startup from LevelDB, background refreshes follow                                       |
| 11  | **Per-card + global scan**                                            | Each card has a Sync button. The global "Scan for Games" runs local scanning only                                         |
| 12  | **Launch from sidebar**                                               | Store-synced games with executable paths can be launched directly from the sidebar                                        |
| 13  | **Badge on expired tokens**                                           | Cards show an "Expired" badge when an OAuth token has expired                                                             |
| 14  | **Keep IPC as-is**                                                    | Keep `stores:*` IPC channel names unchanged                                                                               |
| 15  | **Inline UI density**                                                 | Each platform card row shows: name, status dot, game count, last sync, and action buttons — all inline                    |

---

## Changes Required

### 1. Platform Import Card UI Redesign

**File: `src/renderer/src/pages/settings/settings-context-platform-import.tsx`**

Each platform card currently looks like:

```
┌─────────────────────────────────────────────┐
│ Epic Games                                   │
│  ☑ Scan installed games                     │
└─────────────────────────────────────────────┘
```

After redesign, cards for stores with integration support look like:

```
┌─────────────────────────────────────────────┐
│ Epic Games            ● Connected   12 games │
│ Last synced: 5m ago    [Sync] [Logout]      │
│  ☑ Scan installed games                     │
└─────────────────────────────────────────────┘
```

Cards for platforms without store integration (rockstar, itch-io) remain unchanged.

**New inline elements per card:**

- **Status dot** — green (connected), grey (disconnected), amber/expired (token expired)
- **Game count** badge — shows number of owned games synced from this store
- **Last sync** — relative timestamp ("Just now", "5m ago", "2h ago", "3d ago", "Never synced")
- **Action buttons** — Login (when disconnected), Sync + Logout (when connected)
- **Expired badge** — shown when an OAuth token has expired, prompting re-login

The `IMPORT_PLATFORMS` array must be extended:

- Add `{ shop: "ea", labelKey: "platform_ea", needsApiKey: false }`

New interface for platform store status:

```typescript
interface PlatformStoreStatus {
  isAuthenticated: boolean;
  isExpired: boolean; // true when token expired
  gameCount: number;
  lastSync: number | undefined;
  isSyncing: boolean;
  isLoggingIn: boolean;
}
```

### 2. Backend: Store Games → Main Library Import

**File: `src/main/services/store-manager.ts`**

When `syncStore()` runs, after fetching games from the store API, it must also import them into the main `gamesSublevel` via `PlatformScanner.importGame()`.

Flow:

1. Store sync fetches owned games from the store API
2. Each game is transformed into a `PlatformGame` object
3. `PlatformScanner.importGame()` is called for each game, which creates/updates the game in `gamesSublevel`
4. The sidebar library update is triggered (existing mechanism via `onLibraryBatchComplete` or `updateLibrary` IPC)

Key behavior:

- If a game already exists in `gamesSublevel` (e.g., from a previous platform scan), it is **updated** not duplicated
- New games are created with `shop` matching the platform's `GameShop`, `source` = the shop, `autoImported: true`, `acquisitionSource: "{shop}_sync"`
- Games stored in `storeGamesSublevel` are kept for store-specific metadata

### 3. Auto-sync at Startup & On Login

**File: `src/main/services/store-manager.ts`**

New method: `autoSyncOnStartup()`

- Called after the main window is ready
- Iterates all stores, checks if authenticated (from LevelDB)
- Runs `syncStore()` for each authenticated store in the background
- Non-blocking; does not delay app startup

On login:

- After `login()` succeeds, automatically calls `syncStore()` for that store

### 4. Token Expiry Detection

Each store's `isAuthenticated` check must also detect expired tokens:

- **Epic**: OAuth tokens have `expires_in` from the token response. Check `Date.now() > tokenAcquiredAt + expires_in * 1000`.
- **GOG**: Similar token expiry check.
- **Xbox**: Microsoft tokens have `expires_in`. Check expiry.
- **Others** (Ubisoft, EA, Amazon, Battle.net, Humble): These detect local clients/data, so tokens don't expire in the same way. Show "Connected" if the local client/data is found, "Disconnected" otherwise.

Store the `tokenExpiresAt` in the store account LevelDB sublevel.

### 5. EA Platform Card Addition

**Files affected:**

- `src/renderer/src/pages/settings/settings-context-platform-import.tsx` — Add EA to `IMPORT_PLATFORMS`
- `src/locales/en/translation.json` — Add `platform_ea` translation key
- `src/main/services/platform-scanner.ts` — Optionally add EA local game scanning if there's an existing scanner

EA gets an auto-detect card (no explicit Login button — it detects the EA App installation locally, like Ubisoft). When detected, shows a Sync button to refresh the game list.

### 6. Humble Bundle & Amazon Games: Auto-detect Behavior

- **Humble Bundle**: Tries to detect Humble cookies/browser data. Status shows "Connected" if found, "Disconnected" if not. Sync button refreshes game data.
- **Amazon Games**: Reads the local Amazon Games SQLite database. Status shows "Connected" if the DB is found and readable. Sync button re-reads the DB.

No Login button for either. They auto-detect.

### 7. Tab Bar "Stores" Tab Removal

**File: `src/renderer/src/components/tab-bar/tab-bar.tsx`**

Remove the `stores` entry from the `TABS` array:

```typescript
// Remove this:
{
  labelKey: "stores",
  path: "/store-integrations",
  render: () => <LinkIcon size={16} />,
},
```

### 8. Route & Page Deletion

**Files to delete:**

- `src/renderer/src/pages/store-integrations/store-integrations.tsx`
- `src/renderer/src/pages/store-integrations/store-integrations.scss`
- `src/renderer/src/pages/store-integrations/` directory (if empty after)

**Files to modify:**

- `src/renderer/src/main.tsx` — Remove the `/store-integrations` route and lazy import
- `src/locales/en/translation.json` — Remove the `sidebar.stores` key

### 9. IPC Handlers (keep as-is)

**File: `src/preload/index.ts`** — No changes. Keep all `store*` methods.

**File: `src/main/events/store/`** — Keep all handlers. They are now called from the platform import section instead of the store-integrations page.

### 10. Sidebar Display

Store-synced games automatically appear in the sidebar because they are imported into `gamesSublevel` with correct `GameShop` values. No sidebar code changes needed.

The existing sidebar filter supports filtering by shop (via the `stores` filter in `SidebarFilterMenu`). Store-synced games are filterable alongside platform-imported games.

Uninstalled owned games show in the sidebar list. Users can filter them out using the "Installed" library set filter.

Double-clicking a store-synced game with `executablePath` launches it directly.

---

## Implementation Steps

1. **Add EA to platform import list** — Update `IMPORT_PLATFORMS` and translation keys
2. **Redesign platform card UI** — Add status dot, game count, last sync, action buttons to each card row
3. **Create `PlatformStoreStatus` hook/state** — React state that polls `getStoreStatuses()` and updates per-card status
4. **Wire store login/sync/logout to card buttons** — Connect per-card buttons to existing store IPC methods
5. **Add token expiry detection** — Store `tokenExpiresAt` in LevelDB, expose `isExpired` in store status
6. **Implement auto-sync on startup** — `autoSyncOnStartup()` called when main window is ready
7. **Implement auto-sync on login** — `login()` → automatic `syncStore()`
8. **Wire store sync → main library import** — `syncStore()` calls `PlatformScanner.importGame()` for each synced game
9. **Remove "Stores" tab from tab bar** — Edit `tab-bar.tsx`
10. **Delete store-integrations page** — Remove component, SCSS, and route from `main.tsx`
11. **Remove translation keys** — Clean up `sidebar.stores` from en translation
12. **Typecheck all changes**
13. **Code review**

---

## Files Summary

### New files

(none — all changes are modifications to existing files or deletions)

### Modified files

| File                                                                   | Change                                                                                                                                                            |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/src/pages/settings/settings-context-platform-import.tsx` | Redesign platform cards with inline store status and action buttons; add EA to platform list; add store status state management                                   |
| `src/renderer/src/pages/settings/settings-platform-import.scss`        | New styles for inline status indicators, game count badges, sync buttons, expired badges                                                                          |
| `src/main/services/store-manager.ts`                                   | Add `autoSyncOnStartup()`, wire `syncStore()` to `PlatformScanner.importGame()`, add token expiry tracking, add `onSyncStatusChange` listener emission on startup |
| `src/main/services/store-integrations/base-store.ts`                   | Add `isTokenExpired()` method and `tokenExpiresAt` tracking                                                                                                       |
| `src/main/services/store-integrations/epic-games.ts`                   | Store `tokenExpiresAt` in account data after token exchange                                                                                                       |
| `src/main/services/store-integrations/gog.ts`                          | Store `tokenExpiresAt` in account data after token exchange                                                                                                       |
| `src/main/services/store-integrations/xbox-game-pass.ts`               | Store `tokenExpiresAt` in account data after token exchange                                                                                                       |
| `src/renderer/src/components/tab-bar/tab-bar.tsx`                      | Remove "Stores" tab entry                                                                                                                                         |
| `src/renderer/src/main.tsx`                                            | Remove `/store-integrations` route and lazy import                                                                                                                |
| `src/locales/en/translation.json`                                      | Add `platform_ea`, remove `sidebar.stores`                                                                                                                        |
| `src/types/game.types.ts`                                              | Add `"ea"` to `GameShop` (already done in prior work)                                                                                                             |

### Deleted files

| File                                                                | Reason                  |
| ------------------------------------------------------------------- | ----------------------- |
| `src/renderer/src/pages/store-integrations/store-integrations.tsx`  | Page no longer needed   |
| `src/renderer/src/pages/store-integrations/store-integrations.scss` | Styles no longer needed |

---

## Edge Cases & Notes

1. **Rockstar & itch.io** — These platforms are in the platform import list but have no store integration. Their cards show only the "Scan installed games" checkbox, unchanged from current behavior.

2. **Steam** — Steam already has its own login/sync panel in the platform import section. This should NOT be changed. Steam's login uses a different flow (`steamLogin/steamSync` IPC methods, not the store manager). The card should show both the Steam login panel AND the scan checkbox, same as today.

3. **Humble Bundle** — The store integration uses cookie-based auth. If no Humble cookies are found, the card shows "Disconnected" with a message like "Sign in to Humble Bundle in your browser first" (no login button here since we decided on auto-detect only). The Sync button refreshes even when "disconnected" — it re-checks for cookies.

4. **Amazon Games** — The store integration reads a local SQLite database (`agsc.db`). If `better-sqlite3` is not available or the DB file is not found, the card shows "Disconnected". Sync button re-checks for the DB.

5. **Race condition at startup** — Auto-sync must not block the app from loading. Store syncs run asynchronously after the UI is ready. The sidebar will populate gradually as syncs complete.

6. **Duplicate game handling** — When a store sync imports a game that already exists from a platform scan, `PlatformScanner.importGame()` updates the existing entry (adds `executablePath` if found, updates metadata). The game does NOT appear twice.

7. **OAuth redirect handling** — The store login flow creates a BrowserWindow and listens for redirect. This is unchanged from the current implementation. The login is initiated from the platform card's Login button in the renderer.

8. **Translation completeness** — New translation keys must be added to `src/locales/en/translation.json` only. Other locale files are updated separately via the existing i18n script.
