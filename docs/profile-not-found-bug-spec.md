# Profile "User Not Found" Bug — Fix Spec

## Problem Summary

**Symptom:** Clicking ANY user profile (including the user's own profile from the sidebar, or any friend from the friends window) shows a "User not found" toast and navigates back. This started after the layout redesign changes (TabBar + Store page + router modifications).

**Scope:** ALL profile navigations are broken — sidebar profile click, friends window friend click, all-friends-modal, reviewer names on game pages, etc.

**Not broken:** Store, Library, Activity, Watchlist, and all other pages work correctly.

## Current Flow (The Bug)

1. User navigates to `/profile/:userId` (via sidebar, friends window IPC, review click, etc.)
2. React Router matches `/profile/:userId` route → renders `<Profile />`
3. `<Profile />` extracts `userId` from `useParams()`, passes to `<UserProfileContextProvider userId={userId!}>`
4. `UserProfileContextProvider` mounts → `useEffect` fires → calls `getUserProfile()`
5. `getUserProfile()` fires API call: `GET /users/${userId}?shop=launchbox&shop=steam&...`
6. API call **fails** (reason unknown — could be 404, network error, auth issue, or malformed URL)
7. `.catch()` handler fires:
   ```ts
   .catch(() => {
     showErrorToast(t("user_not_found"));
     navigate(-1);
   });
   ```
8. User sees "User not found" toast, then navigates back to previous page

**Visual:** The page briefly shows a blank/white area (content area is null because `userProfile` is null) before the toast appears.

## Root Cause Analysis

The `.catch()` handler in `src/renderer/src/context/user-profile/user-profile.context.tsx` (line ~242) is **too broad** — it catches ALL errors and always shows "User not found", even if the real error is:

- Network connectivity issue
- Auth token expired
- Server error (500)
- Malformed URL (wrong userId)
- CORS or other browser-level errors

Additionally, there is **no error logging** in the catch block, making it impossible to diagnose WHY the API call fails without DevTools access.

The `navigate(-1)` fallback can also be confusing — if the user was on another profile page, going back one step shows the previous (potentially different) profile rather than a sensible default like the Store.

## Investigation Steps (Before Fixing)

Since the user can't access DevTools, we need to add diagnostic logging first:

1. **Log the `userId` value** in the `getUserProfile` function before the API call
2. **Log the actual API error** in the catch block (status code, message, response data)
3. **Check what URL is constructed** for the API call

These logs will reveal whether:

- `userId` is undefined/null → the route params aren't being extracted correctly
- `userId` contains unexpected characters → URL encoding issue
- The API returns a specific HTTP status → tells us the real problem
- There's a JavaScript error before the API call → code bug

## Proposed Fix

### File: `src/renderer/src/context/user-profile/user-profile.context.tsx`

#### Fix 1: Add error logging and differentiate error types

Replace the broad `.catch()` with proper error handling:

```tsx
.catch((error: unknown) => {
  // Log the error for debugging
  logger.error(
    "Failed to fetch user profile",
    { userId, error }
  );

  // Check if it's an Axios error with a status code
  if (error instanceof AxiosError) {
    const status = error.response?.status;

    if (status === 404) {
      showErrorToast(t("user_not_found"));
    } else if (status === 401 || status === 403) {
      showErrorToast(t("profile_access_denied"));
    } else {
      showErrorToast(t("profile_load_error"));
    }
  } else {
    showErrorToast(t("profile_load_error"));
  }

  // Navigate to store instead of going back (more predictable UX)
  navigate("/store");
});
```

#### Fix 2: Add AxiosError import

Add `import { AxiosError } from "axios";` at the top of the file.

#### Fix 3: Add logger import

Add `import { logger } from "@renderer/logger";` at the top of the file.

### File: `src/locales/en/translation.json`

Add new translation keys in the `user_profile` namespace:

```json
"profile_access_denied": "You don't have permission to view this profile",
"profile_load_error": "Failed to load profile. Please try again."
```

## Files Affected

| File                                                             | Change                             |
| ---------------------------------------------------------------- | ---------------------------------- |
| `src/renderer/src/context/user-profile/user-profile.context.tsx` | Replace catch handler, add imports |
| `src/locales/en/translation.json`                                | Add 2 new translation keys         |

## Validation

1. **Typecheck**: `yarn typecheck:web` — must pass with zero errors
2. **Manual test**: Click own profile from sidebar → should load correctly (now with logging to diagnose if it still fails)
3. **Manual test**: Click a friend from friends window → should load correctly
4. **Check console**: Verify diagnostic logs appear when a profile load fails

## Edge Cases

- **What if `AxiosError` is not available?** The `axios` package is already a dependency (used in `hydra-api.ts`). The import will work.
- **What if `logger` is not exported from `@renderer/logger`?** Confirm by checking `src/renderer/src/logger/index.ts` — if `logger` is the default export, use `import logger from "@renderer/logger"` instead.
- **What about non-English locales?** Only `en/translation.json` is updated for now. The `defaultValue` fallback on `t()` calls will work for other languages.
- **What if the API was already called with a correct userId and the server genuinely returned 404?** The improved error message will still say "User not found" for 404, but now we have logs to confirm it's actually a 404.
