# News / RSS Aggregator + Game-Details CrackWatch Section — Implementation Spec

> Scope: port the CrackWatch game-details sidebar from `abrahampo1/hydra` commit `0954a5b`, and add a brand-new top-level **News** tab that aggregates RSS feeds (curated default list + user-added), with an in-tab settings modal. No CrackWatch/RSS code currently exists in `main` on this repo. The fork's commit already references `RssFeed`/`NewsArticle` types so the data model is partially planned there.

---

## 1. Goals

1. **CrackWatch (per-game)** — Each game's detail page shows a `CrackWatchSection` (Cracked / Uncracked badge + protection + group + crack date). Steam titles only.
2. **News tab** — A new top-level tab between **Activity** and **Deals**, rendering an aggregated RSS feed reader with per-article read/unread state, source filters, and a per-article "Open Inline / Open Externally" menu.
3. **News Settings Modal** — A cog icon in the News tab header opens a modal for managing feed subscriptions (curated defaults + user-added).
4. **Tab unread badge + global toggle** — Tab badge shows unread count (from main process IPC events). A Settings page toggle hides the entire News tab for users who don't want it.

---

## 2. Non-Goals / Out of Scope

- No RSS support in Big Picture mode (separate Vite build — leave a TODO).
- No article sharing to Hydra Cloud or friends.
- No comments / annotations.
- No push / desktop notifications for new articles.
- No image scraping beyond `<enclosure>` (RSS) and `<media:thumbnail>` (Atom) — articles without explicit media use favicon-only thumbnails.
- No AI summarization or content rewriting.

---

## 3. Reference & Pattern Sources (existing repo files to mirror)

| Reference                         | File                                                                                                                               | Why                                                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| External service with cache + TTL | `src/main/services/itad-giveaway-service.ts`                                                                                       | Same pattern for RSS polling + per-feed cached state.                                                                           |
| Polling orchestration             | `src/main/services/main-loop.ts`                                                                                                   | Add a `wrapInLoop()` for the news poller.                                                                                       |
| Section in game-details sidebar   | `src/renderer/src/pages/game-details/sidebar/how-long-to-beat-section.tsx`                                                         | Mirror the layout/skeleton/badge styling for `CrackWatchSection`.                                                               |
| IPC event registration            | `src/main/events/register-event.ts` + one example handler                                                                          | Standard shape `registerEvent(name, listener)`.                                                                                 |
| LevelDB sublevels                 | `src/main/level/sublevels/keys.ts` + `downloads.ts` / `download-sources.ts`                                                        | Add `news-feeds` and `news-read-state` and `crackwatchCache` (the last one was missing in our `keys.ts` until now).             |
| Generic React Modal               | `src/renderer/src/components/modal/modal.tsx`                                                                                      | Use for the News settings modal.                                                                                                |
| TabBar tabs                       | `src/renderer/src/components/tab-bar/tab-bar.tsx`                                                                                  | Insert `news` between `activity` and `deals` in `TABS` array, with a numeric badge.                                             |
| Settings categories               | `src/renderer/src/pages/settings/settings.tsx`                                                                                     | Add a "News" category (sibling of "Content & Gameplay") + the master enable toggle in `Settings > General > Sidebar / Content`. |
| Top-level routes                  | Router is implicit via `<Outlet />` in `src/renderer/src/app.tsx`; child pages register their own `useEffect` of `setHeaderTitle`. |
| i18n                              | `src/locales/en/translation.json` (and the 39 sibling locale files).                                                               |
| Preload bridge                    | `src/preload/index.ts`                                                                                                             | `contextBridge.exposeInMainWorld("electron", { … })`.                                                                           |
| Renderer `window.electron` types  | `src/renderer/src/declaration.d.ts`                                                                                                | Extend the `Electron` interface.                                                                                                |
| Virtualized rendering             | `rc-virtual-list` is already in `package.json` (used by catalogue paginator).                                                      |

---

## 4. Architecture Decisions

### 4.1 Where RSS fetching & parsing happen

- **Main process** only, via `axios` (already a dependency) and `cheerio` (already a dependency, version `^1.2.0`). Why: avoids CORS for almost all casual RSS endpoints; keeps the renderer free of XML parsing and large-buffer pressure.
- A custom `User-Agent: Hydra/RSS-Reader (+https://hydra.launcher)` is set on every request; some feeds (Reddit `.rss`, PCGamingWiki) require a UA.
- Failed fetches (network/HTTP/non-2xx) are logged and the per-feed `lastFetchAt` is still updated; we never throw to the renderer.

