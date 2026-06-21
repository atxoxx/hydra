# Import Layout Redesign Spec

## Overview

Redesign the platform import settings page (`settings-context-platform-import.tsx`) to have an improved, consistent visual layout across all store/platform cards. Unify Steam's login panel with the store row pattern used by other stores. Show "Login" instead of "Sync" when a store is not yet logged in, and "Scan for games" for auto-detect stores.

## Current State

### File: `src/renderer/src/pages/settings/settings-context-platform-import.tsx`

- Renders a list of platform cards (Steam, Epic, GOG, Battle.net, Amazon, Ubisoft, EA, Xbox, Rockstar, itch.io, Humble)
- Each card has a platform name, optional store integration row, and platform options (scan installed checkbox, API key input for Steam)
- Store types are split into:
  - **Browser OAuth** (`BROWSER_OAUTH_STORES`): Epic, GOG, Xbox — get a "Login" button when not authenticated
  - **Auto-detect** (`AUTODETECT_STORES`): Amazon, Humble, Ubisoft, EA, Battle.net — get a "Sync" button even when not authenticated
- When `status === null` (no status data), auto-detect stores still show "Sync"
- Steam has its own separate login panel with username, sync button, logout, API key fallback toggle, and family sharing inputs
- The store row layout differs between OAuth and auto-detect stores
- No store icons are displayed

### File: `src/renderer/src/pages/settings/settings-platform-import.scss`

- Card-based layout with platform rows
- Store row is an inline row with: status dot, status text, game count, last sync, action buttons
- Buttons have three variants: login (accent color), sync (subtle), logout (transparent)

## Requirements

### 1. Unified Card Design

All platform/store cards should follow the same visual pattern:

**Layout per platform card:**

```
┌──────────────────────────────────────────────────────┐
│  [Icon] Platform Name                                │
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │ ● Connected  ·  15 games  ·  Last synced 2h ago  ││
│  │                              [Sync]  [Logout]    ││
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  ☐ Scan installed games                              │
│                                                      │
│  [▼ Steam additional settings (collapsible)]         │
│  ┌─ API Key: [_______________]                       │
│  │  Family Share IDs: [_______________]              │
│  └───────────────────────────────────────────────────│
└──────────────────────────────────────────────────────┘
```

**Key design principles:**

- Consistent card shape, padding, spacing for all platforms
- Prominent header with store icon + platform name
- Unified inner store row (same info fields, same button layout)
- Scan installed checkbox inside each card
- Collapsible extras section for Steam-specific fields

### 2. Store Icons

