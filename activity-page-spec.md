# Activity Page — Specification

## Summary

Add a new **Activity** page to Hydra Launcher accessible via a new `ClockIcon` button in the left sidebar. The page shows comprehensive game activity stats, playtime breakdowns, genre analysis, per-game playtime graphs, and social comparison with friends — all derived from local library data.

---

## 1. Sidebar Integration

### 1.1 New Activity Button

- **Location**: In the top routes section of the sidebar (`src/renderer/src/components/sidebar/routes.tsx`), alongside Home, Catalogue, Library, Downloads, and Settings
- **Icon**: `ClockIcon` from `@primer/octicons-react`
- **Label**: i18n key `"activity"` (namespace: `"sidebar"`)
- **Route**: `/activity`
- **Visibility**: Always visible (regardless of sign-in status)
- **Active state**: Highlighted when `location.pathname === "/activity"`

### 1.2 Route Registration

- Add `<Route path="/activity" element={<Activity />} />` inside the `<Route element={<App />}>` group in `src/renderer/src/main.tsx`
- Import the new `Activity` page component

---

## 2. Activity Page Layout

### 2.1 Page Structure

The Activity page is a full-page route rendered inside the existing `<App />` layout (with Header, Sidebar, BottomPanel).

**Layout**: Scrollable content area with the following sections (top to bottom):

```
┌─────────────────────────────────────────────┐
│  Date Range Filter Tabs                      │
│  [7 Days] [30 Days] [90 Days] [All Time]     │
├─────────────────────────────────────────────┤
│  ┌──────────┬──────────┬──────────┬────────┐ │
│  │ Total     │ Games     │ Most      │ Avg/Day│ │
│  │ Hours     │ Played    │ Active Day│       │ │
│  └──────────┴──────────┴──────────┴────────┘ │
├─────────────────────────────────────────────┤
│  ┌──────────────────┐ ┌──────────────────┐  │
│  │ Top 10 Played     │ │ Genre Breakdown   │  │
│  │ Games (table)     │ │ (donut chart)     │  │
│  └──────────────────┘ └──────────────────┘  │
├─────────────────────────────────────────────┤
│  Weekly Activity Heatmap                     │
├─────────────────────────────────────────────┤
│  Monthly Playtime Trend (line chart)         │
├─────────────────────────────────────────────┤
│  Recently Played Timeline                    │
├─────────────────────────────────────────────┤
│  ┌──────────────────┐ ┌──────────────────┐  │
│  │ Friends           │ │ Sessions Stats   │  │
│  │ Comparison        │ │ (avg duration,    │  │
│  │ (leaderboard)     │ │  sessions/day)    │  │
│  └──────────────────┘ └──────────────────┘  │
├─────────────────────────────────────────────┤
│  Per-Game Playtime Details (expandable)      │
└─────────────────────────────────────────────┘
```

### 2.2 Date Range Filter

- **Tabs/buttons** at top: `Last 7 Days`, `Last 30 Days`, `Last 90 Days`, `All Time`
- Default selection: `Last 7 Days`
- All stats sections update reactively when filter changes
- "All Time" uses the full `playTimeInMilliseconds` aggregate from LevelDB

### 2.3 Stats Overview Cards

Four cards in a horizontal row showing summary statistics for the selected date range:

| Card                | Data Source                                                   |
| ------------------- | ------------------------------------------------------------- |
| **Total Hours**     | Sum of all playtime within date range, formatted as `Xh Ym`   |
| **Games Played**    | Distinct count of games with playtime > 0 in the date range   |
| **Most Active Day** | Day with highest total playtime in the range, with hour count |
| **Average/Day**     | Total hours ÷ number of days in range (or days with activity) |

---

## 3. Charts & Visualizations

### 3.1 Charting Library

**Recharts** (`recharts`) — lightweight, React-native charting library.

- Install via `yarn add recharts`

### 3.2 Top 10 Most Played Games

- **Type**: Horizontal bar chart or sorted table
- **Columns**: Rank, Game icon + name, Playtime (hours)
- **Data**: Top 10 games sorted by playtimeInMilliseconds descending within the date range
- Each row is clickable to expand per-game details (see Section 3.7)

### 3.3 Genre Breakdown