### 4.2 Read-state storage

- **LevelDB sublevel** `newsReadState` → `{ guid, readAt }`.
- Key: `newsReadState:${guid}` (guid = `<guid>` element; falls back to `<link>`/`<id>`/`${feedUrl}:${title}` SHA-1 when missing).
- Value: `{ readAt: number }` (Unix ms).
- Pruning: **sliding 60-day window** on app start — entries older than `Date.now() - 60 * 24 * 3600 * 1000` are deleted.

### 4.3 Webview vs external

- **Per-click choice** in a small menu attached to each article card:
  - "Open Inline" — opens a Modal containing a sandboxed `<iframe sandbox="allow-same-origin allow-scripts">` with a CSP that disallows top-level navigation.
  - "Open Externally" — calls existing `window.electron.openExternal(url)`.
- No per-feed default and no global default — the user's selection fires immediately per click.

### 4.4 Polling architecture

- One `wrapInLoop()` block in `src/main/services/main-loop.ts`, gated by a new `INTERVALS.newsWatcher = 15 * 60 * 1000` (env-configurable)
- Inside `news-service.ts`: fanned-out `Promise.allSettled()` across all enabled feeds.
- **Per-feed in-memory backoff map** `feedUrl -> backoffMs`. On 429 / 5xx (or any error), double the backoff up to 1 h; on success, reset.
- After a successful pass: compute total unread count from articles not in `newsReadState`, then fire `onUnreadNewsCountUpdated` (existing `ipcRenderer.on` pattern).

### 4.5 Settings storage

- Feed subscription list in a new **LevelDB sublevel** `news-feeds` keyed by feed URL, value:
  ```
  { url, label, enabled, isDefault, addedAt, lastFetchAt, lastError }
  ```
- Master "show News tab" toggle stored in **userPreferences** (existing pattern in `src/renderer/src/features/use-preferences-slice.ts`).

### 4.6 Performance — list rendering

- Use `rc-virtual-list` (already used by catalogue) in the News tab.
- A "Show only unread" toggle is persisted in `userPreferences` so it survives restart.

### 4.7 i18n namespace layout

- `crackwatch_status` / `cracked` / `uncracked` / `crack_group` / `crack_date` / `protection` — added inside the `game_details` block.
- New top-level `news` block for tab labels, modal labels, article states, etc.
- The TabBar label `news` is in `sidebar` block (matches existing TABS pattern, which uses `t(tab.labelKey, { ns: "sidebar" })` in `tab-bar.tsx`).

---

## 5. Default Curated Feed List (shipped enabled-by-default)

The user-supplied list (game-news sites):

| Label              | RSS URL                                 |
| ------------------ | --------------------------------------- |
| IGN                | `https://feeds.feedburner.com/ign/all`  |
| PC Gamer           | `https://www.pcgamer.com/rss/`          |
| Polygon            | `https://www.polygon.com/rss/index.xml` |
| Eurogamer          | `https://www.eurogamer.net/?format=rss` |
| Kotaku             | `https://kotaku.com/rss`                |
| GameSpot           | `https://www.gamespot.com/feeds/mars/`  |
| Rock Paper Shotgun | `https://www.rockpapershotgun.com/feed` |

These are seeded on first run of the new code (only if `news-feeds` sublevel is empty). Marked `isDefault: true` so they can be removed/disabled/toggled by user but the seed isn't repeated.

---

## 6. TypeScript Types

### 6.1 `src/types/crackwatch.types.ts` (port from fork)

```ts
export interface CrackWatchStatus {
  isCracked: boolean;
  crackDate: string | null;
  crackGroup: string | null;
  protection: string | null;
}
```

### 6.2 `src/types/news.types.ts` (new)

