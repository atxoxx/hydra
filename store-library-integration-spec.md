# Store Library Integration — Specification

## Overview

Add OAuth-based authentication for game store accounts, import owned game libraries from those stores, display store badges throughout the UI, rework the library's PC category to use store tabs, add local install tracking, add sidebar store filtering, add install-status filtering, and dim uninstalled game covers.

## Reference

Playnite's extension model (https://github.com/JosefNemec/PlayniteExtensions/tree/master/source/Libraries) handles similar integrations using WebView-based OAuth, local token caching, and per-store library import logic. Hydra will use **system default browser** for OAuth instead of an embedded WebView.

---

## 1. Store OAuth Authentication

### 1.1 Supported Stores
All 10 modern PC platforms:
| Store | OAuth? | Import Method | Notes |
|-------|--------|---------------|-------|
| Steam | OpenID/OAuth via browser | Steam Web API (owned games) | Existing `steamApiKey` field may be replaced or supplemented |
| Epic Games | OAuth via browser | Epic Games Store API | Existing `epic-scanner.ts` for local only |
| GOG | OAuth via browser | GOG Galaxy API | Existing `gog-scanner.ts` for local only |
| Amazon Games | OAuth via browser | Amazon Games API | Existing `amazon-scanner.ts` for local only |
| Xbox / Game Pass | OAuth via browser | Xbox Live / Microsoft Graph API | Existing `xbox-scanner.ts` for local only |
| Battle.net | OAuth via browser | Battle.net API | Existing `battlenet-scanner.ts` for local only |
| Ubisoft Connect | OAuth via browser | Ubisoft Connect API | Existing `ubisoft-scanner.ts` for local only |
| Rockstar Games | OAuth via browser | Rockstar Games Launcher API | Existing `rockstar-scanner.ts` for local only |
| itch.io | OAuth via browser | itch.io API | Existing `itchio-scanner.ts` for local only |
| Humble Bundle | OAuth via browser | Humble API | Existing `humble-scanner.ts` for local only |

### 1.2 Auth Flow
1. User navigates to **Settings → Integrations** (new or expanded section)
2. User clicks "Connect" for a store
3. Hydra opens the store's OAuth authorization URL in the **system default browser**
4. After user logs in and authorizes, the store redirects to a **local callback URL** (e.g., `http://localhost:<port>/callback?store=<store>&code=<auth_code>`)
5. Hydra's main process listens on a local HTTP server, receives the code, exchanges it for tokens
6. Tokens are securely stored **encrypted on disk** (via `safeStorage` or similar Electron API)
7. Tokens **persist across restarts** until the user manually disconnects

### 1.3 Auth Persistence
- Tokens **persist until manually removed**
- User can disconnect individual stores from a new "Connected Accounts" section in Settings
- Disconnecting a store **removes all games** imported from that store from the library (with confirmation dialog)

### 1.4 Token Storage
- Use Electron's `safeStorage.encryptString()` / `safeStorage.decryptString()` for token storage
- Store in LevelDB under a new sublevel (e.g., `storeAuth`) or alongside user preferences
- Refresh tokens are handled transparently when APIs return 401

---

## 2. Library Import

### 2.1 Import Flow
1. After successful authentication, a "Sync Library" action is available per connected store
2. Import happens:
   - **On app startup** (automatically for all connected stores)
   - **Manually** (user clicks "Sync Now" per store in Settings)
3. Store API is called to fetch the user's owned games list
4. Each fetched game is imported as a **separate entry** in the library (not merged with existing entries)
5. Imported games are tagged with `source: <GameShop>` and `autoImported: true` (existing pattern)

### 2.2 Existing vs Imported Games
- **Merge by unique ID is NOT used** — separate entries per store
- A game owned on both Steam and Epic will appear twice in the library, each with its respective store badge
- Each entry can have its own executable path, install status, and metadata

### 2.3 Existing `fetchOwned` Distinction
- The current `PlatformScanConfig.fetchOwned` boolean in `settings-context-platform-import.tsx` is **superseded by OAuth-based imports**
- However, the `scanInstalled` path (file-system scanning for installed executables) **remains** as a complementary mechanism
- The "Platform Import" settings page will be reworked or split into two sections:
  - **Connected Accounts** (OAuth, library sync)
  - **Local Scanning** (file-system scanning for installed games)

---

## 3. Store Badges

