# Deals Page — Specification

## Summary

Add a new **Deals** page to Hydra Launcher accessible via a new `TagIcon` button in the sidebar tab-bar (alongside Store, Library, Watchlist, and Activity). The page uses an **extensible sub-tab architecture** to host multiple deal/catalog sources. Initial sources: **IsThereAnyDeal** (price deal monitoring + general game deal search) and **Xbox GamePass** (full catalog browser with region selection, genre/platform filtering, and direct Xbox app launching).

---

## 1. Sidebar Integration

### 1.1 New Deals Tab

- **Location**: In the top navigation tabs of `src/renderer/src/components/tab-bar/tab-bar.tsx`, after the Activity tab
- **Icon**: `TagIcon` from `@primer/octicons-react`
- **Label**: i18n key `"deals"` (namespace: `"sidebar"`)
- **Route**: `/deals`
- **Visibility**: Always visible (regardless of sign-in status)
- **Active state**: Highlighted when `location.pathname.startsWith("/deals")`

### 1.2 Route Registration

- Add `<Route path="/deals/*" element={<Deals />} />` inside the `<Route element={<App />}>` group in `src/renderer/src/main.tsx`
- Import the new `Deals` page component

### 1.3 Tab Bar Changes

Add to the `TABS` array in `tab-bar.tsx`:

```typescript
{
  labelKey: "deals",
  path: "/deals",
  render: () => <TagIcon size={16} />,
},
```

Position it **after** the Activity tab (index 4, making it the 5th tab).

---

## 2. Deals Page Layout

### 2.1 Page Structure

The Deals page is a full-page route rendered inside the existing `<App />` layout (with Header, TabBar/Sidebar, BottomPanel).

```
┌─────────────────────────────────────────────────────────────┐
│  Deals Page Header                                          │
│  ┌──────────────────────────────────┐                       │
│  │ [IsThereAnyDeal] [Xbox GamePass] │  ← Sub-tab bar        │
│  └──────────────────────────────────┘                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Active Sub-tab Content (fills remaining space)              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Sub-Tab Bar

- Horizontal tab bar below the page header
- Styled similarly to the `website-links-tab-bar` pattern (tabs with icons + labels)
- Default active: **Xbox GamePass** (as per user preference)
- Persist last-used sub-tab in `localStorage` key `hydra_deals_last_tab`
- Sub-tabs defined via a config array (see extensibility in §8)

### 2.3 Sub-Tab Content Area

- Occupies full remaining vertical space below the sub-tab bar
- Scrollable vertically
- Content is rendered by the active `DealSource` component

---

## 3. Extensible Deal Source Architecture

### 3.1 DealSource Interface

```typescript
interface DealSourceConfig {
  /** Unique ID for this source (e.g., "isthereanydeal", "xbox-gamepass") */
  id: string;
  /** Display label i18n key (namespace: "deals") */
  labelKey: string;
  /** Icon component for the sub-tab */
  icon: React.ReactNode;
  /** The React component to render when this sub-tab is active */
  component: React.ComponentType<DealSourceProps>;
  /** Whether this source is enabled (can be toggled in settings) */
  enabled: boolean;
  /** Whether this source requires configuration (e.g., API key) */
  requiresConfig: boolean;
}

interface DealSourceProps {
  /** Called when the source needs to signal an update (e.g., after config changes) */
  onConfigured: () => void;
}
```

### 3.2 Registration

Deal sources are registered in a central array in `src/renderer/src/pages/deals/deal-sources.ts`:

```typescript
export const DEAL_SOURCES: DealSourceConfig[] = [
  {
    id: "xbox-gamepass",
    labelKey: "xbox_gamepass",
    icon: <XboxIcon />,  // custom Xbox logo
    component: GamePassBrowser,
    enabled: true,
    requiresConfig: false,
  },
  {
    id: "isthereanydeal",
    labelKey: "isthereanydeal",
    icon: <TagIcon size={14} />,
    component: IsThereAnyDealPanel,
    enabled: true,
    requiresConfig: true, // needs API key
  },
];
```

Adding new sources in the future means:

1. Adding an entry to `DEAL_SOURCES`
2. Creating the component
3. Adding i18n keys
4. Optionally adding settings for that source

---

## 4. IsThereAnyDeal Integration

### 4.1 Overview

The ITAD sub-tab has two modes:

1. **Library/Wishlist Monitor**: Shows current deals for games in the user's Hydra library and wishlist. This is the primary "dashboard" view.
2. **Game Search**: An inline search to look up any game on ITAD and see its current and historical deals.

### 4.2 Data Source

- **ITAD REST API**: `https://api.isthereanydeal.com/`
- **Authentication**: API key (required)
- **API Key Storage**: Stored in `userPreferences` via existing Redux/LevelDB flow, settable in Settings → Integrations
- **API Calls**: Made through the Electron **main process** via IPC (to keep the API key secure — never expose to renderer)

