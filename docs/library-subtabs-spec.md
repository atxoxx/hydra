# Library Sub-Tabs Spec

## Overview

Replace the PC platform dropdown in the Library page with store-specific sub-tabs (Local, Steam, Epic, GOG, etc.) and add equivalent sub-tabs for Classics console platforms. Games are categorized into sub-tabs based on their **acquisition source** (how they entered the library), not just their `shop` field. Add "Show All / Show Installed / Show Not Installed" filter options to the sort dropdown.

## Motivation

- Currently, the PC category has a single `<select>` dropdown to filter by store. This is hard to discover and doesn't convey which stores are connected.
- Users want games to stay in their proper categories: Hydra-catalogue downloads and locally-scanned games in "Local", Steam client-installed games in "Steam", Epic client-installed games in "Epic", etc.
- Sub-tabs make store filtering immediately visible and one-click accessible.

---

## Architecture

### Top-Level Tabs (unchanged)

The three top-level category tabs remain:

- **All** — flat view, no sub-tabs. Keeps the existing Classics platform dropdown for filtering launchbox games by console.
- **PC** — gains sub-tabs for stores (Local, Steam, Epic, GOG, etc.)
- **Classics** — gains sub-tabs for console platforms (dynamically generated)

### Sub-Tab Behavior

- Sub-tabs appear as a second row of pill buttons directly below the top-level category tabs.
- Sub-tabs use the **same pill-button style** as the existing All/PC/Classics tabs.
- Each sub-tab label includes a **game count** in parentheses (e.g., "Steam (12)", "Local (45)").
- The active sub-tab is **persisted in localStorage** per top-level category.

### Sub-Tab Visibility Rules

| Sub-Tab        | Visibility Condition                                                    |
| -------------- | ----------------------------------------------------------------------- |
| **Local**      | **Always visible** under PC                                             |
| **Steam**      | Shown only if **Steam login is active** (user authenticated with Steam) |
| **Epic**       | Shown only if scanner found at least one Epic game                      |
| **GOG**        | Shown only if scanner found at least one GOG game                       |
| **Battle.net** | Shown only if scanner found at least one Battle.net game                |
| **Amazon**     | Shown only if scanner found at least one Amazon game                    |
| **Ubisoft**    | Shown only if scanner found at least one Ubisoft game                   |
| **Xbox**       | Shown only if scanner found at least one Xbox game                      |
| **Rockstar**   | Shown only if scanner found at least one Rockstar game                  |
| **Itch.io**    | Shown only if scanner found at least one Itch.io game                   |
| **Humble**     | Shown only if scanner found at least one Humble game                    |

### Sub-Tab Order

1. **Local** (always first)
2. All other connected stores in **alphabetical order**

---

## Game Categorization: `acquisitionSource` Field

### New Field

Add `acquisitionSource: string` to the game data model. This tracks HOW a game was added to the library, independent of its `shop` field.

### Values

| Value             | Meaning                                    | Maps to Sub-Tab        |
| ----------------- | ------------------------------------------ | ---------------------- |
| `hydra_catalogue` | Downloaded via Hydra catalogue             | Local                  |
| `manual`          | Added via "Add Custom Game" button         | Local                  |
| `folder_scan`     | Discovered by local folder scanning        | Local                  |
| `steam_scan`      | Discovered by Steam install-folder scanner | Steam                  |
| `epic_scan`       | Discovered by Epic platform scanner        | Epic                   |
| `gog_scan`        | Discovered by GOG platform scanner         | GOG                    |
| `battle_net_scan` | Discovered by Battle.net scanner           | Battle.net             |
| `amazon_scan`     | Discovered by Amazon scanner               | Amazon                 |
| `ubisoft_scan`    | Discovered by Ubisoft scanner              | Ubisoft                |
| `xbox_scan`       | Discovered by Xbox scanner                 | Xbox                   |
| `rockstar_scan`   | Discovered by Rockstar scanner             | Rockstar               |
| `itch_io_scan`    | Discovered by Itch.io scanner              | Itch.io                |
| `humble_scan`     | Discovered by Humble scanner               | Humble                 |
| `launchbox`       | Imported via LaunchBox / classics          | Classics (by platform) |

