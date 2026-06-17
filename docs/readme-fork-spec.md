# README Fork Section — Specification

## Summary

Append a new section to `README.md` titled **"Fork — what's new & different"** that:

1. Leads with a **GitHub blockquote note** declaring the repo is a personal fork, heavily inspired by [Playnite](https://www.playnite.app/) and its plugin ecosystem, built with AI assistance, and that more features are coming.
2. Follows with a **full two-column table** (`Feature` / `What it adds`) listing ~25+ features that distinguish this fork from upstream Hydra, each annotated with a status (`New`, `Refactor`, `Beta`, `Enhanced`).

The section sits **directly after the existing `## Features` block**, before `## Build from source and contributing`. The upstream hero image, badges, contributors wall, and license block are kept intact.

No code changes. README-only update. One commit, README + this spec.

---

## 1. Decisions (from 3-round interview)

| Question                       | Decision                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| Section heading                | `Fork — what's new & different`                                                          |
| Tone                           | Technical + neutral (feature-list voice, no marketing fluff)                             |
| Placement                      | Right after existing `## Features` block, before `## Build from source and contributing` |
| Note style                     | GitHub blockquote (`> …`)                                                                |
| List depth                     | Full detailed list (~25+ features)                                                       |
| List format                    | Two-column table: `Feature` / `What it adds` (plus a `Status` column)                    |
| Scope coverage                 | All four selected: integrations · UI/UX · metadata + library · activity/stats            |
| Per-feature status notes       | Yes — `New` / `Refactor` / `Beta` / `Enhanced`                                           |
| "Vibe coding" wording          | "Vibe-coded with AI assistance" (no specific tool name)                                  |
| Playnite credit                | Inline text + link to https://www.playnite.app/                                          |
| "More features will come" line | Trailing sentence inside the blockquote                                                  |
| Upstream assets                | Keep badges, hero screenshot, contributors block, license block untouched                |

---

## 2. Exact Position in README

Final section order in `README.md` after this change:

1. Hero block (title, description, badges, screenshot)
2. **`## Features`** ← untouched
3. **`## Fork — what's new & different`** ← **NEW**
   - Blockquote note
   - Differences table
4. **`## Build from source and contributing`** ← untouched
5. **`## Contributors`** ← untouched
6. **`## License`** ← untouched

Edge cases:

- An `---` horizontal rule is **not** added between `Features` and `Fork — what's new & different` — heading hierarchy alone is enough.
- A trailing `---` is **not** added after the new section; the existing layout already breathes via the headings.

---

## 3. The Blockquote Note (Exact Text)

The GitHub blockquote note appears as the **first element under `## Fork — what's new & different`**, before the table:

```markdown
> This is a **personal fork** built for my own use, heavily inspired by
> [Playnite](https://www.playnite.app/) and its rich plugin ecosystem. It is a
> **vibe-coded with AI assistance** project — more features will come.
```

Notes:

- `Playnite` link points to `https://www.playnite.app/` (canonical homepage).
- Acknowledgements to the **upstream authors** are preserved by the unmodified `## Contributors` section that uses the live GitHub contributors image.
- No images, badges, or icons inside the blockquote — it's a single statement.
- The blockquote uses two leading `>` characters to insert a line break inside the same blockquote rather than splitting it into two adjacent blockquotes (works in GitHub renderer).

---

## 4. Differences Table

### 4.1 Layout

The differences table is split into **four sub-tables**, one per scope group, each under an `###` heading. Each sub-table has three columns: `Status`, `Feature`, `What it adds`.

```markdown
### New integrations & services

| Status     | Feature                           | What it adds                                                               |
| ---------- | --------------------------------- | -------------------------------------------------------------------------- |
| `New`      | Deals page (ITAD + Xbox GamePass) | Sub-tabbed page hosting IsThereAnyDeal and the Xbox GamePass PC catalog…   |
| `Refactor` | Layout redesign                   | Sidebar trimmed to collections + games; new top TabBar with right actions… |
| …          | …                                 | …                                                                          |
```

- Three columns: `Status`, `Feature`, `What it adds`.
- Status cell uses **inline code spans** (`New`) so they render as monospace badges — consistent with the project's README convention.
- Cell content is short (one phrase / one sentence) but informational. Verbs lean technical: "adds", "exposes", "rewires", "tunes".
- Tables are GitHub-flavored Markdown — the renderer supports column widths via alignment colons.
- Four `###` headings act as visual group separators (`### New integrations & services`, `### UI / UX improvements`, `### Metadata + library tools`, `### Activity / stats`). This is a cleaner rendering than a single mega-table with empty-row separators and is the structure actually applied in `README.md`.

### 4.2 Status Vocabulary

| Status     | Meaning                                             |
| ---------- | --------------------------------------------------- |
| `New`      | Brand-new feature, not in upstream Hydra.           |
| `Refactor` | Existing feature re-implemented with new structure. |
| `Enhanced` | Existing feature deeply extended / polished.        |
| `Beta`     | Functional but unstable or experimental.            |

### 4.3 Grouped Feature Inventory (to enumerate in the table)

The realised structure uses **four sub-tables** under `###` headings (Integrations · UI/UX · Metadata + Library · Activity/Stats; see §4.1) rather than a single mega-table. This section enumerates which features go into each group and the verified wording for each row.

**Group A — New integrations & services**

| #   | Status     | Feature                             | What it adds                                                                                                                                                                                                         |
| --- | ---------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `New`      | Deals page (ITAD + Xbox GamePass)   | A sub-tabbed page accessible from the sidebar hosting **IsThereAnyDeal** deal monitoring and the **Xbox GamePass** PC catalog browser, with 15-min / 1-hour caches, multi-region support and direct Xbox app launch. |
| A2  | `New`      | IsThereAnyDeal giveaways panel      | The ITAD sub-tab lists live giveaways; fixed the silent empty-state so un-authenticated users can still see live giveaways with retry + an in-app refresh button.                                                    |
| A3  | `Enhanced` | HowLongToBeat card                  | Multi-provider fan-out (HLTB + Backlogged + IGDB/Steam), modern compact layout, inline Extend toggle, and an Edit picker with typeahead that persists the chosen `{provider, externalId}` on the game record.        |
| A4  | `Refactor` | Steam Reviews sub-tab               | In-page sub-tab on the game details page modeled on the Playnite **ReviewViewer** plugin — sort tabs, filters, per-review metadata, cursor-based infinite scroll.                                                    |
| A5  | `New`      | Steam Stats panel                   | Live player-count badge on the hero banner (Steam Web API + SteamSpy peak + SteamCharts trend) and a sidebar Steam rating/review breakdown section.                                                                  |
| A6  | `New`      | Multi-store OAuth library import    | OAuth-based sign-in for Steam / Epic / GOG / Amazon / Xbox / Battle.net / Ubisoft / Rockstar / itch.io / Humble; imports owned libraries into the user's Hydra library.                                              |
| A7  | `New`      | Steam Family Share import           | Local Steam config parsed to discover family members; their libraries are imported as separate entries with an owner badge.                                                                                          |
| A8  | `Refactor` | Multi-platform file system scanning | `platform-scanner.ts` extended for Epic / GOG / Battle.net / Amazon / Ubisoft / Xbox / Rockstar / itch.io / Humble install-path discovery in addition to the existing Steam scanner.                                 |

**Group B — UI / UX improvements**

| #   | Status     | Feature                                     | What it adds                                                                                                                                                                                                    |
| --- | ---------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | `Refactor` | Layout redesign                             | Sidebar strips route navigation; new top `TabBar` (Store · Library · Watchlist · Activity); right-side icon buttons for Downloads / Settings / Friends / Big Picture; Downloads dropdown opens from the header. |
| B2  | `New`      | Sidebar filter menu                         | Master/detail popover for Library set · Stores/Platform · Genre · Status · Sort; multi-select chips; AND-within-AND semantics; persisted to `localStorage`.                                                     |
| B3  | `Enhanced` | Sidebar game item                           | Two-level row: title on top, badges row underneath with playtime, achievements (trophy icon) and friends-who-own count with hover tooltip + modal.                                                              |
| B4  | `New`      | "Play Next" suggestions section             | Collapsible sidebar section suggesting unplayed games and recently-played-but-stalled games, prioritised by recency.                                                                                            |
| B5  | `New`      | Sidebar friends-ownership modal             | Lists every friend who owns a given game with online/offline status, navigates to the friend's profile on click.                                                                                                |
| B6  | `New`      | Catalogue watchlist                         | Per-game must-play/want/later priority, free-text notes, dedicated `/watchlist` page, and a catalogue filter chip.                                                                                              |
| B7  | `Refactor` | Game page (Overview/Details/Web Links tabs) | The hero is now a backdrop; tabs separate Overview (dashboard cards + similar games), Details (review / activity / meta) and Web Links. Collapsible sidebar sections persist state via `localStorage`.          |
| B8  | `Enhanced` | Hero panel actions                          | The play/download/favorite actions are normalised across `LibraryGameCard` and the new compact hero card — same icons, behaviour and download-progress integration.                                             |
| B9  | `Refactor` | Profile loading UX                          | Differentiated error toasts (404 vs 401/403 vs generic), diagnostic logs, and a deterministic fallback navigation to `/store` instead of `navigate(-1)`.                                                        |

**Group C — Metadata + library tools**

| #   | Status     | Feature                      | What it adds                                                                                                                                                                                                                                                                                                                                  |
| --- | ---------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | `Enhanced` | Metadata enhancement         | Multi-source metadata merge (Hydra API → Steam → SteamGridDB → PCGamingWiki → IGN → VNDB) with per-field source attribution.                                                                                                                                                                                                                  |
| C2  | `Refactor` | Metadata panel (sub-tabs)    | Game Options → Metadata panel split into **General** (editable fields + status + Download Metadata) and **Media** (multi-source image search). Saved via explicit Save button with toast.                                                                                                                                                     |
| C3  | `New`      | Game status management       | Playnite-style status enum (Not Played, Playing, On Hold, Played, Beaten, Completed, Abandoned, Plan to Play); rendered as a colour-coded dropdown in the Stats card and on the metadata panel.                                                                                                                                               |
| C4  | `New`      | Chip input + tag suggestions | Reusable auto-suggesting chip component used for genres / developers / publishers / tags — feeds from library-wide values.                                                                                                                                                                                                                    |
| C5  | `Enhanced` | Selective metadata merge     | The Download Metadata modal now lists per-field checkboxes (Select All / Deselect All) and only fills checked fields into the form.                                                                                                                                                                                                           |
| C6  | `New`      | Asset search (Google Images) | Inside the Media sub-tab a left panel auto-runs a Google Images query per asset type (icon/logo/hero); users preview + apply; thumbs are filtered by aspect ratio.                                                                                                                                                                            |
| C7  | `New`      | SteamGridDB integration      | Image and grid search via `steamgriddb-api.ts`; respects a user-supplied SteamGridDB API key under Settings → Integrations → Metadata Sources.                                                                                                                                                                                                |
| C8  | `Enhanced` | Store/library tab rework     | PC category replaces its dropdown with a horizontal tab bar (`All PC · Local · Steam · Epic · GOG · …`) plus an `All / Installed / Not installed` segmented control; library `LibraryGameCard` dims uninstalled covers.                                                                                                                       |
| C9  | `Refactor` | Website links panel          | Twelve gaming sites (Steam Store, SteamDB, ProtonDB, PCGamingWiki, Twitch, NexusMods, ModDB, GameFAQs, Metacritic, HowLongToBeat, IGDB, YouTube) with per-game last-active-tab persistence, reorderable and toggleable. Fixes: removed `sandbox=yes`, sane `onNewWindow`, 60 s timeout, referer-aware header spoofing in the preview session. |
| C10 | `New`      | Catalogue env-var hardening  | Centralised env-config module with production fallbacks (Hydra API, auth, WS, checkout, external resources) + a `.env.example` — the catalogue works in a fresh `yarn build:win` without crashing.                                                                                                                                            |

**Group D — Activity / stats**

| #   | Status     | Feature                          | What it adds                                                                                                                                                                                                    |
| --- | ---------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | `New`      | Activity page                    | Full-screen app-level Activity view: 7d/30d/90d/All Time range tabs, four summary cards, top-10 played, genre donut, weekly heatmap, monthly trend, recent timeline, friends comparison and per-game expansion. |
| D2  | `New`      | Daily playtime snapshots         | New `dailyPlaytime` LevelDB sublevel tracks per-day totals; surfaced as the Activity heatmap and the in-game activity chart.                                                                                    |
| D3  | `Refactor` | Game activity panel              | Nivo-powered chart with bar labels, sparklines with tooltips on hover (FPS/CPU/GPU/RAM/temp), taller chart height when sidebar is hidden.                                                                       |
| D4  | `New`      | Session tracking                 | A new `sessions` LevelDB sublevel records per-session start/end; the renderer shows a Recent Sessions timeline on the app Activity page and per-game session history.                                           |
| D5  | `New`      | Hardware monitoring              | The Rust `hydra-native` addon collects FPS / CPU usage / CPU temp / GPU usage / GPU temp / RAM usage during gameplay at a configurable polling interval (default 5 s) when enabled.                             |
| D6  | `Enhanced` | HowLongToBeat progress bars      | Per-category slim progress bars under each HLTB time, driven by the user's `playTimeInMilliseconds` against `durationSeconds`.                                                                                  |
| D7  | `Beta`     | Performance alerts               | Optional toast notifications during gameplay when FPS / CPU temp / GPU temp / CPU usage / RAM usage cross user-defined thresholds. Sparkline warnings show on the session list.                                 |
| D8  | `New`      | Steam rating chip on the sidebar | Slim Steam rating card on the game details sidebar — descriptor + percent + % bar inline; clicking jumps to the Steam Reviews sub-tab.                                                                          |

That gives **33 features** across four scope groups. The table is intentionally comprehensive per the "Full detailed list (~25+ features)" interview answer.

---

## 5. Markdown / Formatting Decisions

### 5.1 Inline-`code` for status

Each status uses backticks — GitHub renders it as a soft-grey monospace pill:

```
| `New`    | Deals page             | … |
| `Refactor`| Layout redesign       | … |
```

This matches the visual convention used elsewhere in Hydra's docs folder and gives the table a visual rhythm without depending on Shields.io or emoji.

### 5.2 Link handling

- The only inline link in the new section is the **Playnite** link inside the blockquote. It points to `https://www.playnite.app/`.
- Feature names in the table are **not** hyperlinked — this README lives in the same repo as `docs/`, but feature specs are intentionally not promoted on the README (they are internal documentation). If the user wants anchors to the specs later, that is a follow-up task.

### 5.3 Line length in cells

Each "What it adds" cell is one concise sentence:

- Begins with a verb ("Hosts", "Pulls in", "Reports", "Moves", "Replaces").
- Caps itself at ~22 words.
- Uses semicolons to chain related ideas but avoids nested clauses.

### 5.4 Final README.md contents (after change)

The complete new section, with all four groups and the blockquote, ends up at ~110 lines added to the README. Snippet (representative):

```markdown
## Fork — what's new & different

> This is a **personal fork** built for my own use, heavily inspired by
> [Playnite](https://www.playnite.app/) and its rich plugin ecosystem. It is a
> **vibe-coded with AI assistance** project — more features will come.

### New integrations & services

| Status     | Feature                           | What it adds |
| ---------- | --------------------------------- | ------------ |
| `New`      | Deals page (ITAD + Xbox GamePass) | …            |
| `New`      | IsThereAnyDeal giveaways panel    | …            |
| `Enhanced` | HowLongToBeat card                | …            |
| …          | …                                 | …            |

### UI / UX improvements

| Status     | Feature         | What it adds |
| ---------- | --------------- | ------------ |
| `Refactor` | Layout redesign | …            |
| …          | …               | …            |

### Metadata + library tools

| Status     | Feature              | What it adds |
| ---------- | -------------------- | ------------ |
| `Enhanced` | Metadata enhancement | …            |
| …          | …                    | …            |

### Activity / stats

| Status | Feature       | What it adds |
| ------ | ------------- | ------------ |
| `New`  | Activity page | …            |
| …      | …             | …            |
```

Each sub-table sits under its own `###` heading; the blockquote opens the section. The `###` headings are the group separator — cleaner than empty-row separators inside a single mega-table and they read well on GitHub's renderer.

---

## 6. Out of Scope

- **No code or feature changes** beyond `README.md` (no `package.json`, no `src/` modifications).
- **No new terminology or renaming** of existing repo conventions: still calling it Hydra Launcher, still referencing Hydra Cloud, still keeping the `Los Broxas` author line.
- **No changes** to upstream badges:
  - `build`, `release`, `chocolatey` shields are kept verbatim.
  - The hero screenshot URL still resolves from `docs/screenshot.png`.
- **No new screenshots / gifs** added in the new section (a single screenshot/diagram is out of scope per "Technical + neutral" tone).
- **No localisation of the README** — it remains English-only.
- **No CONTRIBUTING / CODE_OF_CONDUCT** changes — Playnite is mentioned via link, not adopted as a project governance model.
- **No license changes** — remains MIT.
- **No mention** of an in-repo CONTRIBUTING.md path if it doesn't exist (none was found in initial scan).

---

## 7. Acceptance Criteria

1. `README.md` has a new section heading `## Fork — what's new & different` placed **immediately after** `## Features` and **before** `## Build from source and contributing`.
2. The blockquote appears as the **first** content under that heading and contains the exact text from §3 (Playnite link + vibe-coded line + "more features will come").
3. The differences table contains **at least 25 rows** with a `Status` cell (one of `New`, `Refactor`, `Enhanced`, `Beta`), a `Feature` cell and a `What it adds` cell.
4. The table is **grouped** into Integrations, UI/UX, Metadata + Library, Activity/Stats — visually separated by four `###` sub-headings, one per group (see §4.1 and §5.4).
5. Every entry in the table is a feature that **exists in the codebase** (i.e., spec files in `docs/` reference it, or it's a recognisable pattern from `package.json` / `git log`).
6. No upstream README element was removed (build/contributors/license intact, badges intact, screenshot intact).
7. The Playnite link resolves to `https://www.playnite.app/`.
8. The new section adheres to the chosen tone — Technical + neutral — no marketing fluff ("best", "amazing", "revolutionary").
9. Markdown renders cleanly on GitHub:
   - blockquote collapses to a single visual block,
   - table aligns correctly,
   - inline backticks render as status pills,
   - link is clickable.
10. No other files are touched (this is README-only).

---

## 8. Related Files

| File                       | Change                                    |
| -------------------------- | ----------------------------------------- |
| `README.md`                | Append the new section.                   |
| `docs/readme-fork-spec.md` | This spec (created by the planning step). |

No new dependencies, no package scripts, no entry points, no behaviour changes anywhere else.

---

## 9. Implementation Order

1. Open `README.md`.
2. Insert the new section after the `## Features` block.
3. Confirm the table renders correctly by running `prettier --check README.md` (project already uses Prettier — `prettier --write` to format).
4. Manually verify on GitHub's renderer (or a Markdown previewer) that:
   - the blockquote renders as one block,
   - the table is well aligned,
   - the Playnite link is clickable.
5. Commit as a single change.

---

## 10. Notes from the Interview Rounds (for context)

- **Round 1** nailed heading, tone, placement, note style.
- **Round 2** expanded the scope: full detailed list (~25+), two-column table format, four scope groups, status notes per feature.
- **Round 3** finalised phrasing: simple "vibe-coded with AI assistance" line, Playnite with link, "more features will come" as a trailing sentence inside the blockquote, upstream badges preserved.

These decisions are locked. Any later changes (re-tabling, re-grouping, re-phrasing) belong to a follow-up spec, not this one.

### 10.1 Polished surface vs inventory divergence

The `README.md` rows are a **polished** public-facing summary; the §4.3 group tables in this spec are a **per-feature inventory** with richer detail. They are allowed to differ in wording as long as the substantive truth matches.

(§4.1, §4.3 intro and §5.4 were also rewritten in the spec to align with the realised four-sub-table structure — those are spec-internal cleanups, not polished-vs-inventory divergence. §10.1 only tracks polish passes where README wording legitimately diverges from §4.3 inventory text.)

One polish pass happened during application: the README's **B8 (Hero actions) row** was tightened against `docs/game-page-refactor-spec.md` §3.2 — the actions "consolidate into the new Play/Status dashboard card" rather than being "normalised across surfaces". README reflects the accurate phrasing.