- Add small (24×24px) SVG platform icons next to each platform name
- Source icons from **svgrepo.com** (https://www.svgrepo.com/)
- Create/import SVG icons as React components for:
  - Steam — already exists at `src/renderer/src/assets/steam-logo.svg`
  - Epic Games — store-icons/epic.svg
  - GOG — store-icons/gog.svg
  - Battle.net — store-icons/battlenet.svg
  - Amazon Games — store-icons/amazon.svg
  - Ubisoft Connect — store-icons/ubisoft.svg
  - EA App — store-icons/ea.svg
  - Xbox — already exists at `src/renderer/src/assets/Xbox Logo.svg`
  - Rockstar Games Launcher — store-icons/rockstar.svg
  - itch.io — store-icons/itchio.svg
  - Humble Bundle — store-icons/humble.svg
- Store icons in `src/renderer/src/assets/store-icons/`
- Import with `?react` suffix: `import EpicIcon from "@renderer/assets/store-icons/epic.svg?react"`
- Icons should use `currentColor` for fill to respect the theme

### 3. Login/Sync/Scan Button Logic

**Button labels by store state:**

| Store Type                                            | Not authenticated  | Authenticated     | Session expired | Action in progress             |
| ----------------------------------------------------- | ------------------ | ----------------- | --------------- | ------------------------------ |
| OAuth (Epic, GOG, Xbox)                               | **Login**          | **Sync** + Logout | **Re-login**    | "Logging in..." / "Syncing..." |
| Auto-detect (Amazon, Humble, Ubisoft, EA, Battle.net) | **Scan for games** | **Sync** + Logout | N/A (no auth)   | "Scanning..." / "Syncing..."   |
| Steam                                                 | **Login**          | **Sync** + Logout | **Re-login**    | "Logging in..." / "Syncing..." |

**Rules:**

- Steam now follows the same unified row pattern as other OAuth stores
- Auto-detect stores show "Scan for games" instead of "Login" when never detected
- When authenticated, all stores show "Sync" + "Logout"
- When expired, OAuth stores (including Steam) show "Re-login"
- Disabled state while an action is in progress with appropriate label

### 4. Steam Unification

Steam should use the same unified store row layout instead of its custom login panel.

**What changes:**

- Remove the separate `__steam-login` panel block
- Steam gets the same unified store row as other OAuth stores
- Steam's login/sync/logout buttons use the same pattern

**What stays (in collapsible section):**

- API key fallback input (visible when logged out)
- Family sharing IDs input (visible when logged in)
- These are in a toggle-able collapsible section below the unified row
- Default: collapsed. User clicks "▸ Steam additional settings" to expand

### 5. Status Information Display

Every unified store row should consistently show:

- **Status dot** with color:
  - Green (#22c55e) = Connected/Authenticated
  - Gray (#4a4a5a) = Disconnected
  - Amber (#f59e0b) = Expired
- **Status text**: "Connected", "Disconnected", or "Expired"
- **Game count**: When > 0, show "15 games" badge
- **Last sync time**: When available, show relative time ("2h ago")
- **Action buttons**: Login/Sync/Logout as appropriate

**When no status is available (first load / no data):**

- Show gray dot + "Not connected" with the appropriate primary action button

### 6. Visual Polish

- Hover states on all interactive elements
- Smooth transitions on status dot color changes
- Button hover/focus ring effects
- Consistent typography (font sizes, weights, colors)
- Accent color usage on primary action buttons (respecting the user's accent theme)
- Subtle card border and background that works in both light and dark themes
- Proper text truncation for long platform names or status text

### 7. Edge Cases to Handle

- **Loading state**: When store statuses are loading, show skeleton/spinner in the store row
- **Error state**: If sync fails, show error indicator
- **Disconnected during action**: Handle mid-action state changes gracefully
- **Multiple actions**: Prevent clicking multiple buttons simultaneously (already handled with `storeActions` state)
- **No games found**: Show "0 games" or no game count at all
- **Network issues**: Graceful error handling with toast notifications (existing behavior)

## Implementation Plan

### Files to Modify

1. **`src/renderer/src/pages/settings/settings-context-platform-import.tsx`**
   - Refactor `renderStoreSection()` to output unified store rows for all stores
   - Remove separate Steam login panel, integrate into unified row
   - Add collapsible section for Steam extras
   - Update button labels per the logic table above
   - Add store icons to platform headers

2. **`src/renderer/src/pages/settings/settings-platform-import.scss`**
   - Redesign card layout for consistency
   - Add styles for store icons
   - Add collapsible section styles
   - Polish hover states, transitions, and spacing
   - Add loading skeleton styles

3. **`src/renderer/src/assets/store-icons/`** (new directory)
   - Create SVG icon components for each store platform
   - Export them via an index barrel file

### Files NOT to Modify (unless needed for ref cleanup)

- `src/renderer/src/hooks/use-steam-login.ts` — keep existing hook, it still works
- `src/types/store.types.ts` — types are fine as-is
- `src/locales/` — may need new translation keys; add if needed

## Design Tokens Reference

From the existing SCSS:

- Card background: `var(--surface-secondary, #1e1e1e)`
- Store row background: `var(--surface-tertiary, #161616)`
- Border: `var(--border-subtle, #2a2a2a)`
- Primary text: `var(--text-primary, #e1e1e1)`
- Muted text: `var(--text-muted, #8b8b8b)`
- Accent: `var(--accent, #4a9eff)`
- Status green: `#22c55e`
- Status amber: `#f59e0b`
- Status gray: `#4a4a5a`
