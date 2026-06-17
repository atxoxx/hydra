# Game Page Refactor Specification

## Overview

Refactor the game details page (`src/renderer/src/pages/game-details/`) to be more useful, efficiently navigable, and visually cohesive with the rest of the application. The redesign introduces a tab-based navigation system, a dashboard-style Overview tab, improved sidebar organization, similar game suggestions, and visual theming enhancements.

---

## 1. Tab Structure

### 1.1 Tabs

Three tabs at the top of the game page content area (below the hero backdrop):

| Tab | Name         | Content                                                                                                           |
| --- | ------------ | ----------------------------------------------------------------------------------------------------------------- |
| 1   | **Overview** | Dashboard cards (compact summary), similar games section at bottom                                                |
| 2   | **Details**  | Reviews, Activity chart, System Requirements, HowLongToBeat, Achievements, ProtonDB, Language, Controller Support |
| 3   | **Weblinks** | Website links panel (PCGamingWiki, SteamDB, HowLongToBeat, etc. iframe tabs)                                      |

### 1.2 Tab Behavior

- **State management**: React state only (no URL routing for tabs)
- **Default tab**: Overview
- **Persistence**: Last active tab is NOT persisted between game navigations; always resets to Overview
- **Position**: Tabs sit between the hero backdrop and the content area, styled with the sidebar/settings visual language (glass-like, rounded)

### 1.3 Tab Bar Visual

- Styled as a row of tab buttons with the sidebar-section card aesthetic
- Active tab has a highlighted underline/accent indicator
- Uses existing app color palette: `$background-color` cards, `$border-color` separators
- Icons next to tab labels (optional enhancement)

---

## 2. Hero Section

### 2.1 Keep as Backdrop

- The full-width hero image remains as a visual backdrop behind the top section
- The hero backdrop spans full width, with the game logo overlay and player counter retained
- Height: reduced slightly from current (~350px to ~280-300px) to allow more dashboard visibility

### 2.2 Hero Panel

- The current `HeroPanel` component (play/download actions, progress bars) moves into a **dashboard card** within the Overview tab
- No longer a floating panel over the hero image
- Action buttons (Play, Download, Favorite, etc.) become part of the Play/Status dashboard card

### 2.3 Randomizer

- The "Next Suggestion" randomizer button is **kept**
- Relocated to appear near the similar games section (bottom of Overview tab) as a subtle icon/button

---

## 3. Overview Tab ("Dashboard")

### 3.1 Layout

The Overview tab presents a **dashboard-style grid** of cards, arranged in a responsive layout:

```
┌─────────────────────────────────────────────────────┐
│  ┌──────────────┐  ┌──────────┐  ┌───────────────┐ │
│  │ Play/Status  │  │  Stats   │  │ HowLongToBeat │ │
│  │   Card       │  │  Card    │  │     Card      │ │
│  └──────────────┘  └──────────┘  └───────────────┘ │
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │              Description Card                    ││
│  │  (collapsible, with "Show more" toggle)         ││
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │           Gallery / Media Card                   ││
│  │  (screenshot slider or compact thumbnail row)   ││
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │          Similar Games Section                   ││
│  │  (horizontal scroll row of game cards)          ││
│  └──────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

### 3.2 Dashboard Cards

#### Card 1: Play / Status Card

- **States**: Not owned, Owned (not installed), Installed (playable), Downloading (progress), Running, Extracting, Transferring
- Shows game status prominently with contextual action button
- Secondary actions: Favorite toggle, Pin toggle, Options gear icon
- Download progress bar inline when downloading

#### Card 2: Stats Card

- Download count (with `DownloadIcon`)
- Player count (with `PeopleIcon`)
- Average rating (with `StarRating` component)
- Compact vertical or horizontal layout adapting to card width

#### Card 3: HowLongToBeat Card

- Main story, Main + Extra, Completionist times
- Visual time indicators (clock icon, formatted hours)
- Loading skeleton while fetching

#### Card 4: Description Card

- "About the Game" HTML content from shop details
- Collapsible with "Show more" / "Show less" toggle
- Same overflow detection logic as current implementation
- Date and publisher info from `DescriptionHeader` component integrated at top

#### Card 5: Gallery / Media Card

- Compact version of the current `GallerySlider`
- Could be a horizontal preview row with click-to-expand or the full carousel
- Thumbnail navigation strip

### 3.3 Similar Games ("More Like This")

- Position: Bottom of the Overview tab (below all dashboard cards)
- **Data source**: API/backend endpoint for similar games based on genre, tags, publisher
- **Presentation**: Horizontal scrollable row of game cards with cover art and title
- Each card links to that game's detail page
- Shows loading skeleton while fetching
- Shows empty state message if no similar games found
- The randomizer ("Next Suggestion") button sits near/within this section

---

## 4. Details Tab

### 4.1 Content

All deep-dive sections displayed in a single scrollable column:

| Section             | Component             | Notes                                                 |
| ------------------- | --------------------- | ----------------------------------------------------- |
| Reviews             | `GameReviews`         | Full review threads with sort options, reply composer |
| Activity            | `GameActivityPanel`   | 90-day playtime bar chart, total/session/avg stats    |
| System Requirements | Inline (from sidebar) | Min/Recommended toggle, HTML requirement details      |
| Achievements        | Inline (from sidebar) | Achievement list with unlock status                   |
| ProtonDB            | Inline (from sidebar) | Linux-only, ProtonDB tier badge and details           |
| Language            | Inline (from sidebar) | Supported languages list                              |
| Controller Support  | Inline (from sidebar) | Controller icons and support badge                    |

### 4.2 Layout

- All sections use the `sidebar-section` card style (glass-like, rounded corners, border)
- Sections are collapsible with remembered state (see §6)
- Full-width, single column in the main content area

---

## 5. Sidebar

### 5.1 Position & Persistence

- **Sticky right sidebar**: Persists across all tabs
- Width: Responsive (280px → 420px depending on viewport)
- Independent vertical scroll

### 5.2 Content by Tab

#### Overview Tab Sidebar

Shows key info only:

- **Stats** section (downloads, players, ratings — duplicated from dashboard for quick reference)
- **HowLongToBeat** section
- **Controller Support** section

#### Details Tab Sidebar

Shows supplementary info:

- **System Requirements** (min/recommended toggle)
- **Achievements** (top 4, with "See all" link)
- **ProtonDB** (Linux only)
- **Language** section

#### Weblinks Tab Sidebar

- Empty or minimal — the weblinks iframe takes full content width

### 5.3 Sidebar Visual Style

- Adopt the existing `sidebar-section` card style used in settings pages
- Glass-like effect: `background-color: $background-color`, `border: 1px solid rgba(255,255,255,0.05)`, `border-radius: 12px`, subtle box-shadow
- Smooth collapse/expand animations (already implemented in `SidebarSection`)

---

## 6. Collapsible Sections

### 6.1 State Persistence

- Collapsed/expanded state for each section is **persisted to localStorage** (or LevelDB)
- Keyed by section identifier (e.g., `hydra_sidebar_collapsed_stats`, `hydra_sidebar_collapsed_requirements`)
- Survives app restarts and page navigations

### 6.2 Smart Defaults

- On first visit (no saved state), all sections start **expanded**
- ProtonDB section: auto-collapsed on non-Linux platforms (already the case)
- Launchbox details: only shown for launchbox games (unchanged)

### 6.3 Visual

- Chevron icon rotates on toggle (existing behavior in `SidebarSection`)
- Smooth max-height transition (existing CSS `transition: max-height 0.4s`)

---

## 7. Similar Games Suggestions

### 7.1 API Endpoint

- New or existing API endpoint: `/games/:shop/:objectId/similar`
- Returns an array of game summaries with: `objectId`, `shop`, `title`, `coverImage` (libraryHeroImageUrl or iconUrl), `genres`
- Falls back gracefully (empty array) if endpoint fails or returns nothing

### 7.2 UI Component

| Property     | Value                                                                           |
| ------------ | ------------------------------------------------------------------------------- |
| Position     | Bottom of Overview tab                                                          |
| Layout       | Horizontal scrollable row using embla-carousel (same library as gallery slider) |
| Card size    | ~160px wide, ~240px tall                                                        |
| Card content | Cover image + game title                                                        |
| Loading      | Skeleton placeholders (3-5 cards)                                               |
| Empty        | Subtle "No similar games found" message                                         |
| Max items    | 10-15 games                                                                     |

### 7.3 Randomizer Integration

- A "Random Game" icon/button sits at the end of the similar games row
- Clicking navigates to a random game with `fromRandomizer=1` query param (existing behavior)

---

## 8. Theming / Visual Overhaul

### 8.1 Approach

- Work within the **existing custom theme CSS injection system** (no breaking changes)
- Themes loaded via `loadAndApplyTheme()` → `injectCustomCss()` in `app.tsx` continue to work

### 8.2 Visual Language (Adopt Sidebar/Settings Style)

The game page should adopt the polished card aesthetic seen in the settings sidebar and sidebar sections:

| Element         | Current                       | Target                                                       |
| --------------- | ----------------------------- | ------------------------------------------------------------ |
| Card background | `$background-color` (#121212) | Same, with subtle inner highlight                            |
| Card border     | `rgba(255,255,255,0.08)`      | `rgba(255,255,255,0.05)` for a softer look                   |
| Card radius     | Varies (8px, 10px, 12px)      | Standardized **12px** for all cards                          |
| Card shadow     | Minimal                       | `0 4px 12px rgba(0,0,0,0.1)`                                 |
| Section gaps    | Inconsistent                  | Standardized `$spacing-unit * 1.5` (12px)                    |
| Typography      | Mixed sizes                   | Consistent hierarchy: titles 14px bold, body 14px, meta 12px |

### 8.3 Gradients & Polish

- Add subtle gradient overlays to dashboard cards (similar to the HowLongToBeat `linear-gradient` in sidebar)
- Glass effect on cards: `background: rgba(18, 18, 18, 0.8); backdrop-filter: blur(12px);`
- Hover states: `background-color: rgba(255,255,255,0.03)` transition on interactive cards
- Consistent use of `$border-color` and `$muted-color` from globals

### 8.4 Color Cohesion

- Use the existing SCSS variables from `globals.scss`:
  - `$background-color: #121212`
  - `$dark-background-color: #0d0d0d`
  - `$muted-color: #f0f1f7`
  - `$body-color: #d0d1d7`
  - `$border-color: rgba(255,255,255,0.08)`
  - `$brand-teal: #16b195`
  - `$brand-blue: #3e62c0`

