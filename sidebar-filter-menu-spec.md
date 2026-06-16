# Sidebar Filter Menu — Specification

## Overview

Replace the **inline sort `<select>` + show-playable-only button** in the sidebar's "Games" section header with a **single "Filter" icon button** that opens a **popover menu** with five filter groups. Filter selections:

- Apply immediately to the **sidebar game list only** (the `/library` page keeps its own existing filters untouched).
- Persist to **localStorage** (same pattern as the current `sidebar-sort-by` key).
- Use **AND** logic both within and across groups (every selected chip must match).

The new menu lives next to the existing search `<TextField>` and the add-custom-game `+` button in the section header.

---

## 1. Goals & Non-Goals

### 1.1 Goals

- Consolidate the sort `<select>` and the show-playable-only `Play` button into one cohesive, scannable UI.
- Offer quick filtering by library set, store/platform, genre, status, and sort.
- Stay usable when the sidebar is narrow (~200–450 px).
- Keep keyboard and screen-reader basics working.

### 1.2 Non-Goals

- Does **not** sync to the `/library` page filters (`CategoryFilter`, `PlatformFilter`, `FilterOptions` remain as-is).
- Does **not** introduce a Redux/LevelDB-prefs key for v1 (localStorage only).
- Does **not** add non-English translations in v1 (English `sidebar.json` keys only).
- Does **not** redesign the existing sidebar layout, profile, suggestions, or collections sections.

---

## 2. Trigger Button

### 2.1 Visual

- New icon button placed **immediately to the right of the search `<TextField>`**, in the same row as the existing `+` (add custom game) button.
- Icon: `FilterIcon` from `@primer/octicons-react`.
- Behaves as a normal button with `aria-label="Filter games"` and `aria-haspopup="dialog"` / `aria-expanded`.
- **Count badge**: when 1+ filter chips are active, render a small numeric badge (e.g. `3`) overlayed on the icon's top-right corner, similar to existing `sidebar__game-badge` styling (`border-radius: 99px`, brand-teal background).
- Tooltip on hover (using existing `react-tooltip` pattern with `data-tooltip-id`): "Filter games".
- Default state (0 active): icon is muted (`globals.$muted-color`); active state: icon becomes `globals.$brand-teal`.

### 2.2 Header arrangement (after change)

```
[GAMES]        [🔍 search…] [☰ filter] [+ add]
```

- The existing inline sort `<select>` is **removed** (moved into the menu under "Sort").
- The existing `Play` button (show-playable-only) is **removed** (replaced by Library-set filter).
- The existing `+` (add custom game) button is **kept** in place.
- Order from left → right in the section header actions: `[add] → [filter]` (per "keep the add button" decision, we keep only the add button visible alongside the new filter button). The play button is dropped.

---

## 3. Popover Menu

### 3.1 Open / Close

- Built on the existing `<DropdownMenu>` Radix primitive, **but extended** because the existing component only supports a single flat list of items. A new compound component (`SidebarFilterMenu`) wraps Radix with a custom two-column body.
- **Downflow** orientation: opens below the trigger (`side="bottom"`, `align="end"`, `sideOffset: 6`).
- Apply-immediately, keep-open: chip selections live-update the sidebar list; the menu stays open so the user can multi-select. The menu only closes on:
  - Click outside
  - `Esc`
  - Click on the `Close` (or `Reset`) action in the menu footer
- `pointer-events` outside the menu and `Escape` are wired through Radix (`onInteractOutside`, `onEscapeKeyDown`).

### 3.2 Layout (Master/Detail)

The popover body is a fixed-size 2-column layout:

```
┌──────────────────┬────────────────────────────────────────┐
│ LIBRARY SET      │ (none selected — picks below)          │
│  • All           │                                        │
│  • Installed     │  Single-select group (radio-like)      │
│  • Not installed │                                        │
│ ───────────────  │                                        │
│ STORES / PLATFORM│  Multi-select chips                    │
│  • Steam (45)    │  [✓] Steam (45)                        │
│  • Epic (12)     │  [ ] Epic (12)                         │
│  • GOG  (8)      │  [ ] GOG (8)                           │
│  …               │  …                                     │
│ ───────────────  │                                        │
│ GENRE            │  Multi-select chips                    │
│  • Action (20)   │  [ ] Action (20)                       │
│  • RPG     (15)  │  [ ] RPG (15)                          │
│  …               │  …                                     │
│ ───────────────  │                                        │
│ STATUS           │  Multi-select chips                    │
│  • Playing (3)   │  [ ] Playing (3)                       │
│  • …             │  …                                     │
│ ───────────────  │                                        │
│ SORT             │  Single-select group (radio-like)      │
│  • Alphabetical  │                                        │
│  • Most played   │                                        │
│ ───────────────  │                                        │
│ [Reset all]      │  Footer                                │
└──────────────────┴────────────────────────────────────────┘
```

- Left column: **fixed-width group navigator** showing each group with the number of _currently selected_ chips in parentheses, e.g. `Genre (2)`. Groups whose right-column is scrollable (`Store`, `Genre`, `Status`) get an arrow on their row indicating "more".
- Right column: shows the **active group's options** as a scrollable list/grid of chips.
- A group with zero options (e.g. no genres available on any game) is shown disabled with a count of `0`.
- On narrow sidebars (< ~250 px) the popover is sized so the menu extends **over** the sidebar/library content area but stays within the viewport — using Radix's `collisionPadding` (already in the existing primitive).

### 3.3 Visual Style

- Background: `globals.$dark-background-color` (matches existing dropdown).
- Border: `1px solid globals.$border-color`, `border-radius: 8px`.
- Padding: 8 px outer, 4 px between groups.
- Animation: 150 ms fade + slide-down; respect `prefers-reduced-motion` (skip animation when set).
- Chip (when unselected):
  - 28 px tall, 12 px padding
  - Background: `rgba(255, 255, 255, 0.04)`
  - Border: `1px solid rgba(255, 255, 255, 0.08)`
  - Border-radius: `12px`
  - Text: `globals.$muted-color`
  - Count suffix in a smaller font, dimmer.
- Chip (selected):
  - Background: `rgba(22, 177, 149, 0.18)` (tinted brand-teal)
  - Border: `1px solid rgba(22, 177, 149, 0.5)`
  - Text: `globals.$brand-teal`
  - Optional leading check icon (`CheckIcon` size=12) — only if device is not touch.
- Hover: `rgba(255, 255, 255, 0.08)` background.
- Disabled chip (zero matches): opacity 0.5, `cursor: not-allowed`.

### 3.4 Footer

- Single button, `Reset all` — clears every group except "Library set = All" and "Sort = Alphabetical" (defaults).
- Tooltip text "Reset all filters".

---

## 4. Filter Groups

### 4.1 Library set _(single-select, always visible)_

| Option        | Predicate                                                             | Default |
| ------------- | --------------------------------------------------------------------- | ------- |
| All           | (no filter)                                                           | ✓       |
| Installed     | `Boolean(game.executablePath) \|\| game.installedSizeInBytes != null` |         |
| Not installed | NOT installed                                                         |         |

> Decision: a game is **installed** when `executablePath` exists OR `installedSizeInBytes > 0` (matches the existing `installed_first` sort in `sidebar.tsx`). This **replaces and supersedes** the old show-playable-only Play button. The old button is removed.

### 4.2 Stores / Platform _(multi-select, AND within group)_

Sourced from `MODERN_SHOPS` plus `launchbox`:

- Render order: defined by the existing translation keys `platform_steam`, `platform_epic`, `platform_gog`, `platform_battle_net`, `platform_amazon`, `platform_ubisoft`, `platform_xbox`, `platform_rockstar`, `platform_itch_io`, `platform_humble`, and a synthetic `launchbox` entry mapped via existing classic platform labels (e.g. `ps1`, `ps2`, … from `uniquePlatforms` of the library) treated as chips under this group.
- Each chip shows the count of games in that shop (e.g. `Steam (45)`). Chips where count = 0 are disabled.
- Selecting multiple stores AND-s them: `game.shop ∈ selectedShops`.