### Mapping to Sub-Tabs

```
acquisitionSource → sub-tab:
  hydra_catalogue    → Local
  manual             → Local
  folder_scan        → Local
  steam_scan         → Steam
  epic_scan          → Epic
  gog_scan           → GOG
  battle_net_scan    → Battle.net
  amazon_scan        → Amazon
  ubisoft_scan       → Ubisoft
  xbox_scan          → Xbox
  rockstar_scan      → Rockstar
  itch_io_scan       → Itch.io
  humble_scan        → Humble
  launchbox          → Classics (sub-tab by game.platform)
```

### Migration Strategy (for existing games)

For games already in the library that lack `acquisitionSource`:

1. If `shop === "launchbox"` → `acquisitionSource = "launchbox"`
2. If `shop === "custom"` → `acquisitionSource = "manual"`
3. If the game has a `download` record (downloaded via Hydra) → `acquisitionSource = "hydra_catalogue"`
4. If the game has an `executablePath` inside a known Steam library path → `acquisitionSource = "steam_scan"`
5. All other cases → `acquisitionSource = "manual"`

This migration runs once when the library page first loads with the new code.

### Setting acquisitionSource on New Games

- **Hydra catalogue download**: Set `acquisitionSource = "hydra_catalogue"` when the download is initiated.
- **Custom game added**: Set `acquisitionSource = "manual"`.
- **Folder scan**: Set `acquisitionSource = "folder_scan"`.
- **Platform scanner** (Steam, Epic, GOG, etc.): Set the appropriate `*_scan` value.
- **LaunchBox import**: Set `acquisitionSource = "launchbox"`.

---

## Filtering Logic

### PC Tab Filtering

When the PC tab is active and a sub-tab is selected:

```
filtered = games where:
  shop !== "launchbox"  (exclude classics)
  AND acquisitionSource maps to the selected sub-tab
```

The old `selectedPcPlatform` state and the `<select>` dropdown are **removed** from `CategoryFilter`.

### Classics Tab Filtering

When the Classics tab is active and a sub-tab is selected:

```
filtered = games where:
  shop === "launchbox"
  AND game.platform === selectedClassicsSubTab
```

The existing `PlatformFilter` component for Classics is **removed** from the main library page layout. The platform dropdown on the All tab **remains** (only for launchbox games).

### All Tab Filtering

No sub-tabs. Existing filtering logic remains. The existing platform dropdown for launchbox games stays.

---

## Sort Options Update

### New Options Added

Add three filter options at the **top** of the sort dropdown, visually separated from sort-order options:

| Option                 | Behavior                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------- |
| **Show All**           | No filtering (default). Show all games.                                               |
| **Show Installed**     | Only show games where `executablePath` is set OR `installedSizeInBytes != null`.      |
| **Show Not Installed** | Only show games where `executablePath` is NOT set AND `installedSizeInBytes == null`. |

### Sorting Behavior

When "Show Installed" or "Show Not Installed" is selected, the remaining sort-order option (title_asc, recently_played, most_played, installed_first, title_desc) still applies to the filtered subset.

### Implementation

- Add as additional filter state, persisted in localStorage.
- The filter is applied **after** sub-tab filtering and **before** sorting.

---

## UI Layout Changes

### Before (Current)

```
[  All  ] [  PC  ] [  Classics  ]          [Sort ▽] [Platform ▽] [View ○○○]
[                    Collections                    ]
```

### After

```
[  All  ] [  PC  ] [  Classics  ]          [Sort ▽] [Platform ▽]* [View ○○○]
[  Local(45)  ] [ Steam(12) ] [ Epic(8) ] [ GOG(3) ]            ← sub-tabs (PC)
[                    Collections                    ]
```

\*Platform dropdown only shown on All and Classics tabs (for Classics tab, removed due to sub-tabs).

### Classics Tab After

```
[  All  ] [  PC  ] [  Classics  ]            [Sort ▽] [View ○○○]
[ PlayStation(20) ] [ Nintendo(15) ] [ Xbox 360(8) ] [ Sega(4) ]   ← sub-tabs
```

---

## State Management

### New State