### 3.1 Design
- **Icon + text** on game cards
- Store icon sourced from **bundled static assets** (SVGs or PNGs in Hydra's source)
- Text shows the store name (e.g., "Steam", "Epic")

### 3.2 Placement: Game List Cards (Compact)
- Badge appears in the **top section** overlay of `LibraryGameCard`, alongside the existing playtime/achievements badges
- Positioned on the top-left or top-right corner of the card
- Uses existing badge styling patterns (like the current "Installed" badge or "PS/PS2" platform badge)

### 3.3 Placement: Game List Cards (Large)
- Badge appears in the metadata row of `LibraryGameCardLarge`
- Shown alongside existing info like platform, release year, etc.

### 3.4 Placement: Game Details Page
- Badge appears **next to the game title** in the hero/header area of `game-details`
- Store icon + store name, prominently displayed

### 3.5 Placement: Sidebar Game Items
- **Icon only** (no text) — a small store icon before or after the game title
- Subtle and compact to fit the sidebar's space-constrained design
- Uses the same bundled store icon assets

---

## 4. Library Rework — Store Tabs

### 4.1 Current State
- The `CategoryFilter` component renders: `[All] [PC ▼] [Classics]` where PC has a dropdown `<select>` to filter by store
- The dropdown options are `All PC` + each of the `MODERN_SHOPS`

### 4.2 New Design
- When PC category is selected, display a **horizontal tab bar** instead of the dropdown
- Tabs: `[All PC] [Local] [Steam] [Epic] [GOG] [Amazon] [Xbox] [Battle.net] [Ubisoft] [Rockstar] [itch.io] [Humble]`
- The tab bar should be horizontally scrollable or wrap if space is limited
- Active tab is visually highlighted (matching the current `library-category-filter__option--active` style)

### 4.3 Tab Behavior
- **"All PC"** — shows all PC games from all stores (default)
- **"Local"** — shows only games that are detected as locally installed (see §5)
- **Store-specific tabs** — filter to only show games with `shop` matching that store

### 4.4 "Local" Tab
- Filters to games where `isInstalled: true` (see §5)
- Covers games from ALL shops, not just one
- The "Local" tab is always visible regardless of which stores are connected

---

## 5. Local Install Tracking

### 5.1 Definition
A game is considered **locally installed** if either:
1. It was **downloaded through Hydra** (has a valid `executablePath` populated by the download/extract flow)
2. It was **discovered by file-system scanning** (platform scanners detected an executable on disk)

### 5.2 Detection Mechanism
- Combine existing checks:
  - `Boolean(game.executablePath)` — Hydra-installed games
  - `game.installedSizeInBytes != null` — file-system scanned games
  - Platform scanner results that set `executablePath` on import
- Add a derived `isInstalled` flag accessible on `LibraryGame` (already exists in the type definition but may need to be populated)

### 5.3 UI Integration
- The "Local" tab in the store tab bar (see §4.4)
- The install-status filter (see §6)
- The "Installed" badge on game cards (already exists — may be enhanced)

---

## 6. Install Status Filter

### 6.1 Design
- A **segmented button row** (toggle group) in the library header, placed near the sort/view controls
- Shows: `[All] [Installed] [Not Installed]`
- **PC category only** — hidden when viewing All or Classics categories

### 6.2 Behavior
- **All** — shows all games (default, no filter applied)
- **Installed** — filters to games where `isInstalled` is true (has executable path or installed size)
- **Not Installed** — filters to games where `isInstalled` is false (no local installation detected)

### 6.3 State Persistence
- The user's filter selection **persists in localStorage** across sessions
- Key: `library-install-filter` with values `"all"`, `"installed"`, `"not_installed"`

### 6.4 Interaction with Other Filters
- Combines with the store tab filter (e.g., "Steam + Installed")
- Combines with collection filter (e.g., "Favorites + Not Installed")
- Combines with search query
- Applied in the existing `filteredLibrary` `useMemo` pipeline

---

## 7. Sidebar Store Filtering

### 7.1 Design
- A new **collapsible "Stores" section** in the sidebar, below "Collections" and above "Suggestions" (or above "Games")
- Contains checkboxes/toggles for each store
- Collapsible with the same expand/collapse pattern as existing sections

### 7.2 Behavior
- Store checkboxes **operate independently** from the library's store tabs — no bidirectional sync
- The sidebar filter affects:
  - Which games appear in the **sidebar game list**
  - Optionally which games appear in **Suggestions**
- The sidebar filter does NOT affect the library grid view — that's controlled by the tab bar independently

### 7.3 Options
- "All Stores" toggle (default all checked)
- Individual toggle per store: Steam, Epic, GOG, Amazon, Xbox, Battle.net, Ubisoft, Rockstar, itch.io, Humble
- Local/custom games checkbox (for custom-added and locally-installed games)

### 7.4 Interaction with Collections
- **Collections are unaffected** by store filtering
- Collection game counts always reflect the full library regardless of active store filters

---

## 8. Dimming Uninstalled Games

### 8.1 Visual Design
- Game cover/thumbnail images are dimmed when the game is **not locally installed**
- Dimming is applied via CSS: `opacity: 0.45` (or similar) on the image element
- **Only the image is dimmed** — text, badges, playtime, and achievements remain at full opacity
- Applies to both compact (`LibraryGameCard`) and large (`LibraryGameCardLarge`) views

### 8.2 Behavior
- Dimmed cards remain **fully interactive** — single-click to open game details, right-click for context menu, double-click to launch (if playable)
- The existing "Installed" badge (green checkmark) on installed games already provides a positive indicator; dimming adds the negative indicator for uninstalled games

### 8.3 CSS Implementation
```scss
.library-game-card__game-image--not-installed {
  opacity: 0.45;
  // Optionally: filter: grayscale(30%);
}
```

- A CSS class is conditionally applied based on `game.executablePath` and `game.installedSizeInBytes`

---

## 9. Technical Components Affected

### 9.1 Main Process (`src/main/`)
| File | Changes |
|------|---------|
| `services/platform-scanner.ts` | May need updates for new import flow |
| `services/hydra-api.ts` | Possibly API endpoints for store auth |
| `services/` — new | New `store-auth/` service for OAuth flows, token management |
| `services/` — new | New `store-import/` service per store (or extend existing platform scanners) |
| `events/library/` — new | Events: `connectStore`, `disconnectStore`, `syncStoreLibrary`, `handleOAuthCallback` |
| `level/` | New sublevel for auth tokens |

### 9.2 Renderer Process (`src/renderer/src/`)
| File | Changes |
|------|---------|
| `pages/library/category-filter.tsx` | Major rework: dropdown → tab bar with `[All PC] [Local] [Store...]` |
| `pages/library/category-filter.scss` | New tab bar styles |
| `pages/library/library.tsx` | Add install-status filter toggle row; wire up `isInstalled` filtering |
| `pages/library/library-game-card.tsx` | Add store badge (icon+text); add dimming class for uninstalled games |
| `pages/library/library-game-card.scss` | Store badge styles; `.not-installed` dimming class |
| `pages/library/library-game-card-large.tsx` | Add store badge in metadata row; add dimming class |
| `pages/library/library-game-card-large.scss` | Store badge styles; `.not-installed` dimming class |
| `pages/library/library.scss` | Install filter toggle styles |
| `components/sidebar/sidebar.tsx` | New collapsible "Stores" section with checkboxes |
| `components/sidebar/sidebar.scss` | Store section styles |
| `components/sidebar/sidebar-game-item.tsx` | Small store icon badge (icon only) |
| `pages/game-details/` | Store badge next to title in hero/header |
| `pages/settings/settings-context-integrations.tsx` | Major expansion: connected accounts, OAuth buttons, sync buttons |
| `features/` — new or modified | New Redux slice: `store-integration-slice` for auth state, connected stores |
| `hooks/` — new | `use-store-integrations.ts` hook |

### 9.3 Types (`src/types/`)
| File | Changes |
|------|---------|
| `game.types.ts` | Potentially add store icon mapping |
| `index.ts` | Add types for store auth state, connected account info |
| `level.types.ts` | Add `storeAuth` sublevel types if needed |

### 9.4 Assets
| Path | Description |
|------|-------------|
| `src/renderer/src/assets/store-icons/` | New directory with bundled store icon SVGs/PNGs |
| — Steam, Epic, GOG, Amazon, Xbox, Battle.net, Ubisoft, Rockstar, itch.io, Humble icons |

### 9.5 i18n (`src/locales/`)
- New translation keys for: connected accounts, connect/disconnect buttons, sync status, store labels, install filter labels, "Local" tab, sidebar Stores section

---

## 10. Open Questions / Future Considerations

1. **Steam API Key vs OAuth**: Currently Steam uses a user-provided Web API key. Should OAuth replace this entirely, or supplement it for owned-games fetching? The spec assumes OAuth replaces the manual key for library import but may keep it for Steam-specific features (achievements, player counts).

2. **Game Pass catalog**: Xbox Game Pass includes a rotating catalog. Should the import treat Game Pass games differently (e.g., mark them as "subscription-based" with expiration awareness)?

3. **Rate limiting**: Store APIs may have rate limits. The startup sync should be staggered or batched to avoid hitting limits.

4. **Offline mode**: What happens to imported games when the user is offline? Store badges should still display (cached), but sync will fail gracefully.

5. **Error handling**: Failed imports should not block the UI. Each store sync should have independent error handling with user-visible status indicators.

6. **Store icon licensing**: Verify that bundled store icons comply with each store's branding guidelines.

---

## 11. Summary of Decisions

| Decision | Choice |
|----------|--------|
| Auth method | System default browser + local callback |
| Stores covered | All 10 (Steam, Epic, GOG, Amazon, Xbox, Battle.net, Ubisoft, Rockstar, itch.io, Humble) |
| Dedup strategy | Separate entries per store |
| Store tabs | Tabs: All PC, Local, then each store |
| Install filter | Toggle row (All / Installed / Not Installed), PC only |
| Install filter persistence | Persisted in localStorage |
| Dim behavior | Image only, reduced opacity, fully interactive |
| Store badge design | Icon + text on cards, icon only in sidebar |
| Game page badge | Next to title |
| Sidebar store filter | Collapsible checkboxes section, independent from library tabs |
| Sidebar ⇔ library sync | Independent (no bidirectional sync) |
| Collections + stores | Collections unaffected by store filter |
| Auth persistence | Persist until manually removed |
| Disconnect behavior | Remove all imported games from that store |
| Import schedule | On app startup + manual sync |
| Store icon source | Bundled static assets |
| Local install definition | Both Hydra downloads + file system scan |

---

## Appendix A: Store API Research — OAuth Endpoints & Library APIs

### A.1 Steam

| Aspect | Detail |
|--------|--------|
| **Authentication Type** | OpenID 2.0 for consumer apps; proprietary OAuth 2.0 for Steamworks partners only |
| **OAuth Authorization URL** | `https://steamcommunity.com/oauth/login?response_type=token&client_id=<ID>&state=<STATE>` (partners only) |
| **Token Format** | Opaque (32-char hex string, subject to change) |
| **Refresh Token** | Not used; token lifetime configured with Valve during partner onboarding |
| **Scopes** | App-specific (e.g., `read_cloud`, `write_cloud`), not standard OAuth scopes |
| **API Key Required** | Yes — a WebAPI Publisher Key is still required alongside OAuth for most Web API calls |
| **Owned Games Endpoint** | `GET https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=<API_KEY>&steamid=<STEAMID64>` |
| **Callback/Redirect** | Must be registered with Valve during Client ID application |
| **Feasibility for Hydra** | **Low for OAuth** (partners only). **High for OpenID + API Key** — use OpenID to get user's SteamID64, then call GetOwnedGames with the user-provided API key + SteamID. The existing `steamApiKey` flow can be retained and enhanced with OpenID for automated SteamID discovery. |
| **Playnite Reference** | Uses `SteamKit2` library + `steam://` protocol + Steam Web API. OpenID login in WebView. |

### A.2 Epic Games

| Aspect | Detail |
|--------|--------|
| **Authentication Type** | OAuth 2.0 via Epic Account Services (EAS) |
| **OAuth Authorization URL** | Managed via [Epic Developer Portal](https://dev.epicgames.com/) |
| **Token Exchange URL** | `https://api.epicgames.dev/auth/v1/oauth/token` |
| **Token Format** | **JWT** (JSON Web Token) with `sub`, `iss`, `scopes`, `exp` claims |
| **Refresh Token** | Standard OAuth 2.0 `refresh_token` flow via token endpoint |
| **Scopes** | `basic_profile`, `friends_list`, `presence` (configured in Developer Portal) |
| **Owned Games Endpoint** | `https://api.epicgames.dev/ecom/v1/accounts/{accountId}/entitlements` |
| **Limitations** | **No public "browse all owned games" API.** The Ecom entitlements endpoint only checks ownership of YOUR specific product. Third-party library enumeration requires reverse-engineered private APIs. |
| **Feasibility for Hydra** | **Medium** — requires Epic Developer registration. The entitlements endpoint is per-game verification, not bulk. Alternative: parse local Epic launcher files (existing `epic-scanner.ts`). May need to rely on community-reverse-engineered endpoints for full library. |
| **Playnite Reference** | OAuth via WebView → Epic public endpoints → Account/Inventory APIs. Embeds client ID/secret. |

### A.3 GOG

| Aspect | Detail |
|--------|--------|
| **Authentication Type** | OAuth 2.0-like flow (unofficial/internal API) |
| **OAuth Authorization URL** | `https://auth.gog.com/auth?client_id=46899977096215655&redirect_uri=https://embed.gog.com/on_login_success?origin=client&response_type=code&layout=client2` |
| **Token Exchange URL** | `https://auth.gog.com/token` |
| **Token Format** | Standard Bearer token |
| **Refresh Token** | Supported — `POST https://auth.gog.com/token` with `grant_type=refresh_token`, `refresh_token`, `client_id`, `client_secret` |
| **Client Secret** | Hardcoded in open-source integrations: `9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9` |
| **Scopes** | No scope parameter; access is session-based |
| **Owned Games Endpoint** | `GET https://embed.gog.com/user/data/games` or `GET https://embed.gog.com/library/windows` |
| **Limitations** | **No official public API.** All endpoints are reverse-engineered from the GOG Galaxy client. Subject to change without notice. |
| **Feasibility for Hydra** | **High** — well-understood community endpoints. Token refresh works reliably. Risk: unofficial APIs may break. |
| **Playnite Reference** | WebView login → auth code → token exchange → library API. |

### A.4 Amazon Games

| Aspect | Detail |
|--------|--------|
| **Authentication Type** | OAuth 2.0 via Login with Amazon (LWA) |
| **OAuth Authorization URL** | `https://www.amazon.com/ap/oa` (regional: `api.amazon.co.uk`, `api.amazon.co.jp`) |
| **Token Exchange URL** | `https://api.amazon.com/auth/o2/token` |
| **Token Format** | Opaque Bearer token |
| **Refresh Token** | Standard `grant_type=refresh_token` flow; refresh token returned with initial token exchange |
| **Registration** | [Amazon Developer Console](https://developer.amazon.com/loginwithamazon/console/site/lwa/overview.html) → obtain `client_id` and `client_secret` |
| **Owned Games Endpoint** | **No public API.** Amazon Games/Prime Gaming library is accessible only via internal SDKs and non-public APIs. |
| **Feasibility for Hydra** | **Low** — LWA provides authentication but no standardized owned-games API. May need to parse local Amazon Games client files (existing `amazon-scanner.ts`) or reverse-engineer internal endpoints. |
| **Playnite Reference** | Login window → session tokens → internal APIs for game list. Relies on local file scanning heavily. |

### A.5 Xbox / Microsoft

| Aspect | Detail |
|--------|--------|
| **Authentication Type** | OAuth 2.0 via Microsoft Identity Platform (Azure AD / Entra ID) |
| **OAuth Authorization URL** | `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize` (`tenant` = `common` for consumer accounts) |
| **Token Exchange URL** | `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token` |
| **Token Format** | **JWT** (v2.0) |
| **Refresh Token** | Standard `grant_type=refresh_token` flow. Access tokens expire ~60-90 min; refresh tokens provide long-term access. |
| **Required Scopes** | `openid`, `profile`, `email`, `offline_access`, `xboxlive.signin` |
| **Owned Games Endpoint** | `https://collections.mp.microsoft.com/v6.0/` (Microsoft Store Collections API) — requires exchanging Entra ID token for a **User Store ID** (JWT) via `XStoreGetUserCollectionsIdAsync` or `x-tokens` |
| **Game Pass Catalog** | Separate from owned games; accessed via Xbox Live Catalog/Marketplace APIs (requires different service-token audiences and GDK access) |
| **Limitations** | **Requires Microsoft Partner Center approval** for production access to Store/Xbox Live APIs. Complex multi-step token exchange. |
| **Feasibility for Hydra** | **Medium-Low** — OAuth flow is well-documented, but Store Collections API requires partner approval. The token exchange (Entra ID → User Store ID) adds complexity. Existing `xbox-scanner.ts` for local file scanning remains essential. |
| **Playnite Reference** | WebView Microsoft login → session cookies → Xbox Live/internal APIs. |

### A.6 Battle.net (Blizzard)

| Aspect | Detail |
|--------|--------|
| **Authentication Type** | Standard OAuth 2.0 |
| **OAuth Authorization URL** | `https://oauth.battle.net/authorize` |
| **Token Exchange URL** | `https://oauth.battle.net/token` |
| **Token Format** | Standard Bearer token |
| **Refresh Token** | Standard OAuth 2.0 refresh flow via token endpoint |
| **Registration** | [Blizzard Developer Portal](https://develop.battle.net/) → create Client → `client_id` + `client_secret` |
| **Owned Games Endpoint** | **No official public endpoint.** The official Blizzard APIs focus on Game Data (WoW realms, items) and Profile Data (character stats). Community endpoints (e.g., `/api/games-and-subs`) are unofficial and unsupported. |
| **Feasibility for Hydra** | **Low** — OAuth is solid and well-documented, but Blizzard does not expose an owned-games API. Likely need to parse local Battle.net/CASC installation files (existing `battlenet-scanner.ts`) and/or reverse-engineer the desktop client's internal API. |
| **Playnite Reference** | Battle.net login page → parses CASC local installation files + API calls to determine installed vs. owned. |

### A.7 Ubisoft Connect

| Aspect | Detail |
|--------|--------|
| **Authentication Type** | Proprietary (no public OAuth 2.0) |
| **OAuth Authorization URL** | **None public.** Auth via internal REST APIs (`ubiservices`) |
| **Token Exchange** | `POST https://public-ubiservices.ubi.com/v3/profiles/sessions` with email+password → authentication ticket → further tokens per service |
| **Token Format** | Proprietary session tickets (e.g., `Authorization: ubi_v1 t=<ticket>`), `Ubi-AppId` header |
| **Refresh Token** | Not officially supported. Session/ticket maintenance or re-authentication required. |
| **Owned Games Endpoint** | **No public API.** Community projects use internal URLs for entitlement catalogs. Unstable, undocumented, prone to breaking. |
| **Limitations** | No developer portal. Community warns that mimicking the client's login can trigger account bans or security flags. |
| **Feasibility for Hydra** | **Very Low** — no OAuth, no public API, account risk. The safest approach is to rely on local file scanning (existing `ubisoft-scanner.ts`) and potentially email+password login if absolutely necessary (with strong user warnings). |
| **Playnite Reference** | Login window → session tickets → internal UbiServices APIs. |

### A.8 Rockstar Games

| Aspect | Detail |
|--------|--------|
| **Authentication Type** | Cookie-based web session (no public OAuth 2.0) |
| **OAuth Authorization URL** | **None.** Authentication requires mimicking browser login to Social Club. |
| **Token Exchange** | N/A — uses session cookies, not OAuth tokens |
| **Token Format** | Session cookies persisted across requests |
| **Refresh Token** | N/A — session cookies expire and require full re-login |
| **Owned Games Endpoint** | **No public API.** Access requires authenticated requests to internal Social Club endpoints using session cookies. |
| **Feasibility for Hydra** | **Very Low** — no OAuth, cookie-based auth is fragile, no public API. Best approach: local file scanning (existing `rockstar-scanner.ts`) is the primary method. |
| **Playnite Reference** | Login window → session cookies → internal profile/library endpoints. |

### A.9 itch.io

| Aspect | Detail |
|--------|--------|
| **Authentication Type** | Standard OAuth 2.0 |
| **OAuth Authorization URL** | `https://itch.io/user/oauth` |
| **Token Exchange URL** | `https://itch.io/api/oauth/token` |
| **Token Format** | Standard Bearer token |
| **Refresh Token** | Standard OAuth 2.0 refresh flow |
| **Scopes** | `profile:me` (identity), plus game-specific scopes |
| **Owned Games Endpoint** | `https://api.itch.io/profile/owned-games` (authenticated) — **but scope-limited** to prevent scraping |
| **Limitations** | Scopes that would allow listing all owned games from other developers are restricted to protect user privacy. Full game library enumeration may not be available without per-developer authorization. |
| **Feasibility for Hydra** | **Medium-High** — clean, public OAuth 2.0 implementation. However, the `owned-games` endpoint may return a limited view of the user's library. Developer registration required. |
| **Playnite Reference** | WebView OAuth → API key/token → library queries. |

### A.10 Humble Bundle

| Aspect | Detail |
|--------|--------|
| **Authentication Type** | Cookie-based web session (no OAuth 2.0) |
| **OAuth Authorization URL** | **None.** |
| **Token Exchange** | N/A. Login via `https://hr-humblebundle.appspot.com/processlogin` with username, password, 2FA (Authy/SMS), and CAPTCHA |
| **Token Format** | Session cookies + `X-Requested-By: hb_android_app` header (mimics mobile app) |
| **Refresh Token** | N/A — session cookies expire |
| **Owned Games Endpoint** | `GET https://www.humblebundle.com/api/v1/user/order` (list orders); `GET https://www.humblebundle.com/api/v1/order/{gamekey}` (order details with individual game keys) |
| **Limitations** | CAPTCHA requirement makes automated login near-impossible without user interaction. No OAuth. May trigger security flags. |
| **Feasibility for Hydra** | **Low** — CAPTCHA-based login, no OAuth, fragile cookie-based auth. The API endpoints for orders are well-understood by the community (see [Humble Bundle API docs](https://www.schiff.io/projects/humble-bundle-api/)), but authentication is the bottleneck. Likely need an interactive login window + CAPTCHA solving. |
| **Playnite Reference** | Login window → session cookies → Humble API endpoints (orders, keys). |

---

## Appendix B: Feasibility Summary Matrix

| Store | OAuth Available | Public Owned-Games API | Overall Feasibility | Recommended Primary Approach |
|-------|----------------|------------------------|---------------------|------------------------------|
| **Steam** | ⚠️ Partners only | ✅ Yes (with API key) | **High** | OpenID + user-provided API key + GetOwnedGames |
| **Epic Games** | ✅ Yes | ⚠️ Per-game only | **Medium** | OAuth + reverse-engineered endpoints + local scanning |
| **GOG** | ⚠️ Unofficial | ⚠️ Unofficial | **High** | Reverse-engineered OAuth flow + library endpoints |
| **Amazon Games** | ✅ Yes (LWA) | ❌ None | **Low** | LWA OAuth + local file scanning |
| **Xbox / Microsoft** | ✅ Yes (Entra ID) | ⚠️ Partner-gated | **Medium-Low** | Entra ID OAuth + Store Collections API (if approved) + local scanning |
| **Battle.net** | ✅ Yes | ❌ None | **Low** | OAuth + local CASC file scanning |
| **Ubisoft Connect** | ❌ None | ❌ None | **Very Low** | Local file scanning only (avoid account risk) |
| **Rockstar Games** | ❌ None | ❌ None | **Very Low** | Local file scanning only |
| **itch.io** | ✅ Yes | ⚠️ Limited | **Medium-High** | OAuth + owned-games endpoint (limited) |
| **Humble Bundle** | ❌ None | ⚠️ Unofficial (orders API) | **Low** | Interactive login + CAPTCHA + orders API |

---

## Appendix C: Recommended Phased Approach

Based on feasibility, the implementation should be phased:

### Phase 1 — High Feasibility (Well-documented APIs)
- **Steam**: OpenID + API Key + GetOwnedGames (enhance existing steamApiKey flow)
- **GOG**: OAuth flow + library endpoints (well-understood community APIs)
- **itch.io**: Public OAuth + owned-games endpoint

### Phase 2 — Medium Feasibility (OAuth exists, API is limited)
- **Epic Games**: OAuth + supplemented by local scanning + community endpoints
- **Xbox / Microsoft**: Entra ID OAuth + Store Collections API (may need partner approval)

### Phase 3 — Low Feasibility (No OAuth or no API)
- **Amazon Games**: LWA OAuth + local scanning (accept limited library import)
- **Battle.net**: OAuth + CASC file scanning (accept limited library import)
- **Ubisoft Connect**: Local file scanning only (accept no library import from account)
- **Rockstar Games**: Local file scanning only (accept no library import from account)
- **Humble Bundle**: Interactive login window + orders API (if CAPTCHA flow is feasible)

### Common Infrastructure (All Phases)
- Local HTTP server for OAuth callback handling
- Encrypted token storage via `safeStorage`
- Token refresh manager
- Store badge asset bundling
- Library UI rework (tabs, filters, dimming)
- Sidebar store filtering
