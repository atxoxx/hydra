<div align="center">

[<img src="https://raw.githubusercontent.com/hydralauncher/hydra/refs/heads/main/resources/icon.png" width="144"/>](https://help.hydralauncher.gg)

  <h1 align="center">Hydra Launcher</h1>

  <p align="center">
    <strong>Hydra Launcher is an open-source gaming platform created to be the single tool that you need in order to manage your gaming library. Hydra is written in Node.js (Electron, React, Typescript), Python, and Rust.</strong>
  </p>

[![build](https://img.shields.io/github/actions/workflow/status/hydralauncher/hydra/build.yml)](https://github.com/hydralauncher/hydra/actions)
[![release](https://img.shields.io/github/package-json/v/hydralauncher/hydra)](https://github.com/hydralauncher/hydra/releases)
[![chocolatey](https://img.shields.io/chocolatey/v/hydralauncher.svg)](https://community.chocolatey.org/packages/hydralauncher)

![Hydra Launcher Home Page](./docs/screenshot.png)

</div>

## Features

- Add games that you own to your library
- Have a nice profile that shows what you are playing to your friends
- Save your game progress in the cloud with Hydra Cloud
- Unlock achievements
- Navigate through a rich catalogue with a powerful suggestion algorithm
- Discover new games that you haven't played before

## Fork — what's new & different

> This is a **personal fork** built for my own use, heavily inspired by
> [Playnite](https://www.playnite.app/) and its rich plugin ecosystem. It is a
> **vibe-coded with AI assistance** project — more features will come.

### New integrations & services

| Status     | Feature                             | What it adds                                                                                                                                                      |
| ---------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `New`      | Deals page (ITAD + Xbox GamePass)   | Sub-tabbed page hosting IsThereAnyDeal deal monitoring and the Xbox GamePass PC catalog with region selection, 15-min / 1-hour caches and direct Xbox app launch. |
| `New`      | IsThereAnyDeal giveaways panel      | Surfaces live giveaways for un-authenticated users too; fixed the silent empty-state with retry and an explicit refresh button.                                   |
| `Enhanced` | HowLongToBeat card                  | Multi-provider fan-out across HLTB, Backlogged and IGDB/Steam stats with an Edit picker that persists `{provider, externalId}` on the game record.                |
| `Refactor` | Steam Reviews sub-tab               | In-page sub-tab on the game details page modeled on the Playnite ReviewViewer plugin — sort tabs, filters, per-review metadata and cursor-based infinite scroll.  |
| `New`      | Steam Stats panel                   | A live player-count badge on the hero banner (Steam Web API + SteamSpy peak + SteamCharts trend) and a sidebar Steam rating / review breakdown section.           |
| `New`      | Multi-store OAuth library import    | OAuth-based sign-in for Steam, Epic, GOG, Amazon, Xbox, Battle.net, Ubisoft, Rockstar, itch.io and Humble; imports owned libraries into Hydra.                    |
| `New`      | Steam Family Share import           | Parses local Steam config to discover family members and imports their libraries as separate entries with an owner badge.                                         |
| `Refactor` | Multi-platform file system scanning | `platform-scanner.ts` extended for Epic, GOG, Battle.net, Amazon, Ubisoft, Xbox, Rockstar, itch.io and Humble install-path discovery on top of the Steam scanner. |

### UI / UX improvements

| Status     | Feature                 | What it adds                                                                                                                                                                                                                 |
| ---------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Refactor` | Layout redesign         | Strips navigation from the sidebar and adds a top TabBar (Store · Library · Watchlist · Activity) with right-side icon buttons for Downloads, Settings, Friends and Big Picture; a Downloads dropdown opens from the header. |
| `New`      | Sidebar filter menu     | Master/detail popover for Library set, Stores/Platform, Genre, Status and Sort; multi-select chips, AND-within-AND semantics, persisted to `localStorage`.                                                                   |
| `Enhanced` | Sidebar game item       | Two-level row with the title on top and a badges row underneath for playtime, achievements and a friends-who-own count with hover tooltip and modal.                                                                         |
| `New`      | "Play Next" suggestions | Collapsible sidebar section suggesting unplayed games and recently-played-but-stalled games prioritised by recency.                                                                                                          |
| `New`      | Friends ownership modal | Lists every friend who owns a given game with online/offline status; clicking a friend navigates to their profile.                                                                                                           |
| `New`      | Catalogue watchlist     | Per-game `must-play` / `want` / `later` priority with free-text notes, a dedicated `/watchlist` page and a catalogue filter chip.                                                                                            |
| `Refactor` | Game page tabs          | The hero is now a backdrop; Overview (dashboard cards + similar games), Details (review / activity / meta) and Web Links live on dedicated tabs with collapsible sidebar sections.                                           |
| `Enhanced` | Hero actions            | Moves the hero panel into a consolidated Play/Status card on the Overview tab with unified download-progress display shared with the library card.                                                                           |
| `Refactor` | Profile loading UX      | Differentiated toasts for 404 vs 401/403 vs generic errors, diagnostic logging and a deterministic fallback to `/store` instead of `navigate(-1)`.                                                                           |

### Metadata + library tools

| Status     | Feature                      | What it adds                                                                                                                                                                                                                                                                        |
| ---------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Enhanced` | Metadata enhancement         | Multi-source metadata merge (Hydra API → Steam → SteamGridDB → PCGamingWiki → IGN → VNDB) with per-field source attribution.                                                                                                                                                        |
| `Refactor` | Metadata panel (sub-tabs)    | Game Options → Metadata panel splits into **General** (editable fields + status + Download Metadata) and **Media** (multi-source image search); saves via explicit Save button with toast.                                                                                          |
| `New`      | Game status management       | Playnite-style status enum (Not Played, Playing, On Hold, Played, Beaten, Completed, Abandoned, Plan to Play); colour-coded dropdown on the Stats card and the metadata panel.                                                                                                      |
| `New`      | Chip input + tag suggestions | Reusable auto-suggesting chip component used for genres, developers, publishers and tags — feeds from library-wide values.                                                                                                                                                          |
| `Enhanced` | Selective metadata merge     | The Download Metadata modal lists per-field checkboxes (Select All / Deselect All) and only fills the checked fields into the form.                                                                                                                                                 |
| `New`      | Asset search (Google Images) | Inside the Media sub-tab a left panel auto-runs a Google Images query per asset type (icon / logo / hero); users preview and apply; results are filtered by aspect ratio.                                                                                                           |
| `New`      | SteamGridDB integration      | Image and grid search via `steamgriddb-api.ts`; respects a user-supplied SteamGridDB API key under Settings → Integrations → Metadata Sources.                                                                                                                                      |
| `Enhanced` | Store / library tab rework   | PC category replaces its dropdown with a horizontal tab bar (`All PC · Local · Steam · Epic · GOG · …`) plus an `All / Installed / Not installed` segmented control; library cards dim uninstalled covers.                                                                          |
| `Refactor` | Website links panel          | Twelve gaming sites (Steam Store, SteamDB, ProtonDB, PCGamingWiki, Twitch, NexusMods, ModDB, GameFAQs, Metacritic, HowLongToBeat, IGDB, YouTube) with per-game last-active-tab persistence; removed `sandbox=yes`, sane `onNewWindow`, 60 s timeout, referer-aware header spoofing. |
| `New`      | Catalogue env-var hardening  | Centralised env-config module with production fallbacks (Hydra API, auth, WS, checkout, external resources) and a `.env.example` — the catalogue works in a fresh `yarn build:win` without crashing.                                                                                |

### Activity / stats

| Status     | Feature                          | What it adds                                                                                                                                                                                                        |
| ---------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `New`      | Activity page                    | Full-screen app-level Activity view: 7 d / 30 d / 90 d / All Time range tabs, summary cards, top-10 played, genre donut, weekly heatmap, monthly trend, recent timeline, friends comparison and per-game expansion. |
| `New`      | Daily playtime snapshots         | New `dailyPlaytime` LevelDB sublevel tracks per-day totals; surfaced as the Activity heatmap and the in-game activity chart.                                                                                        |
| `Refactor` | Game activity panel              | Nivo-powered chart with bar labels, sparklines with hover tooltips (FPS / CPU / GPU / RAM / temp), taller chart height when the sidebar is hidden.                                                                  |
| `New`      | Session tracking                 | A new `sessions` LevelDB sublevel records per-session start/end; the renderer shows a Recent Sessions timeline on the app Activity page and per-game session history.                                               |
| `New`      | Hardware monitoring              | The Rust `hydra-native` addon collects FPS, CPU usage, CPU temp, GPU usage, GPU temp and RAM usage during gameplay at a configurable polling interval (default 5 s) when enabled.                                   |
| `Enhanced` | HowLongToBeat progress bars      | Per-category slim progress bars under each HLTB time, driven by the user's `playTimeInMilliseconds` against `durationSeconds`.                                                                                      |
| `Beta`     | Performance alerts               | Optional toast notifications during gameplay when FPS, CPU temp, GPU temp, CPU usage or RAM usage cross user-defined thresholds; sparkline warnings show on the session list.                                       |
| `New`      | Steam rating chip on the sidebar | Slim Steam rating card on the game details sidebar — descriptor, percent and a % bar inline; clicking jumps to the Steam Reviews sub-tab.                                                                           |

## Build from source and contributing

Please, refer to our Documentation pages: [docs.hydralauncher.gg](https://docs.hydralauncher.gg/getting-started)

### Local development requirements

- Node.js + Yarn
- Python 3.9+ with `pip install -r requirements.txt`
- Rust toolchain (for `hydra-native`)

After installing dependencies, `postinstall` now builds the Rust native addon automatically (`hydra-native/hydra-native.node`).

Packaging scripts (`yarn build:win`, `yarn build:mac`, `yarn build:linux`, `yarn build:unpack`) now run `yarn build:python-rpc` automatically.

## Contributors

<a href="https://github.com/hydralauncher/hydra/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=hydralauncher/hydra" />
</a>

## License

Hydra is licensed under the [MIT License](LICENSE).
