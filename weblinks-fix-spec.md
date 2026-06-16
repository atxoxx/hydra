# WebLinks Panel Bug Fixes — Specification

## Overview

Fix multiple interconnected issues in the **website-links panel** (`website-links-iframe.tsx`) that cause broken pages, non-working video playback, and random page reloads. The fixes span the renderer component and the main process session configuration.

---

## Root Causes Identified

### 1. `sandbox=yes` Webview Preference Blocks Media & Sub-resources

**Location**: `src/renderer/src/pages/game-details/website-links-panel/website-links-iframe.tsx`, line 358
**Current**: `webpreferences="sandbox=yes, contextIsolation=yes"`

In Electron, `sandbox=yes` for a `<webview>` tag runs the webview's renderer process in OS-level sandbox mode. This:
- **Disables GPU process access** → no hardware-accelerated video decoding (YouTube/Twitch videos spin forever)
- **Restricts certain Web APIs** → interactive elements, `navigator.mediaDevices`, and other JS-heavy features fail silently
- **Limits sub-resource fetching** → images and third-party scripts from CDNs may fail to load

The main window already has `sandbox: false` (line 60 of `window-manager.ts`), and the `--no-sandbox` flag is appended on Linux (line 35 of `index.ts`). The webview does **not need** its own sandbox since it already runs in a fully isolated renderer process.

**Fix**: Change `webpreferences` to `"contextIsolation=yes"` (remove `sandbox=yes`).

**Impact**: Fixes YouTube video playback (spinning forever), Twitch page not loading properly, NexusMods interactive elements not working, and images not loading.

---

### 2. `onNewWindow` Handler Redirects Current Webview

**Location**: `src/renderer/src/pages/game-details/website-links-panel/website-links-iframe.tsx`, lines 188-194
**Current behavior**: When a page tries to open a popup/new-window (ads, authentication flows, social sharing), the handler catches the event, prevents default, but then loads the popup URL **in the current webview**:
```ts
const onNewWindow = (e: any) => {
  e.preventDefault();
  try {
    webview.loadURL(e.url);  // <-- THIS redirects the current view
  } catch {
    window.electron.openExternal(e.url);
  }
};
```

This is the **primary cause of "random reloads"** while viewing a tab. Sites like Twitch (clip sharing popups), YouTube (embedded player popups), and NexusMods (auth dialogs, ad popups) all trigger `new-window` events. The current handler redirects the user away from the content they were viewing.

**Fix**: Always open popup URLs in the external browser, never load them in the webview:
```ts
const onNewWindow = (e: any) => {
  e.preventDefault();
  window.electron.openExternal(e.url);
};
```

**Impact**: Eliminates "random reloads" while viewing a tab.

---

### 3. Missing Origin/Referer Headers for Sub-resource Requests

**Location**: `src/main/services/window-manager.ts`, lines 270-329 (preview session `onBeforeSendHeaders`)
**Current behavior**: The preview session only sets `Origin` and `Referer` headers when the **request URL itself** matches a known hostname list (e.g., `hostname.endsWith("twitch.tv")`). However, when a page like Twitch loads sub-resources (images from `static-cdn.jtvnw.net`, scripts from `cdn.twitch.tv`, API calls to `gql.twitch.tv`), those sub-resource requests do not match the known hostname list. They go out **without proper Origin/Referer headers**, and CDNs/APIs block them.

This is why:
- **Images don't load**: CDN image hosts reject requests without proper referrer
- **Interactive elements broken**: API calls fail silently due to missing Origin headers
- **Embedded content blocked**: Third-party widgets (Twitch chat, ModDB embeds) fail to initialize