### 8.5 Inconsistent Styling Fix

- Unify border-radius across all card components to 12px
- Unify padding to multiples of `$spacing-unit` (8px)
- Unify section gap to `$spacing-unit * 1.5` (12px)

---

## 9. Layout Architecture

### 9.1 Overall Structure

```
┌──────────────────────────────────────────────────────────┐
│                     Hero Backdrop                        │
│  (game logo, player counter, reduced height)            │
├──────────────────────────────────────────────────────────┤
│  [ Overview ]  [ Details ]  [ Weblinks ]    ← Tab Bar   │
├───────────────────────────────────────┬──────────────────┤
│                                       │                  │
│        Tab Content Area              │    Sidebar       │
│        (variable per tab)            │   (sticky,       │
│                                       │   full height,  │
│                                       │   independently │
│                                       │   scrollable)   │
│                                       │                  │
├───────────────────────────────────────┴──────────────────┤
│  (similar games row at bottom of Overview only)         │
└──────────────────────────────────────────────────────────┘
```

### 9.2 Component Tree

```
GameDetails (page component)
├── HeroBackdrop (reduced height, logo, player counter)
├── TabBar (Overview | Details | Weblinks)
├── TabContent
│   ├── OverviewTab
│   │   ├── DashboardGrid
│   │   │   ├── PlayStatusCard
│   │   │   ├── StatsCard
│   │   │   ├── HowLongToBeatCard
│   │   │   ├── DescriptionCard
│   │   │   └── GalleryCard
│   │   └── SimilarGamesRow
│   │       └── RandomizerButton
│   ├── DetailsTab
│   │   ├── ReviewsSection
│   │   ├── ActivitySection
│   │   ├── RequirementsSection
│   │   ├── AchievementsSection
│   │   ├── ProtonDBSection
│   │   ├── LanguageSection
│   │   └── ControllerSupportSection
│   └── WeblinksTab
│       └── WebsiteLinksPanel
└── Sidebar (sticky, content varies per tab)
    ├── [Overview] StatsSection + HLTBSection + ControllerSection
    └── [Details] RequirementsSection + AchievementsSection + etc.
```

---

## 10. File Changes

### 10.1 Files to Modify

| File                                                                      | Changes                                         |
| ------------------------------------------------------------------------- | ----------------------------------------------- |
| `src/renderer/src/pages/game-details/game-details.tsx`                    | Add tab state, restructure layout               |
| `src/renderer/src/pages/game-details/game-details.scss`                   | New grid/dashboard styles, tab styles           |
| `src/renderer/src/pages/game-details/game-details-content.tsx`            | Split into tab components, remove old layout    |
| `src/renderer/src/pages/game-details/sidebar/sidebar.tsx`                 | Conditional rendering per active tab            |
| `src/renderer/src/pages/game-details/sidebar/sidebar.scss`                | Visual polish                                   |
| `src/renderer/src/pages/game-details/sidebar-section/sidebar-section.tsx` | Add localStorage persistence for collapse state |
| `src/renderer/src/pages/game-details/hero/hero-panel.tsx`                 | Move actions into dashboard card                |
| `src/renderer/src/pages/game-details/hero/hero-panel.scss`                | Adjust styling                                  |
| `src/renderer/src/pages/game-details/game-details-skeleton.tsx`           | Update skeleton to match new layout             |

### 10.2 Files to Create

