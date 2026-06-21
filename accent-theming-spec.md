# Accent Theming — Feature Specification

## Overview

Add user-configurable accent color theming to Hydra Launcher. The user can choose an accent color that replaces the hardcoded `#4a9eff` blue used throughout the main renderer and Big Picture mode. Includes a color picker with presets and custom input, integrated into the existing Settings > General > Appearance section.

---

## User Story

As a Hydra user, I want to personalize the app's accent color so that the interface feels more like my own and matches my aesthetic preferences.

---

## Key Design Decisions (from interview)

| Decision | Choice |
|---|---|
| **Placement** | Inside the Appearance section on Settings > General (alongside theme management) |
| **Scope** | All usages of `--accent` and `--color-primary` CSS custom properties throughout the app |
| **Big Picture** | Same accent color applies in both main renderer and Big Picture mode |
| **Persistence** | Local only, stored in `UserPreferences` in LevelDB (not synced via Hydra Cloud) |
| **Color picker UI** | Custom built-in picker (no external npm dependencies) |
| **Presets** | Yes — 10–14 predefined preset colors shown as a grid |
| **Theme relationship** | Custom theme wins — if an active custom theme defines `--accent`/`--color-primary`, those take priority. User accent is a fallback when no theme is active or the theme doesn't override accent variables |
| **Default accent** | Current Hydra blue (`#4a9eff`) — no change for existing users |
| **Application technique** | CSS custom property on `:root` (`--accent`, `--color-primary`, `--color-primary-rgb`) |
| **Input format** | Both hex (`#ff0000`) and RGB (`rgb(255, 0, 0)`) |
| **Shade variants** | Auto-generate `--accent-100` through `--accent-900` CSS variables |
| **Sidebar** | Add subtle background accent tint to sidebar |
| **Game launcher** | Dynamic per-game accent extraction wins — don't override |
| **Transition** | Smooth CSS transition (0.3s) when accent changes |
| **Title bar (Windows)** | Apply subtle accent tint to the title bar background |
| **Preset count** | 10–14 presets |

---

## Architecture

### Data Flow

```
User picks color in UI
  → Dispatch updateUserPreferences({ accentColor: "#ff0000" })
  → Main process writes to LevelDB (userPreferences key)
  → App.tsx useEffect picks up preference change
  → Call injectAccentColor(color) which sets CSS custom properties on :root
  → CSS transitions handle visual change (0.3s)
  → If Big Picture mode is open, also inject there
```

### Components Involved

1. **`src/types/level.types.ts`** — Add `accentColor?: string` to `UserPreferences`
2. **`src/renderer/src/helpers.ts`** — Add `injectAccentColor()` and `removeAccentColor()` functions
3. **`src/renderer/src/app.tsx`** — Read `accentColor` from preferences, call `injectAccentColor` on mount/change. Handle theme-vs-accent priority.
4. **`src/renderer/src/pages/settings/settings-context-general.tsx`** — Add `<AccentColorPicker>` component inside the Appearance section
5. **New: `src/renderer/src/components/accent-color-picker/`** — Custom color picker component
6. **`src/renderer/src/scss/globals.scss`** — Add `transition` for accent-related properties
7. **`src/renderer/src/app.scss`** — Apply accent to title-bar, add sidebar accent styles
8. **`src/big-picture/src/app.tsx`** — Same accent injection for Big Picture
9. **`src/locales/en/translation.json`** — Add i18n keys

---

## Detailed Specification

### 1. UserPreferences Schema Change

Add to `UserPreferences` interface in `src/types/level.types.ts`:

```typescript
/** User-selected accent color (hex string, e.g. "#4a9eff"). Falls back to #4a9eff. */
accentColor?: string | null;
```

- Stored as `null` or a valid hex string (e.g. `"#4a9eff"`)
- `null` / `undefined` means "use default" (Hydra blue)

### 2. Accent Injection Helper

Add to `src/renderer/src/helpers.ts`:

```typescript
const DEFAULT_ACCENT_COLOR = "#4a9eff";

export function injectAccentColor(hexColor: string | null | undefined) {
  const color = hexColor || DEFAULT_ACCENT_COLOR;
  const parsed = new Color(color);
  
  // Set core accent custom properties on :root
  const root = document.documentElement;
  root.style.setProperty("--accent", parsed.hex());
  root.style.setProperty("--color-primary", parsed.hex());
  root.style.setProperty("--color-primary-rgb", `${parsed.red()}, ${parsed.green()}, ${parsed.blue()}`);
  
  // Auto-generate shade variants (100–900)
  const hsl = parsed.hsl();
  for (let i = 1; i <= 9; i++) {
    const lightness = Math.min(95, Math.max(5, hsl.color[2] + (5 - i) * 8));
    const shade = parsed.lightness(lightness);
    root.style.setProperty(`--accent-${i}00`, shade.hex());
  }
}

export function removeAccentColor() {
  const root = document.documentElement;
  // Reset to defaults (handled by SCSS fallbacks)
  root.style.removeProperty("--accent");
  root.style.removeProperty("--color-primary");
  root.style.removeProperty("--color-primary-rgb");
  for (let i = 1; i <= 9; i++) {
    root.style.removeProperty(`--accent-${i}00`);
  }
}
```

### 3. Theme vs Accent Priority Logic

In `app.tsx`, when loading and applying themes:

```
1. Load active custom theme code → injectCustomCss(theme.code)
2. If active theme CSS sets --accent → theme's accent wins
3. If no active theme OR theme doesn't set --accent → use user's accentColor preference
4. If no accentColor preference → use DEFAULT_ACCENT_COLOR (#4a9eff)
```

Implementation approach: Apply user accent color FIRST (on `:root`), then inject custom theme CSS SECOND. Since the theme's `<style>` tag comes after the `:root` properties, its `--accent` overrides will naturally take precedence via CSS cascade when present.

**Important**: The `injectCustomCss` function injects theme CSS into `document.head`. Since the `:root` CSS custom properties are set directly on the element style (highest specificity), we need a different approach:

- Set user accent via a dedicated `<style id="user-accent">` tag
- Inject custom theme CSS via its own `<style id="custom-css">` tag
- Ensure `#custom-css` appears AFTER `#user-accent` in the DOM
- If a custom theme sets `--accent: some-color !important`, it will override the user accent
- If a custom theme doesn't set `--accent` or `--color-primary`, the user's accent from the earlier style tag applies

### 4. Accent Color Picker Component

New component: `src/renderer/src/components/accent-color-picker/accent-color-picker.tsx`

**Layout**: 
- Row/grid of 12 preset color circles (clickable)
- One "Custom" circle that opens a hex/RGB input
- Hex text input field below the presets
- RGB text input field below the presets
- Preview area showing how the accent looks on a sample button/link

**Preset Colors** (12 colors):
```
#4a9eff — Hydra Blue (default)
#ef4444 — Crimson Red
#f97316 — Amber Orange
#eab308 — Gold Yellow
#22c55e — Emerald Green
#14b8a6 — Teal
#8b5cf6 — Violet
#ec4899 — Rose Pink
#06b6d4 — Cyan
#6366f1 — Indigo
#78716c — Warm Gray
#f43f5e — Rose Red
```

**Behavior**:
- Clicking a preset circle immediately applies it
- The custom input field shows the currently selected color
- Typing a hex code (with `#` prefix) and pressing Enter/blur applies it
- Typing an RGB value like `rgb(255, 0, 0)` and pressing Enter/blur applies it
- Invalid colors show a validation error and don't apply
- The component receives `value` and `onChange` props

**Empty/default state**: The preset for Hydra Blue is shown as selected, custom input shows `#4a9eff`.

### 5. Integration into Settings

Modify `src/renderer/src/pages/settings/settings-context-general.tsx`:

- Add `accentColor` to the form state
- Initialize from `userPreferences.accentColor` (null = default)
- Add `<AccentColorPicker>` component inside the Appearance `<div>` section, below `<SettingsAppearance>`
- Wire up `onChange` to call `updateUserPreferences({ accentColor })` and `injectAccentColor(color)`

**Placement** in the settings UI:
```
Settings > General tab
  ├── App Basics (downloads path, language)
  ├── Startup Behavior (quit behavior, launch options)
  ├── [Linux only] Behavior (auto install)
  ├── Appearance  ← Section header
  │   ├── Accent Color Picker  ← NEW (above theme cards)
  │   └── Theme Cards
  └── Sidebar (badge toggles)
```

