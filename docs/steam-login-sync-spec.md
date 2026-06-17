# Steam Login & Sync — Specification

## Overview

Add a full Steam integration to Hydra that includes:

1. **Steam Login** — OAuth-style login via Electron BrowserWindow (same approach as Playnite's SteamLibrary extension)
2. **Game Library Sync** — Fetch owned games from Steam Web API using the login access token
3. **Playtime Sync** — Ongoing playtime sync where Steam is the master source
4. **Install via Steam** — Trigger `steam://install/{appId}` from Hydra
5. **Launch via Steam** — Launch games through `steam://rungameid/{appId}`
6. **Integration into Platform Import** — Login, sync status, and game info all shown on the existing settings page
7. **Toast Notifications** — Success/failure toasts for all operations

---

## 1. Steam Login

### 1.1 Approach

Use an **Electron `BrowserWindow` popup** (not a webview or iframe) that navigates to a Steam page requiring authentication. The user logs in through Steam's standard OAuth flow. Once the login completes and the page's HTML contains the `steamid` and `webapi_token`, the window auto-closes and Hydra extracts the token.

This mirrors the approach used by Playnite's `SteamStoreService.Login()`:

```csharp
public SteamUserToken? Login() {
    var view = PlayniteApi.WebViews.CreateView(600, 720);
    view.DeleteDomainCookies(".steamcommunity.com");
    view.DeleteDomainCookies("steampowered.com");
    view.DeleteDomainCookies("store.steampowered.com");
    view.Navigate("https://store.steampowered.com/explore/");
    view.OpenDialog();
    // ...extract token from page source on load complete
}
```

### 1.2 Token Extraction

The token is extracted from the page source after navigation. The relevant fields are embedded in the page HTML:

```json
{
  "steamid": "7656119XXXXXXXXXX",
  "webapi_token": "xxxxxxxxxxxxxxxxxxxxxxxx"
}
```

Regex patterns from Playnite's `SteamStoreService.GetSteamUserTokenFromWebViewAsync()`:

```
"steamid":"(\d{17})"
"webapi_token":"([^&]+)"
```

### 1.3 Stored State

The following is persisted to `UserPreferences` (in LevelDB):

| Field                       | Type             | Description                           |
| --------------------------- | ---------------- | ------------------------------------- |
| `steamLoginUserId`          | `string \| null` | SteamID64 of the logged-in user       |
| `steamLoginUsername`        | `string \| null` | Display name from Steam               |
| `steamLoginAccessToken`     | `string \| null` | The web API access token              |
| `steamLoginTokenObtainedAt` | `string \| null` | ISO timestamp when token was obtained |

The existing `steamApiKey` field remains as a **fallback** for users who prefer not to log in. When logged in, the access token takes priority.

### 1.4 Token Expiry

- When an API call returns `401 Unauthorized` or `403 Forbidden`, assume the token has expired.
- Show an inline message on the settings page: "Steam session expired. Please re-login."
- User clicks "Login with Steam" again to re-authenticate.

### 1.5 Logout

- A "Logout" button clears `steamLoginAccessToken`, `steamLoginUserId`, `steamLoginUsername`, and `steamLoginTokenObtainedAt` from preferences.
- Does NOT delete games that were already imported from Steam.

---

## 2. Login UI (Platform Import Settings)

### 2.1 Location

The Steam login UI lives in the existing platform import settings page:
`src/renderer/src/pages/settings/settings-context-platform-import.tsx`

It replaces the current Steam API Key text field with a richer login section.

### 2.2 States

#### Logged Out

- Button: **"Login with Steam"** (opens the Electron BrowserWindow popup)
- Below the button, the existing API key field is shown as a collapsed/optional fallback: "Or use a Steam Web API Key" with a disclosure toggle.

#### Logged In

- **Rich status panel** showing:
  - Green dot indicator + "Logged in as `{username}`"
  - "Last synced: `{timestamp}`" (or "Never synced" after login but before first sync)
  - A "Logout" button
  - The API key fallback is hidden when logged in

#### Expired

- Status text turns amber: "Session expired — please re-login"
- The login button becomes "Re-login with Steam"

### 2.3 Component Tree

```
SettingsContextPlatformImport
├── Steam Login Section (replaces the current API key row)
│   ├── Login Button / Rich Status Panel
│   └── (Collapsed) API Key fallback
├── Sync & Scan Actions
│   ├── "Sync Steam" button (triggers game sync + playtime sync)
│   ├── Sync status message (game count, errors, last sync time)
│   └── Steam Family Share IDs input (moved here, only visible when logged in)
└── DiscoveryWizardModal (existing, reused for import selection if needed)
```

---

## 3. Game Library Sync

### 3.1 API Endpoints Used

When logged in and access token available:

| Endpoint                                                                | Purpose                                                                          |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `GET https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/`  | Fetch owned games with `access_token={token}&steamid={steamid}`                  |
| `GET https://store.steampowered.com/dynamicstore/userdata/`             | Get `rgOwnedApps` for app info (name/type from Playnite's `SteamServicesClient`) |
| `GET https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/` | Get player display names                                                         |

### 3.2 Sync Flow

1. User clicks **"Sync Steam"** button.
2. Status changes to "Syncing..." with a spinner.
3. Backend calls `IPlayerService/GetOwnedGames` with the access token:
   ```
   https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/
     ?access_token={token}
     &steamid={steamId64}
     &include_appinfo=1
     &include_played_free_games=1
     &include_free_sub=1
   ```
4. Response contains `{ response: { game_count, games: [{ appid, name, playtime_forever, img_icon_url, rtime_last_played, ... }] } }`.
5. For each game, check local install status by parsing `appmanifest_{appId}.acf` in Steam library folders (reuse logic from `steam-family-scanner.ts`).
6. For each game:
   - If already in Hydra library → update title, icon, playtime (Steam is master), and last played date.
   - If not in library → auto-import as a new entry with `shop: "steam"`, `source: "steam"`, `autoImported: true`.
7. After sync completes:
   - Save `steamLastSyncAt` timestamp to user preferences.
   - Show success toast: "Steam sync complete — {N} games imported"
   - On partial failure: Warning toast with counts of successes and failures.

### 3.3 Auto-Import Behavior

Games are **auto-imported** directly into the library (no DiscoveryWizardModal for Steam games — the user chose "Auto-import with toast").

- `shop`: `"steam"`
- `objectId`: `appId.toString()`
- `source`: `"steam"`
- `autoImported`: `true`
- `executablePath`: Resolved from ACF manifest + filesystem scan (if installed locally)
- `steamFamilyOwnerId` / `steamFamilyOwnerName`: `null` for own games, set for family shared games

### 3.4 Install Detection

For each game, detect if it is locally installed:

- Read `appmanifest_{appId}.acf` from all Steam library folders
- Check `StateFlags` for `FullyInstalled` flag (`0x4`)
- Extract `installdir` from the manifest
- Scan for executable in the install directory

This reuses and extends the existing `findInstalledGame()` in `steam-family-scanner.ts`.

---

## 4. Playtime Sync

### 4.1 Strategy

**Ongoing sync where Steam is the master source.**

- On each sync, Steam's `playtime_forever` (converted from minutes to milliseconds) **overrides** Hydra's `playTimeInMilliseconds`.
- Steam's `rtime_last_played` (unix timestamp) **overrides** Hydra's `lastTimePlayed` if Steam's value is more recent.
- The Hydra process watcher continues to track playtime locally between syncs. On the next sync, Steam's value replaces it.

### 4.2 Sync Frequency

1. **On app startup**: If `steamLoginAccessToken` exists and is not expired, automatically sync.
2. **Manual**: User clicks "Sync Steam" in settings.

### 4.3 Data Flow

```
Steam API
  ├── playtime_forever (minutes) × 60000 → playTimeInMilliseconds
  └── rtime_last_played (unix) → lastTimePlayed (Date)

Hydra LevelDB
  └── Game record updated with Steam playtime values
```

### 4.4 Conflict Handling

- If Steam playtime is 0 but Hydra has tracked time → Steam value is still used (Steam is master).
- If the game is currently running in Hydra (`gamesPlaytime` map) → skip playtime update for that game during sync (don't interrupt an active session).
- `unsyncedDeltaPlayTimeInMilliseconds` is reset to 0 after sync.

---

## 5. Install via Steam

### 5.1 Triggers

When a user clicks "Install" for a Steam game that they own, the **download modal** shows two tabs:

#### Tab 1: "Hydra Sources"

- Existing repack/torrent download sources (current behavior unchanged).

#### Tab 2: "Steam Store"

- If the user **owns** the game via Steam (and is logged in):
  - Button: **"Install via Steam"**
  - Opens `steam://install/{appId}` via `shell.openExternal()` or equivalent.
  - Toast: "Installing {gameTitle} via Steam..."
- If the user does **NOT** own the game via Steam:
  - Grayed out with message: "This game is not in your Steam library"
  - Or: the tab is hidden entirely.

### 5.2 Post-Install Detection

After opening `steam://install/{appId}`:

1. Hydra **does not** show custom progress (user chose "Open Steam's UI").
2. Hydra polls `appmanifest_{appId}.acf` files every 10 seconds for up to 1 hour.
3. When `StateFlags` has `FullyInstalled` flag set:
   - Extract `installdir`, scan for executable
   - Update the game record in LevelDB with `executablePath`
   - Send IPC event to refresh the library UI
   - Toast: "{gameTitle} installed via Steam"

---

## 6. Launch via Steam

### 6.1 Decision Logic

For any Steam game, clicking "Play":

1. If the game has an `executablePath` in LevelDB and the file exists → launch via Hydra's normal launcher (current behavior).
2. As an alternative, the game context menu or hero actions show **"Play via Steam"** which triggers:
   ```
   steam.exe -silent "steam://rungameid/{appId}"
   ```
   Or simply `steam://rungameid/{appId}` via `shell.openExternal()`.

### 6.2 Fallback

If Steam is not installed or `steam.exe` cannot be found:

- The "Play via Steam" button is hidden or grayed out.
- Play via Hydra's existing launcher is always available as the primary action.

---

## 7. Backend Architecture

### 7.1 New Services

#### `src/main/services/steam-login.ts`

```typescript
export class SteamLogin {
  /** Opens a BrowserWindow for Steam OAuth login, returns token info */
  static async login(): Promise<SteamLoginResult>;

  /** Extracts steamid and webapi_token from page source */
  static extractTokenFromPage(pageSource: string): SteamLoginResult | null;

  /** Checks if stored token is still valid */
  static async validateToken(token: string): Promise<boolean>;

  /** Logs out - clears stored credentials */
  static async logout(): Promise<void>;
}

interface SteamLoginResult {
  steamId64: string;
  username: string;
  accessToken: string;
}
```

#### `src/main/services/steam-game-sync.ts`

```typescript
export class SteamGameSync {
  /** Full sync: fetches owned games, checks install status, imports to library, syncs playtime */
  static async syncAll(
    accessToken: string,
    steamId64: string
  ): Promise<SteamSyncResult>;

  /** Fetches owned games from the Steam Web API using access token */
  static async fetchOwnedGames(
    accessToken: string,
    steamId64: string
  ): Promise<SteamOwnedGame[]>;

  /** Checks if a game is locally installed by reading ACF manifest */
  static async checkInstallStatus(appId: number): Promise<InstallCheckResult>;
}

interface SteamSyncResult {
  imported: number;
  updated: number;
  errors: string[];
  playtimeSynced: number;
}
```

### 7.2 Modified Services

#### `src/main/services/steam-web-api.ts`

- Add `getOwnedGamesWithToken(steamId64, accessToken)` method (uses `access_token` param instead of `key`).
- The existing `getOwnedGames(steamId64, apiKey)` remains as a fallback.

#### `src/main/services/steam.ts`

- Export `getSteamExecutablePath()` helper to locate `steam.exe`.
- Add `openSteamProtocol(url: string)` helper.

#### `src/main/services/steam-family-scanner.ts`

- Refactored to reuse `findInstalledGame()` from a shared location.
- Can now use the access token from login instead of requiring a separate API key.

### 7.3 New IPC Events

| Event                      | Direction       | Purpose                                             |
| -------------------------- | --------------- | --------------------------------------------------- |
| `steamLogin`               | renderer → main | Opens BrowserWindow for Steam login                 |
| `steamLogout`              | renderer → main | Clears stored Steam credentials                     |
| `steamSync`                | renderer → main | Triggers full library + playtime sync               |
| `steamGetLoginStatus`      | renderer → main | Returns current login state                         |
| `steamStartInstallWatcher` | renderer → main | Starts polling ACF manifests for install completion |
| `steamStopInstallWatcher`  | renderer → main | Stops polling for a specific appId                  |

### 7.4 Modified IPC Events

| Event             | Change                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------- |
| `scanPlatforms`   | Add Steam to the scan results (only when logged in; use API instead of filesystem-only) |
| `scanSteamFamily` | Can now use access token instead of requiring API key                                   |

---

## 8. Frontend Architecture

### 8.1 Modified Component

**`src/renderer/src/pages/settings/settings-context-platform-import.tsx`**

Replace the current Steam section (API key, checkboxes) with:

```
┌─────────────────────────────────────────────┐
│ Steam                                        │
│                                              │
│ ┌─────────────────────────────────────────┐ │
│ │ 🟢 Logged in as "username"              │ │
│ │    Last synced: 2 minutes ago           │ │
│ │                           [Logout]      │ │
│ └─────────────────────────────────────────┘ │
│                                              │
│ [Sync Steam]   {N games synced, N errors}   │
│                                              │
│ Steam Family Share IDs: [______________]    │
│   Comma-separated SteamID64 values           │
├─────────────────────────────────────────────┤
│ ► Or use a Steam Web API Key  (collapsed)   │
└─────────────────────────────────────────────┘
```

### 8.2 New Hook

**`src/renderer/src/hooks/use-steam-login.ts`**

```typescript
export function useSteamLogin() {
  // Manages login state, sync status, polling
  return {
    loginStatus: "logged-out" | "logging-in" | "logged-in" | "expired" | "syncing"
    username: string | null
    lastSyncAt: Date | null
    syncResult: SteamSyncResult | null
    login: () => Promise<void>
    logout: () => Promise<void>
    sync: () => Promise<void>
  }
}
```

### 8.3 Download Modal

The existing download modal needs a modification for Steam games. When the game's shop is `"steam"` and the user is logged in:

**Two-tab layout:**

- **"Hydra Sources" tab** — Existing repack/torrent list (unchanged)
- **"Steam Store" tab** — Shows one of:
  - If owned: "Install via Steam" button → triggers `steam://install/{appId}`
  - If not owned: Grayed out message "This game is not in your Steam library"

_Note: The exact implementation of this UI is out of scope for the initial implementation and should be a follow-up task._

### 8.4 Toast Messages

| Scenario         | Type      | Title                             | Message                                          |
| ---------------- | --------- | --------------------------------- | ------------------------------------------------ |
| Login success    | `success` | "Logged in as {username}"         | —                                                |
| Login failure    | `error`   | "Steam login failed"              | "Please try again or use a Web API Key instead." |
| Sync success     | `success` | "Steam sync complete"             | "{count} games imported"                         |
| Sync partial     | `warning` | "Steam sync finished with errors" | "{success} imported, {errors} failed"            |
| Sync failure     | `error`   | "Steam sync failed"               | "{error message}"                                |
| Token expired    | `warning` | "Steam session expired"           | "Please re-login to continue syncing."           |
| Install started  | `success` | "Installing via Steam"            | "{gameTitle} — Steam will handle the download"   |
| Install complete | `success` | "Installation complete"           | "{gameTitle} is now installed via Steam"         |
| Logout           | `success` | "Logged out of Steam"             | —                                                |

All toasts use the **existing renderer toast system** (`toast-slice.ts` + `use-toast.ts`).

---

## 9. Data Flow Diagrams

### 9.1 Login Flow

```
User clicks "Login with Steam"
  → IPC: steamLogin
  → Main: SteamLogin.login()
  → Main: Create BrowserWindow (600×720)
  → Main: Clear Steam cookies
  → Main: Navigate to https://store.steampowered.com/explore/
  → User logs in via Steam's OAuth page
  → Main: On page load, extract steamid + webapi_token
  → Main: Close BrowserWindow
  → Main: Save credentials to UserPreferences
  → IPC response: { success, username, steamId64 }
  → Renderer: Show logged-in state + toast
```

### 9.2 Sync Flow

```
User clicks "Sync Steam"
  → IPC: steamSync
  → Main: Read access_token + steamId64 from UserPreferences
  → Main: SteamGameSync.syncAll(token, steamId64)
  → Main: Call IPlayerService/GetOwnedGames(v1) with access_token
  → Main: For each game:
      → Check ACF manifests for install status
      → Upsert game in LevelDB (Steam playtime overrides local)
      → Sync playtime to Hydra API via createGame/trackGamePlaytime
  → Main: Save steamLastSyncAt timestamp
  → Main: Return { imported, updated, errors, playtimeSynced }
  → IPC response back to renderer
  → Renderer: Update sync status display
  → Renderer: Show toast (success/error/warning)
  → Library auto-refreshes via existing mechanism
```

### 9.3 Auto-Sync on Startup

```
App startup (main process)
  → Read steamLoginAccessToken from UserPreferences
  → If token exists:
      → Validate token (quick API call)
      → If valid: run SteamGameSync.syncAll()
      → Update steamLastSyncAt
      → (No toast on auto-sync; status visible in settings)
  → If token expired/invalid:
      → Set loginStatus = "expired"
      → No auto-sync
```

---

## 10. Types

### 10.1 New Types

```typescript
// In src/types/index.ts or a new steam-login.types.ts

export interface SteamLoginResult {
  steamId64: string;
  username: string;
  accessToken: string;
}

export interface SteamSyncResult {
  imported: number;
  updated: number;
  errors: string[];
  playtimeSynced: number;
}

export interface SteamLoginState {
  status: "logged-out" | "logging-in" | "logged-in" | "expired" | "syncing";
  steamId64: string | null;
  username: string | null;
  lastSyncAt: string | null; // ISO timestamp
}
```

### 10.2 Modified Types

**`UserPreferences`** (in `src/types/level.types.ts`):

```typescript
// Add:
steamLoginUserId?: string | null
steamLoginUsername?: string | null
steamLoginAccessToken?: string | null
steamLoginTokenObtainedAt?: string | null
steamLastSyncAt?: string | null
```

---

## 11. Implementation Order

### Phase 1: Core Login (Backend)

1. Create `src/main/services/steam-login.ts` with BrowserWindow login flow
2. Add IPC events: `steamLogin`, `steamLogout`, `steamGetLoginStatus`
3. Add `UserPreferences` fields for Steam credentials
4. Register events in `src/main/events/`

### Phase 2: Login UI (Frontend)

5. Update `settings-context-platform-import.tsx` with login/logout UI
6. Create `useSteamLogin` hook
7. Add toast notifications for login/logout

### Phase 3: Game & Playtime Sync

8. Create `src/main/services/steam-game-sync.ts`
9. Modify `steam-web-api.ts` to support `access_token` auth
10. Add IPC events: `steamSync`
11. Implement auto-sync on startup
12. Add sync UI (button, status display) to settings page
13. Add toast notifications for sync results

### Phase 4: Install & Launch via Steam

14. Add `steam://install/{appId}` support to download flow
15. Add "Play via Steam" to game actions/context menu
16. Add ACF manifest polling for install detection
17. Add IPC events for install watching

### Phase 5: Download Modal Tabs (Follow-up)

18. Modify download modal to show Hydra Sources / Steam Store tabs
19. Handle owned/not-owned state for store tab

---

## 12. Edge Cases & Notes

- **Steam not installed**: Login still works (web-based), but install/launch via Steam options are hidden. Sync still works for library/playtime data.
- **Multiple Steam accounts on machine**: The login flow lets any user log in. The `loginusers.vdf` file is not used for login — it's only used for family member discovery (existing behavior).
- **Offline mode**: If Steam API is unreachable, sync fails gracefully with an error toast. Previously synced data is preserved.
- **Very large libraries (1000+ games)**: Sync may take time. Show a progress indicator. The API call itself is fast; the bottleneck is writing to LevelDB and syncing to Hydra API for each game. Consider batching the Hydra API calls.
- **Family sharing**: The existing Steam family scanning (web API key based) should also work with the access token. Add `access_token` parameter support to `scanSteamFamily`.
- **Race condition on playtime**: If a game is currently running and Steam sync fires, skip the playtime update for that game to avoid overwriting active session data.
- **Token validation on startup**: A lightweight API call (e.g., `ISteamUser/GetPlayerSummaries` for just the logged-in user) is used to check if the token is still valid.
- **macOS/Linux**: The `steam://` protocol may behave differently. On macOS, use `open` command. On Linux, use `xdg-open` or direct `steam` command.