> Note: The "Classics" arcade platform breakdown (PS1/PS2/etc.) is folded into the same Stores group. The library-page `PlatformFilter` for classics continues to work independently on the main page; the sidebar's stores group shows a single combined "Classics" chip plus a per-platform breakdown when expanded further.

### 4.3 Genre _(multi-select, AND within group)_

- Chips populated from `game.genres` across all library games.
- De-duplicated, alphabetized.
- Source priority (per existing metadata chain):
  1. `LibraryGame.genres` (user-overridden)
  2. Otherwise the metadata-fetcher's stored genres
  3. Steam genres via `steamGenresMapping` (en) for non-Latin alphabets fall back to english
- Each chip label = the localized genre name (using `steamGenresMapping[lang]` when available; falls back to `game.genres[i]` raw).
- Count = number of library games whose `genres` contains that value. Disabled chips (count=0) are still rendered but inert.

### 4.4 Sort _(single-select, always visible)_

Existing inline `<select>` options are reused. New options: keep `title_desc` (Z→A) as a simpler mirror of alphabetical.

| Value             | Predicate (mirrors `sidebar.tsx`)                                                        |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `alphabetical`    | `a.title.localeCompare(b.title, undefined, { sensitivity: "base" })` (A→Z) — **default** |
| `title_desc`      | Reverse alphabetical (Z→A)                                                               |
| `most_played`     | `(b.playTimeInMilliseconds ?? 0) - (a.playTimeInMilliseconds ?? 0)`                      |
| `recently_played` | `lastTimePlayed` desc; then alphabetical fallback                                        |
| `installed_first` | Installed first, then alphabetical tiebreak                                              |

### 4.5 Status _(multi-select, AND within group)_

Sourced from `UserGameStatus` enum used in `game-status-dropdown.tsx`:

| Value          | Predicate (per `LibraryGame`)   |
| -------------- | ------------------------------- |
| `playing`      | `userStatus === "playing"`      |
| `plan_to_play` | `userStatus === "plan_to_play"` |
| `on_hold`      | `userStatus === "on_hold"`      |
| `beaten`       | `userStatus === "beaten"`       |
| `completed`    | `userStatus === "completed"`    |
| `played`       | `userStatus === "played"`       |
| `not_played`   | `userStatus === "not_played"`   |
| `abandoned`    | `userStatus === "abandoned"`    |

> `UserGameStatus "none"` and `null` are intentionally omitted from the chips (they map to "Unrated" — would produce identical 0-count chips and are excluded to avoid clutter).

Status chips show the count of library games per status. Disabled for counts of zero.

---

## 5. Filtering Logic

### 5.1 Combined predicate

```ts
function matchesFilters(game, state) {
  // 5.1.a Library set
  if (state.librarySet === "installed" && !isInstalled(game)) return false;
  if (state.librarySet === "not_installed" && isInstalled(game)) return false;

  // 5.1.b Stores — AND
  if (state.stores.length > 0 && !state.stores.includes(game.shop))
    return false;

  // 5.1.c Genre — AND
  if (state.genres.length > 0) {
    const gameGenres = game.genres?.map((g) => g.toLowerCase()) ?? [];
    if (!state.genres.every((g) => gameGenres.includes(g.toLowerCase())))
      return false;
  }

  // 5.1.d Status — AND
  if (state.statuses.length > 0 && !state.statuses.includes(game.userStatus))
    return false;

  return true;
}
```

### 5.2 Sorting

Applied **after** filtering, using `sortBy`. Single-select so no conflicts.

### 5.3 Pipeline