Two sub-sections:

#### 3.3a Playtime by Genre (Donut/Pie Chart)

- Aggregate total playtime by genre across all games
- Genre data sourced from local game shop details cache (`SteamAppDetails.genres`)
- Games without genre data are grouped as "Other/Unknown"
- **Chart type**: Donut chart with legend

#### 3.3b Games per Genre Count

- Simple count of how many games in your library belong to each genre
- Displayed as a secondary smaller chart or table alongside the playtime donut

### 3.4 Weekly Activity Heatmap

- **Type**: GitHub-style contribution heatmap (7 columns × N rows for weeks)
- Each cell = one day, color intensity = hours played
- Hover shows date + hours
- Date range affects how many weeks are shown

### 3.5 Monthly Playtime Trend

- **Type**: Line chart or area chart
- X-axis: Days/Months (depending on date range)
- Y-axis: Hours played
- One line per month (if showing multiple months) or one line total

### 3.6 Recently Played Timeline

- **Type**: Vertical timeline list
- Shows most recent play sessions:
  - Game icon + name
  - Date + time of session
  - Duration
- Ordered by most recent first
- Source: `lastTimePlayed` + daily snapshots

---

## 4. Social Comparison (Friends)

### 4.1 Friends Leaderboard

- Only visible when user is signed in
- Shows a comparison table of the user's stats vs. friends:
  - Total playtime (all time)
  - Games played (all time)
  - Current streak (if applicable)
- Data fetched from Hydra Cloud API: `GET /profile/friends` with `includeStats` parameter
- User's own row highlighted

### 4.2 Friend Comparison Details

- Clicking a friend expands a row showing:
  - Shared games (games both have in library)
  - Who has more playtime per shared game

---

## 5. Per-Game Playtime Details

### 5.1 Location

On the Activity page itself — clicking a game in the "Top 10 Played" list (or any game row) expands an inline detail section below it.

### 5.2 Per-Game Detail Content

When expanded:

- **Daily Playtime Bar Chart**: Bar chart showing hours played per day over the selected date range
- **Game Stats Summary**:
  - Total playtime (all time)
  - Last played date
  - Session count
  - Average session duration
  - Genre tags
- **Last 7 Sessions**: Mini-table of recent sessions with date and duration

---

## 6. Live Updates

### 6.1 While Game is Running

- The Activity page listens to the existing `on-games-running` IPC event
- While the user is playing a game, the current day's stats update in real-time
- `playTimeInMilliseconds` from the running game is included in the current view
- The "Total Hours" card and "Today" cell in the heatmap update every ~2 seconds (tied to the existing `INTERVALS.processWatcher`)

### 6.2 When Not Running

- Data is computed from LevelDB on page load
- Manually refreshed by navigating away and back (or a future refresh button)

---

## 7. Data Storage — Daily Playtime Snapshots

### 7.1 LevelDB Sublevel

Add a new sublevel for daily playtime snapshots:

```typescript
// src/main/level/sublevels/keys.ts
levelKeys.dailyPlaytime = "dailyPlaytime";
levelKeys.dailyPlaytimeEntry = (
  shop: GameShop,
  objectId: string,
  date: string
) => `${shop}:${objectId}:${date}`;
```

Where `date` is an ISO date string (`YYYY-MM-DD`).

### 7.2 Snapshot Schema

```typescript
interface DailyPlaytimeSnapshot {
  shop: GameShop;
  objectId: string;
  date: string; // "YYYY-MM-DD"
  totalMilliseconds: number; // cumulative playtime for that day
}
```

### 7.3 Tracking Logic

Extend `process-watcher.ts`:

- In `onTickGame()`: Every tick, update or create today's snapshot for the game
- In `onCloseGame()`: Finalize today's snapshot
- Use `Date.now()` to determine the current date in local timezone
- Store as `{ valueEncoding: "json" }` sublevel

### 7.4 IPC Events

New IPC events to be registered:

| Event Name           | Direction     | Purpose                                    |
| -------------------- | ------------- | ------------------------------------------ |
| `getDailyPlaytime`   | renderer→main | Get playtime for date range                |
| `getPlaytimeSummary` | renderer→main | Get aggregated stats for overview cards    |
| `getFriendsStats`    | renderer→main | Get friends' playtime stats for comparison |