```ts
export interface RssFeed {
  url: string; // canonical feed URL (key in LevelDB)
  label: string; // user-visible name
  enabled: boolean; // participates in polling
  isDefault: boolean; // shipped curated list
  addedAt: number; // unix ms
  lastFetchAt: number | null; // unix ms, null if never fetched
  lastError: string | null; // last seen error string, null when healthy
  etag?: string | null; // optional HTTP ETag for conditional GET
  lastModified?: string | null; // optional Last-Modified
}

export interface NewsArticle {
  guid: string; // stable id (uses guid || link || hash(title))
  feedUrl: string; // back-pointer to RssFeed.url
  feedLabel: string; // denormalised for fast render
  title: string;
  link: string;
  author?: string | null;
  pubDate: number; // unix ms
  summary: string | null; // sanitized text snippet (max 280 chars)
  thumbnailUrl: string | null; // resolved from enclosure / media:thumbnail / favicon
  categories: string[]; // tags from <category>
}

export interface NewsFeedFetchResult {
  feed: RssFeed;
  articles: NewsArticle[];
  error: string | null;
}

export interface NewsSnapshot {
  feeds: RssFeed[];
  articles: NewsArticle[];
  fetchedAt: number; // latest successful pass timestamp
  totalUnread: number;
}

export interface MarkReadResult {
  guid: string;
  readAt: number;
}
```

Add export line in `src/types/index.ts` (currently re-exports `./news.types` and we add `./crackwatch.types`).

---

## 7. LevelDB Layout — Sublevels to add

### 7.1 `src/main/level/sublevels/keys.ts` — additions

```ts
crackwatchCache: "crackwatchCache",     // already declared in fork; mirror here
newsFeeds: "newsFeeds",                 // list of subscribed feeds (RssFeed[])
newsReadState: "newsReadState",         // guid -> { readAt: number }
```

### 7.2 Sublevel files (new)