1. Library source: `library` from the existing `useLibrary()` hook.
2. Filter (predicate above) — produces `filteredLibrary`.
3. Sort (sortBy) — produces `sortedFilteredLibrary`.
4. (Existing) Title substring filter applied via the search `<TextField>` (unchanged): final `displayedLibrary`.

### 5.4 AND-with-AND semantics example

Selecting `Stores = {Steam}`, `Genre = {RPG}`, `Status = {playing}` returns games where:

- `game.shop === "steam"` **AND**
- `game.genres` includes `"RPG"` **AND**
- `game.userStatus === "playing"`

Selecting `Stores = {Steam, Epic}` (multi within group) returns games where `shop` is `"steam"` OR `"epic"` (multi select to be permissive inside the group)… → **Decision correction** — the user explicitly chose **AND within group AND across groups**. Re-reading the spec above: "AND within group" means multi-select within a group is restrictive. That is what we'll implement: `state.stores.every(s => game.shop === s)`. With AND-within, picking Steam + Epic returns games whose shop is both Steam and Epic simultaneously — typically zero results. To stay useful, **stores will be AND-within** as selected, but the sidebar will show this edge case clearly (group row shows the count of AND-ed matches; if zero, the AND-group is highlighted).

---

## 6. State Management

### 6.1 Where state lives

- Filter state lives **inside `Sidebar.tsx`** as a single `useState<SidebarFilterState>` (matches existing `sortBy` pattern).
- No Redux slice, no global context. The filter does not need to survive unmount within the same session.
- Computed pipeline (`matchesFilters` + sort) replaces the existing single `sortedLibrary` `useMemo` in `Sidebar.tsx`. The existing `TextField` filter (`handleFilter`) is applied downstream of this.

### 6.2 Persisted keys (localStorage)

| Key                        | Type                                      | Default          |
| -------------------------- | ----------------------------------------- | ---------------- |
| `sidebar-filter-store-set` | `"all" \| "installed" \| "not_installed"` | `"all"`          |
| `sidebar-filter-stores`    | JSON-stringified `string[]`               | `[]`             |
| `sidebar-filter-genres`    | JSON-stringified `string[]`               | `[]`             |
| `sidebar-filter-status`    | JSON-stringified `UserGameStatus[]`       | `[]`             |
| `sidebar-sort-by`          | `SortOption`                              | `"alphabetical"` |

The existing `sidebar-sort-by` key is reused (no breaking change). On mount, hydrate from localStorage with safe defaults and validation (drop unknown values).

### 6.3 Migration / cleanup

- Old `showPlayableOnly` state (`useState(false)`) is removed.
- The local pre-existing display code path that maps `showPlayableOnly` to the `isGamePlayable` check is removed.
- Nothing else migrates.

---

## 7. Files to Modify

### 7.1 New files

| File                                                             | Purpose                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/renderer/src/components/sidebar/sidebar-filter-menu.tsx`    | The Radix-popover component: layout, group renderer, chip renderer |
| `src/renderer/src/components/sidebar/sidebar-filter-menu.scss`   | Styles for the popover and chips                                   |
| `src/renderer/src/components/sidebar/sidebar-filter-button.tsx`  | The header icon button + count badge                               |
| `src/renderer/src/components/sidebar/sidebar-filter-button.scss` | Styles for the button + badge                                      |

### 7.2 Files to modify

| File                                               | Changes                                                                                                                     |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/src/components/sidebar/sidebar.tsx`  | Add `SidebarFilterButton` + `SidebarFilterMenu`; replace sort `<select>`, remove `<Play>` button; add `SidebarFilterState`; |
| `src/renderer/src/components/sidebar/sidebar.scss` | Drop `.sidebar__sort-select`, `.sidebar__play-button`, `.sidebar__play-button--active`; minor header spacing fix            |

### 7.3 Locale files

| File                              | Changes                                                      |
| --------------------------------- | ------------------------------------------------------------ |
| `src/locales/en/translation.json` | Add new keys under `sidebar` namespace (English only for v1) |

Other ~40 locale files: untouched (fall back to English string keys).