---

## 8. Component Tree

```
src/renderer/src/pages/activity/
├── activity.tsx                  # Main page component
├── activity.scss                 # Page styles
├── date-range-filter.tsx         # Date range tab selector
├── stats-overview-cards.tsx      # 4-card summary row
├── top-played-games.tsx          # Top 10 games table/chart
├── genre-breakdown.tsx           # Genre donut chart + count
├── weekly-heatmap.tsx            # Contribution-style heatmap
├── monthly-trend.tsx             # Line/area chart of playtime over time
├── recent-timeline.tsx           # Recently played timeline list
├── friends-comparison.tsx        # Friends leaderboard comparison
├── per-game-details.tsx          # Expandable per-game detail panel
└── index.ts                      # Re-exports
```

---

## 9. i18n Keys

New translation keys to add (namespace: `"activity"`):

```json
{
  "activity": "Activity",
  "last_7_days": "Last 7 Days",
  "last_30_days": "Last 30 Days",
  "last_90_days": "Last 90 Days",
  "all_time": "All Time",
  "total_hours": "Total Hours",
  "games_played": "Games Played",
  "most_active_day": "Most Active Day",
  "avg_per_day": "Avg/Day",
  "top_played_games": "Top Played Games",
  "genre_breakdown": "Genre Breakdown",
  "playtime_by_genre": "Playtime by Genre",
  "games_per_genre": "Games per Genre",
  "weekly_activity": "Weekly Activity",
  "monthly_trend": "Monthly Trend",
  "recently_played": "Recently Played",
  "friends_comparison": "Friends Comparison",
  "sessions_stats": "Session Stats",
  "avg_session_duration": "Avg Session Duration",
  "sessions_per_day": "Sessions/Day",
  "no_activity_yet": "No activity recorded yet",
  "other_genres": "Other",
  "shared_games": "Shared Games",
  "per_game_details": "Game Details",
  "total_playtime": "Total Playtime",
  "last_played": "Last Played",
  "session_count": "Sessions",
  "recent_sessions": "Recent Sessions"
}
```

---

## 10. Implementation Steps (High-Level)

1. **Data Layer**: Add `dailyPlaytime` sublevel to LevelDB keys and create the sublevel instance
2. **Tracking**: Extend `process-watcher.ts` to write daily snapshots on tick and close
3. **IPC Events**: Register `getDailyPlaytime`, `getPlaytimeSummary`, `getFriendsStats` events
4. **Preload**: Expose new IPC methods in `src/preload/index.ts` and types in `declaration.d.ts`
5. **Chart Library**: Install `recharts` via `yarn add recharts`
6. **Activity Page**: Create the page component tree under `src/renderer/src/pages/activity/`
7. **Routing**: Add `/activity` route in `main.tsx` and sidebar button in `routes.tsx`
8. **i18n**: Add translation keys to all locale files (`src/locales/*/translation.json`)
9. **Styling**: Create SCSS matching existing dark theme conventions
10. **Testing**: Typecheck + lint + manual verification

---

## 11. Edge Cases & Constraints

- **No playtime data yet**: Show empty state with "No activity recorded yet" message
- **Custom/Launchbox games without genres**: Group under "Other" in genre charts
- **Games without icons**: Use a default placeholder icon
- **Date range with zero activity**: Show 0 for all stats, empty charts
- **Not signed in**: Friends comparison section shows a "Sign in to compare with friends" prompt
- **Very large libraries (1000+ games)**: Paginate/limit the Top Played list rendering
- **Midnight crossover**: Sessions spanning midnight split across two daily snapshots
- **Performance**: Daily snapshot lookups are O(n) where n = games × days — for "All Time" ranges with large libraries, cache results or paginate

---

## 12. Dependencies

- **New npm package**: `recharts` (charting library)
- **Existing deps used**: `@primer/octicons-react` (ClockIcon), `classnames`, `react-router-dom`, `react-i18next`, `classic-level`

---

## 13. Open Questions / Future Enhancements

- Achievement milestones displayed alongside playtime stats
- Export activity data as CSV/JSON
- Custom date range picker (beyond presets)
- Global Hydra community leaderboards (requires API changes)
