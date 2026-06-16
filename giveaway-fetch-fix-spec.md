# Giveaway Data Fetching Fix

## Problem Statement

The deals tab's "IsThereAnyDeal" giveaway panel always displays **"No giveaways available right now."** even when active giveaways exist on the ITAD website. The data fetching fails silently and falls back to an empty array.

## Current Behavior

1. User navigates to Deals tab → IsThereAnyDeal sub-tab
2. Panel shows "Loading giveaways..." spinner briefly
3. Panel displays "No giveaways available right now." with a "Refresh" button
4. Clicking "Refresh" does not help — result is always the same

**Expected Behavior:** The panel should display active giveaways from ITAD.

## Root Cause Analysis

The `itad-giveaway-service.ts` fetches giveaways via a two-step process:

### Step 1: Session Token Acquisition (`getSessionToken()`)

```
1. Makes a GET request to https://isthereanydeal.com/giveaways/
2. Reads the "sess2" cookie from Electron's session store
3. Returns the cookie value as the session token
```

**Problem:** The `sess2` cookie is only set when the user is authenticated with ITAD. Since the user is not logged into ITAD (they have no ITAD account or are not signed in), the cookie is never set. The function silently resolves with an empty string `""` and logs a warning.

### Step 2: API Fetch (`fetchGiveawaysRaw()`)

```
1. Makes a POST request to https://isthereanydeal.com/giveaways/api/list/?tab=live
2. Includes header: itad-sessiontoken: <empty string>
3. Parses JSON response
```

**Problem:** Without a valid session token, the API either:

- Returns an empty `data` array
- Returns an error response that fails to parse as JSON (caught by the catch block, resolves `null`)

### Step 3: Fallback in `getGiveaways()`

```typescript
if (!rawData) {
  return cachedGiveaways ?? []; // Returns empty array
}
```

**Result:** Empty array → UI shows "No giveaways available right now."

## Key Files

| File                                                              | Role                                                    |
| ----------------------------------------------------------------- | ------------------------------------------------------- |
| `src/main/services/itad-giveaway-service.ts`                      | Backend service that fetches giveaways from ITAD API    |
| `src/main/events/itad-giveaways.ts`                               | IPC event handler that bridges renderer ↔ main process |
| `src/renderer/src/pages/deals/isthereanydeal/giveaway-panel.tsx`  | React component that displays giveaways                 |
| `src/renderer/src/pages/deals/isthereanydeal/giveaway-panel.scss` | Styling for giveaway panel                              |
| `src/renderer/src/pages/deals/deal-sources.tsx`                   | Deal source configuration (registers giveaway panel)    |
| `src/locales/en/translation.json`                                 | Translation strings (lines 1718-1729)                   |
| `src/preload/index.ts`                                            | IPC bridge definition (line 1333-1334)                  |
| `src/renderer/src/declaration.d.ts`                               | TypeScript type declarations (line 1008-1009)           |

## Interview Findings

- **Frequency:** The panel always shows empty — it has never successfully displayed giveaways
- **ITAD website:** Active giveaways ARE visible at https://isthereanydeal.com/giveaways/
- **User auth:** User is logged into Hydra Cloud but NOT logged into IsThereAnyDeal
- **Root cause confirmation:** The session token mechanism fails because the user is not authenticated with ITAD

## Proposed Fix

### 1. Fix the Fetching to Work Without ITAD Authentication

**Goal:** Make the giveaway API return data without requiring a `sess2` cookie.

**Approach A — Test if API works without auth:**

- First, test whether the ITAD giveaway API endpoint returns data without a session token
- If the API works with an empty token, the fix is simply to handle the empty token gracefully
- Remove or relax the session token requirement

**Approach B — Proper session acquisition:**

- If the API truly requires a session token, visit the ITAD giveaways page first to establish a session (even without login)
- The `sess2` cookie should be set by ITAD for any visitor, not just authenticated users
- Verify that `net.request` properly follows redirects and processes Set-Cookie headers

**Approach C — Use a different API endpoint:**