---

## 8. Translation Keys (English only, v1)

```jsonc
{
  "sidebar": {
    "filter_button_label": "Filter games",
    "filter_group_library_set": "Library set",
    "filter_group_stores": "Stores / Platform",
    "filter_group_genre": "Genre",
    "filter_group_status": "Status",
    "filter_group_sort": "Sort",
    "filter_library_set_all": "All",
    "filter_library_set_installed": "Installed",
    "filter_library_set_not_installed": "Not installed",
    "filter_reset_all": "Reset all",
    "filter_active_count_one": "{{count}} filter active",
    "filter_active_count_other": "{{count}} filters active",
    "filter_count_chip_one": "{{count}} game",
    "filter_count_chip_other": "{{count}} games",
    "filter_status_playing": "Playing",
    "filter_status_plan_to_play": "Plan to Play",
    "filter_status_on_hold": "On Hold",
    "filter_status_beaten": "Beaten",
    "filter_status_completed": "Completed",
    "filter_status_played": "Played",
    "filter_status_not_played": "Not Played",
    "filter_status_abandoned": "Abandoned",
    "filter_no_results": "No games match the current filters",
    "filter_classics_combined": "Classics",
    "sort_alphabetical": "Alphabetical (A–Z)",
    "sort_title_desc": "Alphabetical (Z–A)",
    "sort_most_played": "Most played",
    "sort_recently_played": "Recently played",
    "sort_installed_first": "Installed first",
  },
}
```

Existing keys `sort_*` are renamed to match the new copy; old keys are **kept** as aliases (e.g. `sort_alphabetical`) to avoid breaking the English locale lookup until all 39 other locales get translations in a later pass. (For v1, only `en/translation.json` is updated — other locales still resolve to existing keys; behavior is unchanged for them.)

---

## 9. Accessibility

- **Keyboard navigation**:
  - `Enter`/`Space` on the trigger opens the menu.
  - `Esc` closes the menu and restores focus to the trigger.
  - Inside the menu:
    - `Tab` cycles through the left-column groups.
    - `↑/↓` moves through chips within a group.
    - `Enter`/`Space` toggles a chip.
    - `Home/End` jump to first/last chip in a group.