### 4.3 IPC Events

| Event Name                | Direction     | Purpose                                             |
| ------------------------- | ------------- | --------------------------------------------------- |
| `itad:search-game`        | renderer→main | Search for a game by title on ITAD                  |
| `itad:get-prices`         | renderer→main | Get current prices for a list of ITAD game IDs      |
| `itad:get-library-deals`  | renderer→main | Get deals for all library/wishlist games            |
| `itad:lookup-by-steam-id` | renderer→main | Look up ITAD game data by Steam app ID              |
| `itad:get-store`          | renderer→main | Get ITAD configuration (API key status, store list) |

### 4.4 ITAD API Endpoints Used

Per the [ITAD API docs](https://docs.isthereanydeal.com/):

- `POST /lookup/id/shop/steam/v1` — Look up ITAD IDs from Steam App IDs (for library/wishlist games with Steam shop)
- `GET /games/search/v1` — Search games by title (for general search)
- `POST /prices/` — Get current prices for ITAD game IDs
- `GET /stores/v1` — List supported stores (for displaying store logos)

### 4.5 Library/Wishlist Monitor View

#### Data Flow

1. On sub-tab mount, call `window.electron.itad.getLibraryDeals()`
2. Main process fetches user's library + wishlist games from LevelDB
3. For each game with a Steam App ID, batch-lookup via ITAD
4. Get current prices for all matched ITAD IDs
5. Return sorted list of deals to renderer

#### Display

```
┌─────────────────────────────────────────────────────────────┐
│  Deals for Your Games                         [🔄 Refresh]  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐│
│  │ [Game Cover]  Grand Theft Auto V                        ││
│  │               Current Best: $14.99 (-50%) at Steam      ││
│  │               Historical Low: $9.99 at GreenManGaming   ││
│  │               [Compare All Prices →]                    ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │ [Game Cover]  Elden Ring                                ││
│  │               Current Best: $39.99 (-33%) at Fanatical  ││
│  │               Historical Low: $29.99 at Steam           ││
│  │               [Compare All Prices →]                    ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

- Each row shows: game cover/title, best current deal, historical low
- Clicking a row or "Compare All Prices" expands a detailed view with all stores
- Sorting options: Best Deal, Biggest Discount, Title A-Z
- Empty state: "No deals found for your library games" with link to search

#### Store Logos

- Use store logos from ITAD's CDN or bundle them as local assets
- Store names: Steam, GOG, Epic, Humble, Fanatical, GreenManGaming, etc.

### 4.6 Game Search View

```
┌─────────────────────────────────────────────────────────────┐
│  [🔍 Search for a game...                           ]       │
├─────────────────────────────────────────────────────────────┤
│  Search Results (appears after search)                      │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ [Cover]  Cyberpunk 2077                                 ││
│  │          Current Best: $19.99 at Steam                  ││
│  │          Historical Low: $14.99 at Epic Games           ││
│  │          [View Deals]                                   ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

- Inline search input at top
- Results as cards/list with current best price
- Clicking a result shows the detailed deal comparison view
- Debounced search (300ms after last keystroke)
- Loading skeleton while searching
- "No results" state with suggestion to try different terms

### 4.7 Detailed Deal Comparison (Expanded View)

When a game is clicked (from either monitor or search):

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Deals                                           │
│                                                             │
│  [Large Game Cover]  Grand Theft Auto V                     │
│                                                             │
│  Current Deals:                                             │
│  ┌──────────┬───────────┬──────────┬──────────────────────┐ │
│  │ Store    │ Price     │ Discount │ Link                 │ │
│  ├──────────┼───────────┼──────────┼──────────────────────┤ │
│  │ Steam    │ $14.99    │ -50%     │ [View on Store]      │ │
│  │ GOG      │ $19.99    │ -33%     │ [View on Store]      │ │
│  │ Fanatical│ $12.99    │ -57%     │ [View on Store]      │ │
│  └──────────┴───────────┴──────────┴──────────────────────┘ │
│                                                             │
│  Historical Low: $9.99 at GreenManGaming (2025-03-15)      │
│                                                             │
│  [Open ITAD Page in Browser]                                │
└─────────────────────────────────────────────────────────────┘
```

- Sortable columns: Store, Price, Discount
- "View on Store" opens the store URL in external browser
- "Open ITAD Page" opens the game's ITAD page
- Animated expand/collapse transition

### 4.8 API Key Management

#### Settings → Integrations → IsThereAnyDeal

```
┌─────────────────────────────────────────────────────────────┐
│  IsThereAnyDeal                                             │
│                                                             │
│  API Key: [••••••••••••••••••••••] [Show]                  │
│                                                             │
│  Get your API key at:                                       │
│  https://isthereanydeal.com/apps/                           │
│                                                             │
│  [Validate Key]  Status: ✓ Connected                        │
│                                                             │
│  Monitor wishlist games:  [✓]                               │
│  Monitor library games:   [✓]                               │
│  Enable deal notifications: [ ]                             │
│  Minimum discount to notify: [25%]                          │
└─────────────────────────────────────────────────────────────┘
```

#### Unconfigured State

If API key is not set, the ITAD sub-tab shows:

```
┌─────────────────────────────────────────────────────────────┐
│  🔑 IsThereAnyDeal requires an API key                     │
│                                                             │
│  Get a free API key at isthereanydeal.com/apps/             │
│  and configure it in Settings → Integrations.               │
│                                                             │
│  [Open Settings]                                            │
└─────────────────────────────────────────────────────────────┘
```

### 4.9 Caching

- ITAD prices cached for **15 minutes** in main process memory
- Library game → ITAD ID mapping cached persistently (rarely changes)
- Cache cleared on navigation away from Deals page or manual refresh

---

## 5. Xbox GamePass Integration

### 5.1 Overview

Full catalog browser for Xbox GamePass (PC) that displays currently available games with covers, metadata, filtering, and region selection. Users can browse the catalog and open games directly in the Xbox app.

### 5.2 Data Source

Uses Microsoft's **unofficial** catalog APIs (the same ones the Xbox app/PWA uses):

- **Catalog List**: `https://catalog.gamepass.com/sigls/v2?id=fdd9e2a7-0fee-49f6-ad69-4354098401ff&language={lang}&market={market}`
- **EA Play Catalog**: `https://catalog.gamepass.com/sigls/v2?id=1d33fbb9-b895-4732-a8ca-a55c8b99fa2c&language={lang}&market={market}`
- **Game Details**: `https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds={ids}&market={market}&languages={lang}&MS-CV=F.1`

### 5.3 IPC Events

Since these are public catalog APIs (no authentication), they can be called directly from the renderer _or_ via main process for consistency. **Decision**: Call from renderer directly using `fetch` (no API key to protect). The endpoints are public.

### 5.4 Region Selection

Inline dropdown at the top of the GamePass sub-tab:

```
┌─────────────────────────────────────────────────────────────┐
│  Region: [United States ▾]    [🔍 Search...]    [Filters ⏍]  │
└─────────────────────────────────────────────────────────────┘
```

**Supported regions** (market codes from Microsoft):

| Region                         | Market Code | Language |
| ------------------------------ | ----------- | -------- |
| United States                  | US          | en-us    |
| United Kingdom                 | GB          | en-gb    |
| Canada                         | CA          | en-ca    |
| France                         | FR          | fr-fr    |
| Germany                        | DE          | de-de    |
| Japan                          | JP          | ja-jp    |
| Australia                      | AU          | en-au    |
| Brazil                         | BR          | pt-br    |
| Mexico                         | MX          | es-mx    |
| Spain                          | ES          | es-es    |
| Italy                          | IT          | it-it    |
| Korea                          | KR          | ko-kr    |
| ... (full list of ~30 regions) |             |          |

- Default region: Detected from `navigator.language` or fallback to US
- Selection persisted in `localStorage` key `hydra_gamepass_region`

### 5.5 Catalog Browser UI

```
┌─────────────────────────────────────────────────────────────┐
│  Region: [US ▾]  [🔍 Search...]  Genres: [All ▾]           │
│                                     Platforms: [All ▾]      │
│                                     Sort: [A-Z ▾]          │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │[Cover]   │ │[Cover]   │ │[Cover]   │ │[Cover]   │      │
│  │          │ │          │ │          │ │          │      │
│  │Starfield │ │Forza     │ │Halo      │ │Sea of    │      │
│  │          │ │Horizon 5 │ │Infinite  │ │Thieves   │      │
│  │[Play]    │ │[Play]    │ │[Play]    │ │[Play]    │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │[Cover]   │ │[Cover]   │ │[Cover]   │ │[Cover]   │      │
│  │          │ │          │ │          │ │          │      │
│  │Lies of P │ │Palworld  │ │Diablo IV │ │Minecraft │      │
│  │          │ │          │ │          │ │          │      │
│  │[Play]    │ │[Play]    │ │[Play]    │ │[Play]    │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                             │
│  Showing 452 games                                          │
└─────────────────────────────────────────────────────────────┘
```

### 5.6 Game Card

Each card displays:

```scss
.game-card {
  // Cover image (poster/box art)
  // Game title
  // Developer/Publishers
  // Categories/genres (as tags/chips)
  // "Play on Xbox" button
}
```

**Card interactions**:

- Hover: Subtle scale (1.02) + shadow
- Click card body: Opens a detail modal/sheet
- Click "Play on Xbox": Opens `msxbox://game/?productId={id}` deep link (if available) or opens the Xbox app
- Fallback: If Xbox app deep link fails, open the Microsoft Store page

### 5.7 Filters

| Filter   | Type       | Values                                          |
| -------- | ---------- | ----------------------------------------------- |
| Genre    | Multi-tag  | Action, Adventure, RPG, Shooter, Strategy, etc. |
| Platform | Dropdown   | All, PC, Xbox, Cloud                            |
| Sort     | Dropdown   | A-Z, Z-A, Recently Added, Release Date          |
| Search   | Text input | Filter titles by search term (client-side)      |

- Filters applied client-side after data is fetched
- "Clear All Filters" button appears when filters are active
- Filter state persisted in component state (not localStorage)

### 5.8 Game Detail Modal/Sheet

When a game card is clicked:

```
┌─────────────────────────────────────────────────────────────┐
│  [×]                                              [Play ▸]  │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              [Large Hero/Banner Image]                   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Starfield                                                  │
│  Bethesda Game Studios · RPG, Action, Sci-Fi               │
│                                                             │
│  Starfield is the first new universe in over 25 years...    │
│  [Read more]                                                │
│                                                             │
│  Release Date: September 6, 2023                           │
│  Available on: PC, Xbox Series X|S, Cloud                  │
│                                                             │
│  Publishers: Xbox Game Studios                              │
│                                                             │
│  [Play on Xbox]    [View on Microsoft Store]                │
└─────────────────────────────────────────────────────────────┘
```

- Modal with semi-transparent dark backdrop
- Full description with "Read more" expandable text
- "Play on Xbox" primary button
- Close via X button, clicking backdrop, or Escape key

### 5.9 Caching & Performance

- GamePass catalog data cached in `localStorage` with **1-hour TTL**
- Image covers loaded lazily (`loading="lazy"`)
- Virtualized grid for large catalogs (use CSS grid + lazy rendering, or lightweight virtualization if performance demands)
- "Pull to refresh" or manual refresh button to force cache invalidation

### 5.10 Xbox App Integration

- **Deep link protocol**: `msxbox://game/?productId={productId}`
- **Fallback URL**: `https://www.xbox.com/en-us/games/store/{slug}`
- Before attempting deep link, check if protocol is registered (optional)
- Show a toast on failure: "Could not open Xbox app. Make sure it's installed."

---

## 6. Settings Integration

### 6.1 Settings → Integrations → IsThereAnyDeal

Add a new section in the existing Integrations settings page:

- **API Key field**: Password-masked text input
- **Validate button**: Calls ITAD API to verify key
- **Monitoring toggles**: Wishlist, Library
- **Notification settings**: Enable/disable, minimum discount threshold

### 6.2 UserPreferences Type Extension

```typescript
// In src/types/level.types.ts
interface ITADPreferences {
  apiKey?: string;
  monitorWishlist: boolean;
  monitorLibrary: boolean;
  enableNotifications: boolean;
  minimumDiscountPercent: number;
}

// Add to existing UserPreferences
interface UserPreferences {
  // ... existing fields
  itad?: ITADPreferences;
}
```

### 6.3 Main Process ITAD Service

New file: `src/main/services/itad-service.ts`

- Encapsulates all ITAD API calls
- Handles API key management
- Implements caching layer
- Handles rate limiting (ITAD has 1000 req/5min for verified emails)
- Exports functions used by IPC event handlers

---

## 7. Component Tree

```
src/renderer/src/pages/deals/
├── deals.tsx                      # Main page component (sub-tab router)
├── deals.scss                     # Page styles
├── deal-sources.ts                # DealSource registry array
├── deal-sub-tab-bar.tsx           # Horizontal sub-tab bar
├── deal-sub-tab-bar.scss
├── isthereanydeal/
│   ├── isthereanydeal-panel.tsx   # Main ITAD panel (tabs between monitor/search)
│   ├── isthereanydeal-panel.scss
│   ├── deal-monitor.tsx           # Library/wishlist deal monitor view
│   ├── deal-search.tsx            # Game search view
│   ├── deal-detail.tsx            # Expanded deal comparison view
│   ├── deal-card.tsx              # Single game deal card
│   └── store-logo.tsx             # Store logo component
├── gamepass/
│   ├── gamepass-browser.tsx       # Main GamePass catalog browser
│   ├── gamepass-browser.scss
│   ├── gamepass-card.tsx          # Game card component
│   ├── gamepass-card.scss
│   ├── gamepass-detail-modal.tsx  # Game detail modal
│   ├── gamepass-detail-modal.scss
│   ├── gamepass-filters.tsx       # Filter bar (region, genre, etc.)
│   ├── gamepass-filters.scss
│   └── gamepass-service.ts        # Data fetching & caching logic
└── index.ts                       # Re-exports
```

```
src/main/services/
└── itad-service.ts                # ITAD API client (main process)

src/main/events/
├── itad-events.ts                 # IPC event handlers for ITAD
└── index.ts                       # Updated registration
```

```
src/renderer/src/components/tab-bar/
└── tab-bar.tsx                    # Updated with Deals tab
```

```
src/renderer/src/
└── main.tsx                       # Updated with /deals route
```

```
src/renderer/src/pages/settings/
└── (existing integrations section) # Updated with ITAD settings
```

---

## 8. i18n Keys

New translation keys to add:

**Namespace: `"sidebar"`**

```json
{
  "deals": "Deals"
}
```

**Namespace: `"deals"`** (new namespace)

```json
{
  "isthereanydeal": "IsThereAnyDeal",
  "xbox_gamepass": "Xbox GamePass",
  "deals_for_your_games": "Deals for Your Games",
  "search_games": "Search for a game...",
  "no_deals_found": "No deals found for your library games",
  "no_search_results": "No games found. Try different search terms.",
  "best_deal": "Current Best",
  "historical_low": "Historical Low",
  "compare_all_prices": "Compare All Prices",
  "view_on_store": "View on Store",
  "open_itad_page": "Open ITAD Page",
  "store": "Store",
  "price": "Price",
  "discount": "Discount",
  "sort_best_deal": "Best Deal",
  "sort_biggest_discount": "Biggest Discount",
  "sort_title_asc": "Title (A-Z)",
  "refresh": "Refresh",
  "play_on_xbox": "Play on Xbox",
  "view_on_microsoft_store": "View on Microsoft Store",
  "region": "Region",
  "all_genres": "All Genres",
  "all_platforms": "All Platforms",
  "sort_a_z": "A-Z",
  "sort_z_a": "Z-A",
  "sort_recently_added": "Recently Added",
  "sort_release_date": "Release Date",
  "clear_filters": "Clear Filters",
  "no_games_found": "No games match your filters",
  "showing_games": "Showing {{count}} games",
  "api_key_required": "IsThereAnyDeal requires an API key",
  "api_key_description": "Get a free API key at isthereanydeal.com/apps/ and configure it in Settings → Integrations.",
  "open_settings": "Open Settings",
  "loading_deals": "Loading deals...",
  "loading_catalog": "Loading catalog...",
  "could_not_open_xbox": "Could not open Xbox app. Make sure it's installed.",
  "release_date": "Release Date",
  "available_on": "Available on",
  "publisher": "Publisher",
  "read_more": "Read more",
  "show_less": "Show less",
  "categories": "Categories",
  "platforms": "Platforms",
  "pc": "PC",
  "xbox": "Xbox",
  "cloud": "Cloud",
  "deal_notification_title": "Price drop on {{game}}!",
  "deal_notification_body": "Now {{price}} ({{discount}}% off) at {{store}}",
  "back_to_deals": "Back to Deals"
}
```

**Namespace: `"settings"`** (additions)

```json
{
  "itad_section_title": "IsThereAnyDeal",
  "itad_api_key_label": "API Key",
  "itad_api_key_placeholder": "Enter your ITAD API key",
  "itad_api_key_hint": "Get your API key at isthereanydeal.com/apps/",
  "itad_validate_key": "Validate Key",
  "itad_key_valid": "Connected",
  "itad_key_invalid": "Invalid API key",
  "itad_monitor_wishlist": "Monitor wishlist games",
  "itad_monitor_library": "Monitor library games",
  "itad_enable_notifications": "Enable deal notifications",
  "itad_minimum_discount": "Minimum discount to notify",
  "itad_test_notification": "Test notification"
}
```

---

## 9. Styling Requirements

### 9.1 Page Container

- Full width of the content area
- Background: `$dark-background-color` (#0d0d0d)
- Padding: `$spacing-unit * 2`

### 9.2 Sub-Tab Bar

- Matches the `website-links-tab-bar` style pattern
- Horizontal scroll with fade indicators on edges
- Active tab: accent color underline (`$brand-teal` #16b195)
- Tab padding: 8px 16px
- Tab gap: 4px
- Font: 13px, weight 500

### 9.3 Game Card Grid (GamePass)

- CSS Grid: `auto-fill, minmax(180px, 1fr)`
- Gap: `$spacing-unit * 1.5`
- Card background: `rgba(255, 255, 255, 0.03)`
- Card border: `1px solid $border-color`
- Card border-radius: 10px
- Hover: border-color highlight, background lighten, transform scale(1.02)
- Cover image: `object-fit: cover`, aspect-ratio: 3/4
- Title: 14px, 2-line clamp

### 9.4 Deal Cards (ITAD)

- Horizontal card layout (game cover left, deal info right)
- Cover: 80px wide, rounded
- Price: Large bold, green for deals
- Discount: Badge/chip with percentage
- Store logos: 24px × 24px, object-fit contain
- Card background: `rgba(255, 255, 255, 0.03)`
- Card border-radius: 8px

### 9.5 Filter Bar (GamePass)

- Flex row, wrapping on narrow screens
- Dropdowns styled matching existing `Select` components
- Region selector with flag emoji or country code
- Search input: pill-shaped, dark background, white placeholder text

### 9.6 Detail Modal (GamePass)

- Centered overlay with backdrop blur
- Max width: 640px
- Hero image: full width, 300px height, object-fit cover
- Content padding: `$spacing-unit * 2`
- Close button: top-right, circular, with × icon
- Responsive: full-screen on mobile views (future)

### 9.7 Empty/Loading States

- Centered in the content area
- Icon: 48px, muted color
- Message: 16px, $muted-color
- Skeleton cards for loading: pulsing placeholder matching card dimensions
- ITAD unconfigured: prominent call-to-action card with settings link

---

## 10. Edge Cases & Error Handling

| Scenario                                  | Behavior                                                        |
| ----------------------------------------- | --------------------------------------------------------------- |
| ITAD API key not configured               | Show setup prompt with link to Settings                         |
| ITAD API key invalid/expired              | Show error on validate, display warning banner in sub-tab       |
| ITAD API rate limit exceeded              | Show "Too many requests. Please wait." with retry timer         |
| ITAD API down / network error             | Show "Could not connect to IsThereAnyDeal" with retry button    |
| No library games with Steam App IDs       | Show "No compatible games in your library" message              |
| GamePass API returns empty                | Show "Could not load catalog. Please try again."                |
| GamePass API region unavailable           | Fall back to US catalog, show notice                            |
| Xbox app not installed (deep link fails)  | Show toast "Could not open Xbox app. Make sure it's installed." |
| No games after filtering GamePass         | Show "No games match your filters" with "Clear Filters" button  |
| Very large GamePass catalog (400+ games)  | Lazy-render cards, virtualize if needed, show count             |
| Rapid region switching on GamePass        | Debounce catalog fetch (500ms)                                  |
| Game has no cover image on GamePass       | Show placeholder gradient with game initial                     |
| localStorage full (cache)                 | Fall back to in-memory only, clear oldest cache entries         |
| Deals page opened while offline           | Show offline state for both sub-tabs                            |
| Multiple deal sources fail simultaneously | Show per-source error states, still render working sources      |

---

## 11. Dependencies

### New npm Packages

- None required. All functionality uses:
  - Existing `react-router-dom` for routing
  - Existing `react-i18next` for translations
  - Existing `@primer/octicons-react` for `TagIcon`
  - Browser-native `fetch` for API calls
  - Existing Electron IPC bridge
  - `localStorage` for caching (already available)

### Existing Packages Used

- `@primer/octicons-react` (`TagIcon`)
- `react-router-dom`
- `react-i18next`
- `classnames` (for conditional classes)
- `sass-embedded` (for SCSS)

---

## 12. Implementation Steps

1. **ITAD Main Process Service**: Create `src/main/services/itad-service.ts` with API client
2. **ITAD IPC Events**: Register IPC handlers in `src/main/events/itad-events.ts`
3. **Preload Bridge**: Expose ITAD IPC methods in `src/preload/index.ts` and types
4. **Settings Integration**: Add ITAD settings to existing Integrations settings page
5. **GamePass Service**: Create `gamepass-service.ts` for data fetching & caching
6. **Deal Source Registry**: Create `deal-sources.ts` with the extensible config
7. **Deals Page**: Create page structure under `src/renderer/src/pages/deals/`
8. **ITAD Panel**: Build the ITAD monitor + search components
9. **GamePass Browser**: Build the GamePass catalog browser + detail modal
10. **Sub-Tab Bar**: Build the horizontal scrollable sub-tab bar
11. **Tab Bar Update**: Add Deals tab to `tab-bar.tsx`
12. **Routing**: Add `/deals/*` route in `main.tsx`
13. **i18n**: Add translation keys to English locale file
14. **SCSS**: Create all stylesheets matching existing dark theme
15. **Typecheck + Lint**: Full typecheck with `yarn typecheck:web`
16. **Testing**: Manual verification of both sub-tabs

---

## 13. Out of Scope

- Big Picture mode for Deals page (future enhancement)
- ITAD wishlist import (importing Steam/GOG wishlists to Hydra — future)
- Direct purchase integration (buying games through Hydra)
- GamePass game import into Hydra library (user chose Xbox app launch only)
- Price alerts / push notifications (future — notification infrastructure needed)
- Mobile/responsive layout for Deals page
- Other deal sources beyond ITAD and GamePass (architecture supports them, but implementation deferred)
- GamePass EA Play distinction (treat EA Play games as part of the unified catalog)
- Historical price charts/graphs (ITAD supports this but scope is current deals only)

---

## 14. Open Questions for Future

- Should ITAD wishlist monitoring sync with Hydra wishlist automatically or manually?
- Should there be a "Deals" badge/notification indicator on the tab-bar icon?
- Should GamePass browser show which games the user already owns in their Hydra library?
- Should more regions be added to GamePass based on demand?
- Should there be a "Quick Actions" section that shows the hottest deals across both sources?