- Research whether ITAD has a public API endpoint that doesn't require authentication
- Consider using the ITAD API v2 (https://api.isthereanydeal.com) with a public API key if available

### 2. Add Auto-Retry Logic

- Implement 2-3 automatic retries on failure before showing error state
- Add exponential backoff between retries (e.g., 1s, 2s, 4s)
- Log each retry attempt for debugging

### 3. Improve Error Handling and UI

**Error State:**

- Show a clear error message with a Retry button
- Include a link to visit ITAD giveaways directly in browser
- Example: "Failed to load giveaways. [Retry] — or [View on IsThereAnyDeal ↗]"

**Empty State:**

- Treat "no giveaways" and "failed to fetch" the same — generic empty state
- Show "No giveaways available right now." with a link to ITAD giveaways

**Refresh Behavior:**

- Keep the existing 15-minute cache TTL
- Allow the "Refresh" button to bypass the cache and force a fresh fetch
- Add a `forceRefresh` parameter to `getGiveaways()` that clears the cache before fetching

### 4. Improve Logging and Diagnostics

- Add more detailed logging for each step of the fetch process
- Log the HTTP response status code explicitly (currently logged but not acted upon)
- Log the session token status (present/absent) for debugging
- Consider logging the raw API response body when parsing fails

## Detailed Changes

### `src/main/services/itad-giveaway-service.ts`

1. **`getSessionToken()`**:
   - Log whether a session token was obtained
   - If token is empty, log a clear warning about potential auth issues
   - Consider whether the session token is actually required

2. **`fetchGiveawaysRaw()`**:
   - Add explicit HTTP status code checking (reject on 4xx/5xx)
   - Handle the case where the API returns a valid JSON response with error data
   - Add request timeout handling

3. **`getGiveaways()`**:
   - Add a `forceRefresh` parameter
   - Add retry logic (up to 3 attempts) with exponential backoff
   - Distinguish between "no data" and "fetch error" in the return value

4. **New type for return value:**
   ```typescript
   interface GiveawayResult {
     giveaways: Giveaway[];
     fromCache: boolean;
     error: string | null;
   }
   ```

### `src/main/events/itad-giveaways.ts`

1. Accept optional `forceRefresh` parameter in the IPC handler
2. Pass it through to `getGiveaways()`
3. Return the full result object (with error info) instead of just the array

### `src/preload/index.ts`

1. Update `getItadGiveaways` to accept an optional `forceRefresh` parameter
2. Update the type signature

### `src/renderer/src/declaration.d.ts`

1. Update `getItadGiveaways` type to accept `forceRefresh` parameter
2. Update return type to include error information

### `src/renderer/src/pages/deals/isthereanydeal/giveaway-panel.tsx`

1. Add retry logic with auto-retry counter (max 3 attempts)
2. Improve error state UI to include Retry button and ITAD link
3. Pass `forceRefresh: true` to bypass cache on manual refresh
4. Handle loading, error, and empty states with clear messaging
5. Add retry animation/feedback when auto-retry is in progress

### `src/locales/en/translation.json`

Add new translation keys:

- `retrying_giveaways`: "Retrying... (attempt {{attempt}}/{{max}})"
- `giveaways_error_hint`: "Could not connect to IsThereAnyDeal. Check your internet connection and try again."

## UI Mockup

```
┌─────────────────────────────────────────┐
│  Giveaways                    [↻ Refresh]│
├─────────────────────────────────────────┤
│                                         │
│  ❌ Failed to load giveaways            │
│                                         │
│  [↻ Retry]  [View on IsThereAnyDeal ↗] │
│                                         │
│                                         │
│     View all on IsThereAnyDeal ↗        │
└─────────────────────────────────────────┘
```

## Edge Cases

1. **No internet connection:** Show error with retry button
2. **ITAD API rate limiting:** Handle 429 responses with appropriate backoff
3. **ITAD API downtime:** Show error with ITAD link so users can check status
4. **Session token expired mid-session:** Force re-fetch of session token
5. **Cache stale but fetch also fails:** Return cached data with a warning
6. **All retries exhausted:** Show final error state with retry button

## Testing Plan

1. **Manual testing:**
   - Launch app with no ITAD account → verify error state or empty state appears
   - Check DevTools console for [ITAD] log messages
   - Click Retry button → verify fetch is attempted again
   - Click Refresh button → verify cache is bypassed
   - Disconnect internet → verify error handling works

2. **Automated testing:**
   - Add unit tests for `getSessionToken()` with various cookie states
   - Add unit tests for `fetchGiveawaysRaw()` with mock HTTP responses
   - Add unit tests for retry logic
   - Test `getGiveaways()` with forceRefresh parameter

## Priority

**High** — The giveaway feature is completely broken for users not logged into ITAD, which is likely the majority of users.