**Fix**: Instead of checking the **request URL** hostname, check the **referrer** (the page that initiated the request) to determine which Origin/Referer to spoof:
```ts
previewSession.webRequest.onBeforeSendHeaders((details, callback) => {
  const requestHeaders = { ...details.requestHeaders };
  requestHeaders["user-agent"] = stableIframeUA;

  // Determine the top-level site from the Referer of the request
  const referer = details.referrer || requestHeaders["Referer"] || "";
  try {
    const refererUrl = new URL(referer);
    const topHost = refererUrl.hostname;
    const origin = refererUrl.origin;

    if (origin.startsWith("http")) {
      requestHeaders["Origin"] = origin;
      requestHeaders["Referer"] = referer;  // Keep original referer chain
    }
  } catch {
    // Fallback: try to derive from the request URL's referrer
    try {
      const reqUrl = new URL(details.url);
      requestHeaders["Origin"] = reqUrl.origin;
      requestHeaders["Referer"] = reqUrl.origin + "/";
    } catch {
      /* ignore */
    }
  }

  callback({ requestHeaders });
});
```

**Impact**: Fixes images not loading, interactive elements broken, and embedded content blocked across all sites.

---

### 4. 30-Second Timeout Too Aggressive for Heavy Sites

**Location**: `src/renderer/src/pages/game-details/website-links-panel/website-links-iframe.tsx`, lines 122-131
**Current behavior**: A 30-second timeout is set when a new URL is loaded. If `dom-ready` doesn't fire within 30 seconds, the error state is shown. Sites like NexusMods (heavy JS bundles, multiple API calls) and Twitch (real-time websocket, chat, player initialization) can take >30 seconds on slower connections.

**Fix**: 
- Increase timeout to **60 seconds**
- Reset the timeout whenever `did-start-loading` fires (to handle progressive page loads)
- Don't set the timer until `did-start-loading` fires (not immediately on URL assignment)
- Clear timer on `dom-ready`, `did-stop-loading`, `did-fail-load`, and `did-navigate`

**Impact**: Reduces false error states for slow-loading sites.

---

### 5. `did-fail-load` Handler Too Broad — Shows Error for Transient Failures

**Location**: `src/renderer/src/pages/game-details/website-links-panel/website-links-iframe.tsx`, lines 179-186
**Current behavior**: Any `did-fail-load` with an error code other than -3 (ERR_ABORTED) immediately shows the error UI. This includes transient errors like:
- -21 (ERR_NETWORK_CHANGED)
- -105/-137 (ERR_NAME_NOT_RESOLVED)
- -106 (ERR_INTERNET_DISCONNECTED)
- -7 (ERR_TIMED_OUT)

These should be handled more gracefully.

**Fix**: 
- Only show error UI for fatal/permanent error codes: -2 (ERR_FAILED), -6 (ERR_FILE_NOT_FOUND), -10 (ERR_ACCESS_DENIED)
- For network-related errors (-7, -21, -105, -106, -137), retry once after 3 seconds before showing error
- For code -3 (ERR_ABORTED), keep current behavior (ignore)
- Track retry count per-URL to avoid infinite retry loops

**Impact**: Pages that have transient network hiccups recover without showing error UI.

---

### 6. No `will-navigate` Handler — Client-side Redirects Cause Silent Navigation

**Location**: Missing from `website-links-iframe.tsx`
**Current behavior**: The webview has no `will-navigate` event listener. If a site triggers a client-side redirect (e.g., Steam age gate redirect, geo-redirect, authentication flow), the navigation happens silently without updating the address bar or navigation state. This can look like the page "breaking" because the URL shown doesn't match the content.

**Fix**: Add a `will-navigate` handler that updates the address bar and navigation state:
```ts
const onWillNavigate = (e: any) => {
  setCurrentUrl(e.url);
  setInputValue(e.url);
};
webview.addEventListener("will-navigate", onWillNavigate);
```

**Impact**: Address bar stays in sync with actual page content; redirects don't look like page breaks.

---

### 7. All 12 Sites Set as `isEmbeddable: true` — No Graceful Degradation

**Location**: `src/renderer/src/services/website-links.service.ts`, lines 44-56
**Current behavior**: All 12 websites have `isEmbeddable: true` set. When sites are known to be problematic in webviews (Steam Store with its age gate and JS-heavy storefront, GameFAQs search-only pages), the fallback error screen only shows after the 30-second timeout.