| File                                                                            | Purpose                              |
| ------------------------------------------------------------------------------- | ------------------------------------ |
| `src/renderer/src/pages/game-details/tabs/tab-bar.tsx`                          | Tab navigation component             |
| `src/renderer/src/pages/game-details/tabs/tab-bar.scss`                         | Tab bar styles                       |
| `src/renderer/src/pages/game-details/tabs/overview-tab.tsx`                     | Overview dashboard tab               |
| `src/renderer/src/pages/game-details/tabs/overview-tab.scss`                    | Dashboard grid styles                |
| `src/renderer/src/pages/game-details/tabs/details-tab.tsx`                      | Details tab (all deep-dive sections) |
| `src/renderer/src/pages/game-details/tabs/details-tab.scss`                     | Details tab styles                   |
| `src/renderer/src/pages/game-details/tabs/weblinks-tab.tsx`                     | Weblinks tab wrapper                 |
| `src/renderer/src/pages/game-details/dashboard-cards/play-status-card.tsx`      | Play/status dashboard card           |
| `src/renderer/src/pages/game-details/dashboard-cards/stats-card.tsx`            | Stats dashboard card                 |
| `src/renderer/src/pages/game-details/dashboard-cards/how-long-to-beat-card.tsx` | HLTB dashboard card                  |
| `src/renderer/src/pages/game-details/dashboard-cards/description-card.tsx`      | Description dashboard card           |
| `src/renderer/src/pages/game-details/dashboard-cards/gallery-card.tsx`          | Gallery/media dashboard card         |
| `src/renderer/src/pages/game-details/similar-games/similar-games.tsx`           | Similar games component              |
| `src/renderer/src/pages/game-details/similar-games/similar-games.scss`          | Similar games styles                 |

---

## 11. Backwards Compatibility

### 11.1 Must Preserve

- All existing IPC event listeners (`hydra:openRepacks`, `hydra:openGameOptions`, etc.)
- Cloud sync context provider and modal
- NSFW content blocking modal
- Repacks modal and game options modal (triggered from dashboard cards)
- Download progress, extraction progress, transfer progress displays
- Randomizer URL parameter handling (`fromRandomizer=1`)
- Launchbox/Classics game special rendering (hero bookmark, classic hero layout)
- All existing translations (new keys added, none removed without migration)

### 11.2 Theme Compatibility

- Existing themes that inject CSS continue to work
- New UI uses the same SCSS variables, so theme overrides of those variables cascade correctly

---

## 12. Edge Cases & States

### 12.1 Loading State

- Dashboard cards show skeleton placeholders while data loads
- Similar games show skeleton cards (3-5 placeholders)
- Tab content shows skeletons matching the target layout

### 12.2 Empty States

- No similar games: "No similar games found" message
- No reviews yet: Existing empty review prompt
- No activity: "No activity yet" message (existing)
- Custom games without shop details: Graceful fallbacks

### 12.3 Error States

- API failure for similar games: Silently fallback to empty (no error toast)
- Failed stats/HLTB fetch: Card shows "Unavailable" or similar

### 12.4 Game States

- Not in library, no repacks: "No downloads available" + Add to library button
- Not in library, has repacks: Download button + Add to library
- In library, not installed, has executable: Play button
- In library, not installed, no executable: Download button
- In library, installed: Play button
- Downloading: Progress bar in card
- Running: Close button
- Extracting: Progress bar
- Transferring: Transfer progress with cancel
- Deleted/invalid: Not own state, show download if repacks exist

---

## 13. Responsive Considerations

- Dashboard grid: 3 columns desktop → 2 columns tablet → 1 column mobile
- Sidebar: responsive widths preserved (280px → 420px)
- Tab bar: horizontal scrolling on narrow viewports (if needed)
- Similar games row: horizontal scroll works naturally on all widths

---

## 14. Non-Goals (Out of Scope)

- No changes to the download modal or repacks modal
- No changes to game options modal functionality
- No changes to the review system (posting, replying, sorting)
- No changes to the achievement detail page
- No changes to cloud sync functionality
- No mobile-specific breakpoints beyond existing ones
- No animation library changes (keep embla-carousel, CSS transitions)

---

## 15. Implementation Order

1. Create the `TabBar` component and integrate into `GameDetails`
2. Restructure layout to support tab switching + sticky sidebar
3. Build the Overview tab with dashboard cards
4. Build the Details tab (move sections from sidebar)
5. Build the Weblinks tab
6. Implement similar games API integration + UI
7. Update sidebar to vary content per tab
8. Add collapse state persistence to SidebarSection
9. Apply visual theming polish (unified styles, glass effects, gradients)
10. Update skeleton/loading states
11. Typecheck, lint, and test