### 6. Accent Color in Styles

#### 6a. Add CSS transition

In `src/renderer/src/scss/globals.scss`, add:

```scss
:root {
  --accent: #4a9eff;
  --color-primary: #4a9eff;
  --color-primary-rgb: 74, 158, 255;
}
```

In `src/renderer/src/app.scss`:

```scss
// Smooth accent transitions
*, *::before, *::after {
  transition: 
    background-color 0.3s ease,
    border-color 0.3s ease,
    color 0.3s ease,
    box-shadow 0.3s ease,
    outline-color 0.3s ease;
}
```

**Note**: This broad transition may need refinement to avoid performance issues. Consider only transitioning properties that use accent colors, or using a class-based approach.

#### 6b. Title Bar Accent

When an accent color is set, apply a subtle tint to the Windows title bar:

```scss
.title-bar {
  // ... existing styles
  &--accented {
    background: linear-gradient(
      180deg,
      rgba(var(--color-primary-rgb, 74, 158, 255), 0.12) 0%,
      rgba(var(--color-primary-rgb, 74, 158, 255), 0.04) 100%
    );
  }
}
```

Toggle the `--accented` class based on whether `accentColor` is set (non-null).

#### 6c. Sidebar Accent

Add subtle accent background to sidebar:

```scss
.sidebar {
  // ... existing styles
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      160deg,
      rgba(var(--color-primary-rgb, 74, 158, 255), 0.04) 0%,
      transparent 60%
    );
    pointer-events: none;
    z-index: 0;
  }
}
```

### 7. Big Picture Mode Integration

In `src/big-picture/src/app.tsx` (or equivalent entry point):

- Read `accentColor` from user preferences
- Apply the same `injectAccentColor` logic to the Big Picture DOM root
- Use the same `DEFAULT_ACCENT_COLOR` fallback
- Big Picture has its own dynamic accent color system (from game images) — those override the user accent per-context (e.g., downloads hero), but the global UI chrome in Big Picture should respect the user's accent

### 8. What Should NOT Change

- **Game launcher** (`game-launcher.tsx`): Dynamic per-game accent extraction from cover art continues to work; user accent does NOT override it
- **Big Picture downloads hero**: Dynamic accent from game images continues to work
- **SCSS variable fallbacks**: Keep existing `#4a9eff` fallbacks in all `var(--accent, #4a9eff)` usages as safety nets

### 9. i18n Keys

Add to `src/locales/en/translation.json` under `settings`:

```json
"accent_color": "Accent color",
"accent_color_description": "Choose a color for buttons, links, and highlights",
"accent_color_custom": "Custom",
"accent_color_custom_placeholder": "Enter hex or RGB color",
"accent_color_invalid": "Invalid color format",
"accent_color_presets": "Presets",
"accent_color_reset": "Reset to default"
```

### 10. Edge Cases

| Scenario | Behavior |
|---|---|
| No accent preference set | Use default `#4a9eff` |
| User clears custom input | Reset to default `#4a9eff` |
| Invalid hex/RGB entered | Show validation error, don't apply |
| Custom theme active with `--accent` override | Theme wins, user accent doesn't apply |
| Custom theme active WITHOUT `--accent` override | User accent applies |
| User switches themes | Accent re-evaluates based on new theme |
| Accessibility: low contrast accent | Accept any color user provides (no forced contrast enforcement) |
| Big Picture and main app open simultaneously | Both use same accent from preferences |
| Accent preference is `null` vs `"#4a9eff"` | Both render identically, but `null` is stored to indicate "using default" |
| Color.js parsing fails | Fall back to default accent color silently |

---

## Implementation Order

1. Add `accentColor` to `UserPreferences` type
2. Create `injectAccentColor` / `removeAccentColor` helpers in `renderer/helpers.ts`
3. Add `:root` default CSS custom properties to `globals.scss`
4. Create `AccentColorPicker` component
5. Integrate into settings-context-general.tsx
6. Wire up accent injection in `app.tsx` (with theme priority logic)
7. Add sidebar and title bar accent styles
8. Add CSS transitions
9. Apply accent in Big Picture mode
10. Add i18n keys
11. Test with various themes and accent combinations