- `src/main/level/sublevels/crackwatch-cache.ts` (mirror of fork's):
  ```ts
  export const crackwatchCacheSublevel = db.sublevel<
    string,
    CrackWatchStatus & { updatedAt: number }
  >(levelKeys.crackwatchCache, { valueEncoding: "json" });
  ```
- `src/main/level/sublevels/news-feeds.ts`:
  ```ts
  export const newsFeedsSublevel = db.sublevel<string, RssFeed>(levelKeys.newsFeeds, { valueEncoding: "json" });
  export async function listNewsFeeds(): Promise<RssFeed[]> { … }
  export async function upsertNewsFeed(feed: RssFeed): Promise<void> { … }
  export async function deleteNewsFeed(url: string): Promise<void> { … }
  ```
- `src/main/level/sublevels/news-read-state.ts`:
  ```ts
  export const newsReadStateSublevel = db.sublevel<string, { readAt: number }>(
    levelKeys.newsReadState, { valueEncoding: "json" }
  );
  export async function pruneOldReadStates(olderThanMs: number): Promise<number> { … }
  ```
- Add the three new lines to `src/main/level/sublevels/index.ts`.

---

## 8. Services — Main Process

### 8.1 `src/main/services/crackwatch-service.ts` (port from fork)

- `axios.create(...)` to `https://gamestatus.info` with timeout 8000 ms and a custom UA.
- `titleToSlug(title)` → slug.
- `getStatusByTitleAndAppId(title, appId)`:
  - GET `/<slug>/en` as text
  - regex-extract `__NUXT_DATA__` script content → `JSON.parse` to an array
  - `derefNuxtState(arr)` resolves the index-pointer structure (port from fork verbatim)
  - Walk the array, find entries with `slug`, `crack_date`, `steam_prod_id` and `description_en || specs_info` (game detail vs related-game disambiguation)
  - Match `steam_prod_id === appId`
  - Return `{ isCracked, crackDate, crackGroup, protection }` or `null`
- All failures return `null` with a `logger.warn`.
- Type `CrackWatchStatus` re-exported from `@types`.

### 8.2 `src/main/services/news-service.ts` (new)

- Module state:
  - `backoffMs: Map<string, number>` — per-feed backoff (cleared on success).
  - `cachedSnapshot: NewsSnapshot | null` — last successful snapshot.
- Public methods:
  - `init()` — seed default feeds on first run (only if `newsFeeds` is empty), start prune of read-state.
  - `listFeeds(): Promise<RssFeed[]>`
  - `addFeed(input: { url, label }): Promise<RssFeed>` — validate URL via `new URL(input.url)`, dedupe by canonicalised URL, fetch once for label sanity.
  - `removeFeed(url: string): Promise<void>`
  - `toggleFeed(url: string, enabled: boolean): Promise<void>`
  - `getSnapshot(): Promise<NewsSnapshot>` — returns cached if fresh; otherwise triggers a poll and waits up to `MAX_POLL_WAIT_MS = 8000`.
  - `markRead(guid: string): Promise<MarkReadResult>`
  - `markAllRead(): Promise<{ count: number }>`
  - `clearAllRead(): Promise<void>` — used by "Clear read history" button in modal
- `pollOnce()` private:
  - `Promise.allSettled` across all enabled feeds
  - Honour per-feed backoff (skip if `backoffMs > now`)
  - For each result:
    - Parse XML/RSS using `cheerio` (treat `application/rss+xml`, `application/atom+xml`, `application/xml`, `text/xml` as inputs)
    - Universal parse: detect RSS 2.0 vs Atom 1.0 root; map child elements consistently into `NewsArticle`.
    - Update `RssFeed.etag`, `RssFeed.lastModified`
    - On 304: keep prior article set
    - On error: increment backoff, store `lastError`
  - After pass:
    - Persist the new article set into a **time-bounded cache** (not LevelDB — articles are transient, max 2000 most-recent in memory; LevelDB just stores the read-state keys).
    - Compute `totalUnread`
    - Send `onUnreadNewsCountUpdated` to renderer with `{ count: number }`
- Parser detail (universal extractor):
  - Iterate items (`<item>` for RSS, `<entry>` for Atom)
  - `guid = $('guid').text() || $('id').text() || sha1(feedUrl + ':' + link)`
  - `link = $('link').attr('href') || $('link').text()`
  - `pubDate = Date.parse(...)  || Date.now()`
  - `summary` = `description` or `summary` or `content` trimmed to 280 chars, HTML stripped via a tiny cheerio-driven sanitiser (no `script`/`<iframe>`)
  - `thumbnailUrl` = first enclosure that looks like image, then `media:thumbnail`, then favicon (resolve via `https://www.google.com/s2/favicons?domain=${feedOrigin}&sz=64`)
  - `categories` = text of all `<category>` nodes
- Backoff API surface for the main loop:
  - `news-service.pollOnce()` — called by `wrapInLoop`

### 8.3 `src/main/services/main-loop.ts` — additions

Add two new `wrapInLoop` callbacks (matching existing style with logger in catch):

```ts
wrapInLoop(() => newsService.pollOnce(), INTERVALS.newsWatcher);
wrapInLoop(
  () => pruneOldReadStates(60 * 24 * 3600 * 1000),
  INTERVALS.newsReadPrune
);
```

Add `newsWatcher: 15 * 60 * 1000` and `newsReadPrune: 6 * 60 * 60 * 1000` to `INTERVALS` in `src/main/constants.ts`.

### 8.4 Seed default feeds — first run only

Inside `newsService.init()` (called from `main-loop` startup or from the first `getSnapshot()` call):

```ts
if ((await newsFeedsSublevel.values().all()).length === 0) {
  for (const url of DEFAULT_FEED_URLS) {
    await newsFeedsSublevel.put(url, {
      url,
      label: inferLabelFromUrl(url),
      enabled: true,
      isDefault: true,
      addedAt: Date.now(),
      lastFetchAt: null,
      lastError: null,
    });
  }
}
```

---

## 9. IPC Surface — Events

### 9.1 New handlers

Create files under `src/main/events/`:

- `src/main/events/catalogue/get-crackwatch-status.ts` (port of fork)
- `src/main/events/news/`
  - `get-news-snapshot.ts` → `getNewsSnapshot(forceRefresh?: boolean)`
  - `list-news-feeds.ts`
  - `add-news-feed.ts`
  - `remove-news-feed.ts`
  - `toggle-news-feed.ts`
  - `mark-news-article-read.ts`
  - `mark-all-news-read.ts`
  - `clear-news-read-history.ts`

All registered with `registerEvent(name, listener)`.

### 9.2 New broadcast event

- Channel: `onUnreadNewsCountUpdated` → fired by `newsService.pollOnce()` after each successful pass
  - Payload: `{ count: number }`
- Subscribe helper in preload:
  ```ts
  onUnreadNewsCountUpdated: (cb: (value: { count: number }) => void) => () => void;
  ```

### 9.3 Add imports to barrel files

- `src/main/events/catalogue/index.ts` → add `import "./get-crackwatch-status";`
- New `src/main/events/news/index.ts` containing all the imports, add to `src/main/events/index.ts`.

### 9.4 Preload (`src/preload/index.ts`) addition

```ts
/* CrackWatch */
getCrackWatchStatus: (objectId: string, shop: GameShop, title: string) =>
  ipcRenderer.invoke("getCrackWatchStatus", objectId, shop, title),

/* News */
getNewsSnapshot: (forceRefresh?: boolean) =>
  ipcRenderer.invoke("getNewsSnapshot", forceRefresh),
listNewsFeeds: () => ipcRenderer.invoke("listNewsFeeds"),
addNewsFeed: (data: { url: string; label: string }) =>
  ipcRenderer.invoke("addNewsFeed", data),
removeNewsFeed: (url: string) => ipcRenderer.invoke("removeNewsFeed", url),
toggleNewsFeed: (url: string, enabled: boolean) =>
  ipcRenderer.invoke("toggleNewsFeed", url, enabled),
markNewsArticleRead: (guid: string) =>
  ipcRenderer.invoke("markNewsArticleRead", guid),
markAllNewsRead: () => ipcRenderer.invoke("markAllNewsRead"),
clearNewsReadHistory: () => ipcRenderer.invoke("clearNewsReadHistory"),
onUnreadNewsCountUpdated: (cb: (value: { count: number }) => void) => {
  const listener = (_e: Electron.IpcRendererEvent, v: { count: number }) => cb(v);
  ipcRenderer.on("onUnreadNewsCountUpdated", listener);
  return () => ipcRenderer.removeListener("onUnreadNewsCountUpdated", listener);
},
```

### 9.5 Renderer `window.electron` typings (`src/renderer/src/declaration.d.ts`)

Append bindings for everything in §9.4, matching the existing JSDoc style in the file.

---

## 10. UI — Renderer

### 10.1 TabBar (`src/renderer/src/components/tab-bar/tab-bar.tsx`)

- Insert in `TABS` array between `activity` and `deals`:
  ```ts
  {
    labelKey: "news",
    path: "/news",
    render: () => <NewsIcon size={16} />,         // from @primer/octicons-react (already imported family)
  },
  ```
- Subscribe to `electron.onUnreadNewsCountUpdated`; show `<span className="tab-bar__badge tab-bar__badge--count">{count}</span>` next to the News icon when count > 0 (matches the existing `pendingDownloadCount` pattern in `tab-bar.tsx`).
- Add i18n keys `news` (in sidebar block) and `news_unread_tooltip` (in sidebar block).

### 10.2 News Page (`src/renderer/src/pages/news/` — new directory)

Files:

- `news.tsx` — top-level layout:
  - Sticky header (matches `library.tsx`'s `library__page-header` style) with title + a right-side cog button.
  - Toolbar (also sticky): search input, source multi-select chip strip, `Show only unread` toggle, `Refresh` button, `Mark all read` button.
  - Virtualized list via `rc-virtual-list` (same import style as `src/big-picture/src/pages/catalogue/pagination.tsx`):
    - `dataSource = [...filteredAndSortedArticles]`
    - `rowRenderer = (article) => <ArticleCard … />`
- `news.scss` — local styles
- `article-card.tsx`:
  - Props: `article: NewsArticle`, `read: boolean`, `onOpen: (mode: "inline" | "external") => void`, `onToggleRead: () => void`
  - Layout: thumbnail (40 px), feedLabel + pubDate header line, bold title, optional summary, right-side kebab/trash button (`Mark read` / `Mark unread`).
  - Click row → opens modal picker `Open Inline | Open Externally` (the per-click menu).
- `news-settings-modal.tsx`:
  - Reuses `<Modal />` from `src/renderer/src/components/modal/modal.tsx`.
  - Lists subscribed feeds (toggle enabled, label, remove). New row at the top: `Add feed` (URL + label, with "Fetch & validate" inline button).
  - Footer: `Clear read history` + `Reset to defaults`.
- `article-inline-modal.tsx` (used when user picks _Open Inline_):
  - Another `<Modal large>` containing a sandboxed iframe with `sandbox="allow-same-origin allow-scripts"` and a `referrerPolicy="no-referrer"`.
  - Close on Escape (handled by `Modal` itself), provides `Open Externally` button + `Copy link` button.

### 10.3 Game-Details Sidebar — CrackWatch

- New `src/renderer/src/pages/game-details/sidebar/crackwatch-section.tsx` (port of fork, identical to the fork's 80-line file).
- Edit `src/renderer/src/pages/game-details/sidebar/sidebar.tsx`:
  - Import the new section.
  - Add a state block parallel to `howLongToBeat`.
  - On `objectId || gameTitle` change → `electron.getCrackWatchStatus(objectId, shop, gameTitle)`.
  - Render `<CrackWatchSection />` immediately before `<HowLongToBeatSection />`.
- Add SCSS for `.crackwatch__*` selectors to `src/renderer/src/pages/game-details/sidebar/sidebar.scss` — port the fork's rules verbatim.

### 10.4 Settings — Master toggle & dedicated category

Two additions to settings:

1. **Master "Show News tab" toggle** in `Settings > General > Sidebar` (file `src/renderer/src/pages/settings/settings-context-general.tsx`) — sits alongside `sidebarShowFriendsBadge`. Key: `sidebarShowNewsTab` (boolean, default true). When false, the News tab is hidden in `TABS` entirely (filter at render time in `tab-bar.tsx`).
2. **Dedicated `News` category** in `Settings > categories`:
   - Add to the `categories` array in `settings.tsx`:
     ```ts
     {
       id: "news" as const,
       label: t("news"),
       icon: <NewsIcon size={16} />,
     },
     ```
   - New file `src/renderer/src/pages/settings/settings-context-news.tsx`:
     - Master toggle (duplicate of sidebar toggle for discoverability).
     - "Default refresh interval" — select [15 min / 30 min / 1 h / Manual only]; persisted in `userPreferences.newsPollingIntervalMs` (drives `INTERVALS.newsWatcher`).
     - "Open articles in…" global default — radio button (inline / external / per-click). Default = per-click.
     - "Maximum articles cached" — number input, default 2000, persisted in `userPreferences.newsMaxCachedArticles`.
   - Wire in `settings.tsx`'s `renderCategory()` and `categories` list.

### 10.5 Router entry — News page route

- Wherever routes are registered (in `app.tsx` or a sibling router file), add `<Route path="/news" element={<News />} />` matching the existing top-level `Route` pattern.

---

## 11. Per-Article "open" Menu — Behavior

- Tap on the article row → show a small inline confirmation/picker: `Open Inline` / `Open Externally`. Implementation notes:
  - Default row click behavior: show a small inline prompt with two buttons (NOT a system context menu).
  - Optional keyboard shortcut: `Shift+Enter` = Open Externally, `Enter` = Open Inline.
  - The choice is NOT persisted (per the user requirement).
- "Open Inline" opens `article-inline-modal.tsx` with the iframe. CSP:
  - `default-src 'self'; img-src * data:; style-src 'self' 'unsafe-inline'; frame-src https:;`

---

## 12. Schedule, Backoff, and Read-State Logic

- On `pollOnce()`:
  - For each enabled feed:
    - If `feed.lastFetchAt + (currentBackoff ?? INTERVALS.newsWatcher) > Date.now()` → skip.
    - Otherwise `axios.get(url, { headers: { 'If-None-Match': feed.etag, 'If-Modified-Since': feed.lastModified } })`.
    - On 200 → parse + persist; reset backoff to default.
    - On 304 → keep prior article set; mark `lastFetchAt = Date.now()`.
    - On 429 / 5xx / network error → `feed.lastError = err.message`; double the backoff up to `60 * 60 * 1000`.
    - Always update `feed.lastFetchAt`.
- Read-state pruning (`pruneOldReadStates(60d)`):
  - Iterate `newsReadState` values, delete where `readAt < cutoff`.

---

## 13. i18n Keys

### 13.1 `crackwatch_*` (in `game_details` block, ~6 keys)

```
crackwatch_status: "CrackWatch"
cracked: "Cracked"
uncracked: "Uncracked"
crack_group: "Group"
crack_date: "Crack date"
protection: "Protection"
```

Mirror these in every locale file (39 files under `src/locales/`) — fork already did this for EN/AR/BE/BG/CA/CS/DA/DE/ES/ET/FA/FI/FR/HU/ID/IT/JA/KK/KO/LV/NB/NL/PL/PT-BR/PT-PT/RO/RU/SL/SV/TR/UK/UZ/ZH. We will mirror exactly to keep parity.

### 13.2 `news` (new top-level block, ~25 keys)

```
news: "News"
news_search_placeholder: "Search articles"
news_filter_source: "Source"
news_filter_all: "All sources"
news_show_only_unread: "Show only unread"
news_refresh: "Refresh"
news_mark_all_read: "Mark all read"
news_empty: "No articles yet"
news_empty_filtered: "No articles match the current filter"
news_unread_count: "{count} unread"
news_settings_modal_title: "News Settings"
news_add_feed: "Add feed"
news_add_feed_url_label: "Feed URL"
news_add_feed_label_label: "Display name"
news_add_feed_submit: "Add"
news_add_feed_invalid: "Please enter a valid http(s) URL"
news_add_feed_failed: "Could not fetch or parse this feed"
news_feed_enabled: "Enabled"
news_feed_remove: "Remove"
news_settings_clear_history: "Clear read history"
news_settings_reset_defaults: "Reset to default feeds"
news_settings_interval_label: "Refresh interval"
news_inline_open: "Open inline"
news_external_open: "Open externally"
news_inline_view: "Inline view"
```

The `sidebar.news` key also needs `news` and `news_unread_tooltip` (count tooltip).

---

## 14. Risk Assessment (must address before tagging "done")

1. **CORS / Cloudflare 403** — mitigated by main-process fetching + custom UA + `Accept: application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8`.
2. **429 backoff** must be aggressively implemented (see §12) so abusive polling doesn't get the user's IP throttled.
3. **Memory** — keep only the top N (default 2000) articles in memory after poll, sorted by `pubDate` desc. Articles outside the window are discarded unless opened (in which case they can be re-fetched).
4. **HTML in summaries** — sanitize via cheerio (script/iframe stripped) before sending to renderer. Renderer still takes strings only; never renders raw feed HTML.
5. **Open-redirect / XSS in inline iframe** — sandbox + CSP, no `allow-top-navigation`. Cancel iframe load on navigation attempt.
6. **Feed URL normalization** — canonicalise before keying (`trim().toLowerCase()`, drop trailing `/`, drop default ports, drop `www.`, drop `utm_*` query params).
7. **Large feed body on log** — clip feed body length when logging to avoid noisy `logger.info`.
8. **First-run UX** — if all default feeds error, show an inline empty state with a "Try adding a feed manually" CTA.
9. **Race between useEffect-init and async fetch** — same pattern as `HowLongToBeatSection`: set `{ isLoading: true, data: null }` then resolve.
10. **`newsReadState` uniqueness** — must guarantee `guid` uniqueness cross-feed → SHA-1 fallback when both `<guid>` and `<id>` are missing.

---

## 15. Done Criteria (acceptance)

- [ ] `yarn typecheck` passes.
- [ ] `yarn lint` passes.
- [ ] `yarn build` succeeds.
- [ ] Manual smoke test: open a Steam game → CrackWatch section shows badge. Open News tab → seeded feeds populate.
- [ ] Manual smoke test: add a custom RSS URL → it shows up in the modal and articles appear.
- [ ] Manual smoke test: mark a few articles as read → tab badge updates; restart Hydra → state preserved.
- [ ] Manual smoke test: fail a feed (drop Wi-Fi) → that feed shows `lastError` but the rest still render.
- [ ] `sidebar__sidebar-button` for `Content & Gameplay` "Show News tab" toggle hides Hides the tab globally.
- [ ] i18n parity: every key in `en` is also present (even if English fallback) in all 39 locale files.

---

## 16. Files we'll Add vs Modify

### 16.1 New files

```
src/types/crackwatch.types.ts
src/types/news.types.ts
src/main/services/crackwatch-service.ts
src/main/services/news-service.ts
src/main/level/sublevels/crackwatch-cache.ts
src/main/level/sublevels/news-feeds.ts
src/main/level/sublevels/news-read-state.ts
src/main/events/catalogue/get-crackwatch-status.ts
src/main/events/news/index.ts
src/main/events/news/get-news-snapshot.ts
src/main/events/news/list-news-feeds.ts
src/main/events/news/add-news-feed.ts
src/main/events/news/remove-news-feed.ts
src/main/events/news/toggle-news-feed.ts
src/main/events/news/mark-news-article-read.ts
src/main/events/news/mark-all-news-read.ts
src/main/events/news/clear-news-read-history.ts
src/renderer/src/pages/news/news.tsx
src/renderer/src/pages/news/news.scss
src/renderer/src/pages/news/article-card.tsx
src/renderer/src/pages/news/news-settings-modal.tsx
src/renderer/src/pages/news/article-inline-modal.tsx
src/renderer/src/pages/game-details/sidebar/crackwatch-section.tsx
src/renderer/src/pages/settings/settings-context-news.tsx
```

### 16.2 Existing files to modify

```
src/main/constants.ts                        // + newsWatcher, newsReadPrune
src/main/services/main-loop.ts               // + 2 wrapInLoop calls
src/main/services/index.ts                   // + export crackwatch, news
src/main/level/sublevels/keys.ts             // + 3 new keys
src/main/level/sublevels/index.ts            // + 3 new lines
src/main/events/index.ts                     // + import "./news"
src/main/events/catalogue/index.ts           // + import "./get-crackwatch-status"
src/preload/index.ts                         // + 8 invoke calls + 1 on-event
src/renderer/src/declaration.d.ts            // + types
src/types/index.ts                           // + export crackwatch.types
src/renderer/src/components/tab-bar/tab-bar.tsx    // + news tab + badge
src/renderer/src/app.tsx                     // + route for /news (if routes are declared here)
src/renderer/src/pages/settings/settings.tsx           // + news category
src/renderer/src/pages/settings/settings-context-general.tsx    // + global toggle
src/renderer/src/pages/game-details/sidebar/sidebar.tsx           // + CrackWatch state + render
src/renderer/src/pages/game-details/sidebar/sidebar.scss          // + crackwatch styles
src/locales/en/translation.json + 39 siblings                // + news block & crackwatch keys
```

---

## 17. Implementation Order (avoid being blocked)

1. `src/types/crackwatch.types.ts` + `src/types/news.types.ts` + extend `src/types/index.ts`.
2. New sublevels + new keys (`crackwatchCache`, `newsFeeds`, `newsReadState`).
3. `news-service.ts` skeleton (no fetch yet) + IPC bridge is wired.
4. `crackwatch-service.ts` + IPC + game-details sidebar UI + styles. **Checkpoint: small enough to verify end-to-end.**
5. `news-service.ts` full parser (RSS 2.0 + Atom), `pollOnce()`, `markRead()`, `addFeed()`, snapshot get/setter.
6. News IPC handlers + preload additions + `declaration.d.ts` types.
7. News page (`news.tsx`, `article-card.tsx`, `news.scss`) + virtualized list + filters + per-click open menu.
8. `news-settings-modal.tsx` (manage feeds, clear history, reset defaults).
9. `article-inline-modal.tsx` (sandboxed iframe).
10. TabBar integration (News tab between Activity and Deals, unread badge).
11. Settings page new "News" category + the master "Show News tab" toggle in `settings-context-general.tsx`.
12. i18n — populate `en` first, then mirror to other locales (fork already added `crackwatch_*` keys to all 39 locales; we mirror those exactly).
13. Add `INTERVALS.newsWatcher` / `INTERVALS.newsReadPrune`; add `wrapInLoop` calls in `main-loop.ts`.
14. Final QA pass — every checkbox in §15.

---

## 18. Future Hooks (out of scope but worth noting in code comments)

- Big Picture mode parity.
- Per-feed "favorite" syncing via Hydra Cloud (like tags collections).
- Push/desktop notifications when unreadCount transitions 0 → >0 while the app is foregrounded.
- Optional article deduplication across feeds.

---

## 19. Open Implementation Questions (flagged; will resolve during build)

- Concrete icon for the News tab (N.B. `@primer/octicons-react` is already used elsewhere — look for a "news" / "Rss" / "broadcast" icon). Default: `<RssIcon size={16} />` if available, fallback `BookIcon`.
- Exact column used for the Settings sidebar; reusing "Content & Gameplay" or splitting into a sibling? **Plan: sibling category `news` (right after `integrations`)**. Re-confirm during build.
- Should `mark-read` be debounced on scroll-based heuristics? **Plan: explicit only (click or "Mark all read")** — no implicit read-on-scroll tracking.

---

## 20. Summary

- One fork-ported CrackWatch section + one new top-level News tab + one in-tab settings modal.
- Architecture: main-process polling + LevelDB-backed persistence + renderer-side virtualized list.
- Polling 15 min default with per-feed adaptive backoff.
- 60-day read-state retention.
- 25 new i18n keys + ~6 ported crackwatch keys mirrored to all 39 locales.