**Fix**: Review and update `isEmbeddable` flags:
- `steam`: change to `false` (storefront has age gates, heavy JS, blocks embedded login)
- `gamefaqs`: change to `false` (search-only URL rarely resolves to a useful embed)
- `metacritic`: change to `false` (heavy JS, often blocks iframe rendering)

When `isEmbeddable: false`, the component should immediately show the fallback screen with the "Open in Browser" button, rather than attempting to load and eventually timing out.

**Impact**: Faster fallback for known-problematic sites, less frustration.

---

## Implementation Plan

### Phase 1: Renderer Component Fixes (`website-links-iframe.tsx`)

| # | Change | Priority |
|---|--------|----------|
| 1 | Remove `sandbox=yes` from `webpreferences` | **Critical** |
| 2 | Fix `onNewWindow` to always open externally | **Critical** |
| 3 | Increase timeout to 60s and reset on `did-start-loading` | High |
| 4 | Add selective error code handling for `did-fail-load` | High |
| 5 | Add `will-navigate` handler for address bar sync | Medium |
| 6 | Show immediate fallback when `isEmbeddable: false` | Medium |

### Phase 2: Main Process Fixes (`window-manager.ts`)

| # | Change | Priority |
|---|--------|----------|
| 7 | Fix `onBeforeSendHeaders` to use referrer for Origin/Referer spoofing | **Critical** |

### Phase 3: Service Fixes (`website-links.service.ts`)

| # | Change | Priority |
|---|--------|----------|
| 8 | Update `isEmbeddable` flags for Steam, GameFAQs, Metacritic | Medium |

---

## Files to Modify

1. `src/renderer/src/pages/game-details/website-links-panel/website-links-iframe.tsx` — Primary fix target
2. `src/main/services/window-manager.ts` — Preview session header handling
3. `src/renderer/src/services/website-links.service.ts` — `isEmbeddable` flags

---

## Testing Checklist

- [ ] YouTube tab: videos play (not just spin forever)
- [ ] Twitch tab: page loads fully with images, interactive elements
- [ ] NexusMods tab: page loads with images, mod list is interactable
- [ ] No random reloads while viewing any tab for 2+ minutes
- [ ] Clicking popup-triggering elements opens external browser (not redirects webview)
- [ ] Address bar updates correctly during page navigation
- [ ] Steam tab shows immediate fallback (or loads properly after sandbox fix)
- [ ] GameFAQs tab shows immediate fallback with "Open in Browser"
- [ ] Metacritic tab shows immediate fallback with "Open in Browser"
- [ ] Switching tabs preserves last-visited URL within each site
- [ ] Slow sites (>30s) don't show error UI prematurely
- [ ] Transient network errors don't trigger error UI
- [ ] All 12 tabs are accessible and don't crash the renderer

---

## Out of Scope

- Big Picture mode support for website previews
- Custom per-game URL overrides
- DRM-protected video playback (Widevine is not supported in webview)
- Login/session persistence within webview for sites requiring auth
- Downloading content from embedded sites
- CAPTCHA handling for sites that detect automated browsers

---

## Key Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Site triggers `window.open()` | Popup URL opens in external browser; webview stays on current page |
| Site does client-side redirect | `will-navigate` fires; address bar updates; no error state |
| Network drops briefly | `did-fail-load` with network code → retry once after 3s |
| Page takes >60s to load | `did-stop-loading` eventually fires OR timeout shows fallback |
| Site returns HTTP 404/500 | `did-fail-load` with fatal code → show fallback UI |
| User rapidly switches tabs | Previous webview unloads cleanly; new webview starts fresh |
| Site has CSP that blocks sub-resources | Preview session strips CSP → sub-resources load (enhanced by referrer fix) |
| Game title contains special characters | URL encoding handled by `buildWebsiteLinks` (already works) |