| State              | Type                                      | Default      | Persisted                                      |
| ------------------ | ----------------------------------------- | ------------ | ---------------------------------------------- |
| `pcSubTab`         | `string \| null`                          | `"local"`    | Yes (localStorage `library-pc-subtab`)         |
| `classicsSubTab`   | `string \| null`                          | `null` (all) | Yes (localStorage `library-classics-subtab`)   |
| `visibilityFilter` | `"all" \| "installed" \| "not_installed"` | `"all"`      | Yes (localStorage `library-visibility-filter`) |

### Existing State Changes

| State                | Change                                                     |
| -------------------- | ---------------------------------------------------------- |
| `category`           | Unchanged                                                  |
| `selectedPlatform`   | Kept for All tab only. Not used under PC or Classics tabs. |
| `selectedPcPlatform` | **Removed** — replaced by `pcSubTab`                       |
| `sortBy`             | Unchanged                                                  |

---

## Sidebar Filter Independence

The sidebar filter menu (which has its own store multi-select filter and library_set filter) operates **fully independently** from the library page sub-tabs. Changing a sub-tab on the library page does NOT affect the sidebar filter, and vice versa.

---

## Files to Modify

### New Files

- _(potentially)_ A new `SourceSubTabs` component if extracted from CategoryFilter

### Modified Files

| File                                                  | Changes                                                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/renderer/src/pages/library/library.tsx`          | Add sub-tab state, filtering logic, remove old PC dropdown state, wire new filter options                    |
| `src/renderer/src/pages/library/category-filter.tsx`  | Add sub-tab rendering beneath PC/Classics, remove the `<select>` dropdown, add visibility filter integration |
| `src/renderer/src/pages/library/category-filter.scss` | Styles for sub-tab row                                                                                       |
| `src/renderer/src/pages/library/filter-options.tsx`   | Add "Show All / Show Installed / Show Not Installed" as first group in sort dropdown                         |
| `src/types/game.types.ts`                             | _(potentially)_ Add `acquisitionSource` to relevant types                                                    |
| `src/types/level.types.ts`                            | Add `acquisitionSource` field to Game type                                                                   |
| `src/main/` (various)                                 | Set `acquisitionSource` when games are added (catalogue download, custom add, folder scan, platform scan)    |

### Files NOT Modified

- Big Picture mode library (out of scope)
- Sidebar components (independent)
- Sidebar filter menu (independent)

---

## Edge Cases

1. **Steam login active but no Steam games**: Steam sub-tab is hidden (no games found).
2. **Store was connected, then disconnected**: Games from that store remain in the library with their original `acquisitionSource`, but the sub-tab hides since the store is no longer "connected" (no games found or store disconnected). The games are still accessible under the All tab.
3. **Game has shop="steam" but was downloaded via Hydra**: Goes to Local (based on `acquisitionSource = "hydra_catalogue"`), NOT Steam.
4. **Game was scanned by both folder scan AND platform scanner**: First-set `acquisitionSource` wins. Platform scanners should check if a game already has `acquisitionSource` before overwriting.
5. **No sub-tabs visible under PC except Local**: If only Local is visible, still show the sub-tab row with just the Local tab.
6. **Empty sub-tab**: A sub-tab with count 0 should still be shown (e.g., Steam connected but all Steam games were removed — show "Steam (0)" to indicate the store is active but empty).
7. **Rapidly switching between All/PC/Classics**: Sub-tab state is preserved per top-level category.
8. **Search query + sub-tab**: Search applies on top of sub-tab filtering (filter by sub-tab first, then search within results).

---

## Implementation Order

1. Add `acquisitionSource` to the Game type and LevelDB schema
2. Add migration logic to populate `acquisitionSource` for existing games
3. Set `acquisitionSource` in game-creation code paths (catalogue download, custom add, scans)
4. Implement sub-tab UI in `CategoryFilter` (remove PC dropdown, add sub-tab row)
5. Implement Classics sub-tabs (remove platform dropdown on Classics view)
6. Add visibility filter options to `FilterOptions` sort dropdown
7. Wire filtering logic in `library.tsx`
8. Update styles in SCSS files
9. Test with various library states (empty, all stores, mixed sources)