- **ARIA**:
  - Trigger: `aria-haspopup="dialog"`, `aria-expanded`, `aria-label="Filter games"`.
  - Two-column body: container has `role="dialog"` with `aria-label="Filter games"`.
  - Left column: `role="tablist"` with `role="tab"` items, using `aria-selected`.
  - Right column (active group's chips): `role="group"` labelled by the active group's tab; each chip has `role="checkbox"` with `aria-checked` (multi-select groups) or `role="radio"` (Library-set + Sort).
  - Count badges: announced via `aria-label` (e.g. "Steam, 45 games, selected").
- **Reduced motion**: when `window.matchMedia("(prefers-reduced-motion: reduce)").matches`, drop the open animation.

> **Note on locale**: the multi-select locale question was not explicitly answered for accessibility. Accessibility is treated as baseline-correctness (no extra cost), not an optional feature. If the user prefers minimal effort and excludes the keyboard helpers, the spec falls back to: focus traps implemented via Radix defaults, ARIA on the trigger, and chip `aria-checked` only — no custom key handlers.

---

## 10. UX Behavior & Edge Cases

1. **Empty filter results**: when filter reduces the sidebar list to 0 games, render a single muted message in place of the list: `Filter no results` text + a `Reset all` link.
2. **Resizing the sidebar**: if sidebar width < 220 px when menu is open, the popover anchor side auto-flips from `bottom` to `right` so it doesn't overflow.
3. **No genres available**: Genre group rendered with disabled state and tooltip "No genre metadata available — try fetching game details".
4. **No statuses set**: Status group rendered with chips all at count=0 and disabled.
5. **One platform set, count=1**: chip still visible; selecting deselects (multi-select toggling).
6. **Filter persists across reloads**: localStorage hydration covers it (see §6.2).
7. **Hydration validation**: chip values that don't exist in the current library are silently dropped on hydrate (e.g. a previously-selected genre whose source game was removed).
8. **Add custom game button remains**: clicking `+` does not close the filter menu (independent).
9. **Search input synergy**: the title text filter in the `<TextField>` continues to work in conjunction with menu filters. The combined pipeline: Menu filters → sort → title substring. Both can be active simultaneously.
10. **Old Play button removal**: any code that referenced `showPlayableOnly` must be removed in the same PR. The `isGamePlayable` helper in `sidebar.tsx` is no longer needed there; can be inlined or kept (used by sort `installed_first`).
11. **No game status metadata**: a `LibraryGame` with `userStatus` undefined or `null` is treated as not-matching any status chip (so it disappears when any status chip is selected). This is consistent with current behavior in `game-status-dropdown.tsx`.

---

## 11. Interaction Diagram

```
[Trigger button (icon)]
        ↓ click
       open
        ↓
  ┌────────────────────────────┐
  │ LIBRARY SET (radio)        │ ← default: "All"
  │ STORES       (multi)       │
  │ GENRE        (multi)       │
  │ STATUS       (multi)       │
  │ SORT         (radio)       │
  │ [Reset all]                │
  └────────────────────────────┘
        ↓ selection
  update local state + localStorage
  recompute `sortedFilteredLibrary`
  re-render SidebarGameItem list
```

---

## 12. Acceptance Criteria

The implementation is complete when all of the following hold:

1. The header of the "Games" section in the sidebar shows only `[search][filter][+]` — no inline sort, no Play button.
2. Clicking the filter button opens a popover positioned below it with a 2-column layout.
3. Selecting any chip updates the sidebar list **immediately and without** the menu closing.
4. Closing the menu (Esc / outside-click / Reset) keeps the selections; re-opening shows the same selections.
5. Reloading the app preserves all selected filters (verified for each group).
6. AND-within AND-across semantics: e.g. selecting "Steam" in Stores **AND** "RPG" in Genre **AND** "playing" in Status returns games matching all three.
7. Count chips: each option label is suffixed with a count of games that match the **other selected filters** (recounts on selection change) — the user explicitly selected "Show counts on each chip".
8. Trigger button shows a numeric badge (`N`) when N>0 selections are active; no badge when 0.
9. Keyboard `Esc` closes the menu; `Tab` cycles groups; `Enter` toggles a chip.
10. Removing the showPlayableOnly button does not regress behavior (was: filter to playable-only; now: Library-set → Installed).
11. Empty-result state shows the localized message and the Reset all link.
12. Typecheck passes for the whole project (`yarn typecheck`).
13. Lint passes (`yarn lint`).

---

## 13. Implementation Order (Suggested Phases)

1. **Phase 1**: Build `SidebarFilterButton` + `SidebarFilterMenu` components with static data and visual layout (skip wiring into Sidebar yet).
2. **Phase 2**: Add `SidebarFilterState` to `sidebar.tsx`, replace sort `<select>` and Play button with the new trigger, wire live filtering.
3. **Phase 3**: Add localStorage persistence for the four filter groups (key per group).
4. **Phase 4**: Polish counts (recompute on change), empty state, ARIA attributes, keyboard handlers, reduced-motion.
5. **Phase 5**: i18n — add English keys; leave non-English locales untouched.
6. **Phase 6**: Manual QA across sidebar widths; typecheck + lint pass.

---

## 14. Out of Scope

- Mirroring sidebar filter selection onto the `/library` page filters.
- Sharing dropdown state between the desktop and Big Picture sidebars.
- Translating to non-English languages in v1.
- Stopping the sidebar global search input from filtering across the sidebar — it still works.
- A dedicated "Saved filters" feature (preserving combinations to re-apply later).
- Per-game filter chips (e.g. "show only friends who own this game" per row).
- Replacing the existing categories dropdown sort, platform-filter dropdowns on `/library`.
