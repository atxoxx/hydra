import { BrowserWindow, session } from "electron";
import { db, levelKeys } from "@main/level";
import type { UserPreferences, SteamLoginResult } from "@types";
import { logger } from "./logger";

const STEAM_LOGIN_URL = "https://store.steampowered.com/explore/";
const STEAM_LOGIN_WINDOW_WIDTH = 600;
const STEAM_LOGIN_WINDOW_HEIGHT = 720;

// Match both literal quotes and HTML entities (&quot;).
// Steam embeds the session JSON inside a data-* attribute, so
// document.documentElement.outerHTML returns &quot; entities.
const STEAM_ID_REGEX =
  /(?:"|&quot;)steamid(?:"|&quot;):(?:"|&quot;)(\d{17})(?:"|&quot;)/;
const STEAM_TOKEN_REGEX =
  /(?:"|&quot;)webapi_token(?:"|&quot;):(?:"|&quot;)([^&"]+)(?:"|&quot;)/;

/**
 * Extracts steamid and webapi_token from the page source of a
 * Steam store page after authentication.
 *
 * The tokens are embedded in the page HTML as:
 * ```
 * "steamid":"7656119XXXXXXXXXX"
 * "webapi_token":"xxxxxxxxxxxxxxxxxxxxxxxx"
 * ```
 *
 * This matches Playnite's SteamStoreService.GetSteamUserTokenFromWebViewAsync().
 */
function extractTokenFromPage(pageSource: string): SteamLoginResult | null {
  const steamIdMatch = STEAM_ID_REGEX.exec(pageSource);
  const tokenMatch = STEAM_TOKEN_REGEX.exec(pageSource);

  if (!steamIdMatch || !tokenMatch) {
    return null;
  }

  return {
    steamId64: steamIdMatch[1],
    accessToken: tokenMatch[1],
    username: "", // Will be populated from API after login
  };
}

/**
 * Clears Steam-related cookies so the user is prompted to log in
 * rather than reusing an existing session.
 */
function clearSteamCookies(session: Electron.Session): Promise<void> {
  const steamDomains = [
    ".steamcommunity.com",
    "steamcommunity.com",
    "steampowered.com",
    "store.steampowered.com",
    "help.steampowered.com",
    "login.steampowered.com",
  ];

  return Promise.all(
    steamDomains.map((domain) =>
      session.cookies
        .remove(domain, "")
        .catch(() => {
          // Ignore errors — some domains may not have cookies
        })
    )
  ).then(() => {});
}

export class SteamLogin {
  /**
   * Opens an Electron BrowserWindow for Steam OAuth login.
   *
   * The window navigates to the Steam store explore page, which
   * redirects unauthenticated users to the login page. After the
   * user logs in, the page HTML contains steamid and webapi_token.
   * We extract these, close the window, persist the credentials,
   * and return the result to the renderer.
   *
   * Uses a dedicated session partition to isolate cookies from
   * the main window, and clears Steam cookies before navigation
   * to ensure a fresh login prompt.
   *
   * @returns The login result or throws on failure
   */
  static async login(): Promise<SteamLoginResult> {
    return new Promise<SteamLoginResult>((resolve, reject) => {
      let loginWindow: BrowserWindow | null = null;
      let resolved = false;

      const finish = (result: SteamLoginResult | null, error?: Error) => {
        if (resolved) return;
        resolved = true;

        if (loginWindow && !loginWindow.isDestroyed()) {
          loginWindow.close();
        }

        if (result) {
          resolve(result);
        } else {
          reject(
            error ?? new Error("Steam login failed — no token found")
          );
        }
      };

      // Use a dedicated session partition to isolate Steam cookies.
      // Fixed partition name so we don't accumulate stale session data on disk;
      // cookies are cleared before each login to ensure a fresh prompt.
      const partition = "persist:steam-login";
      const loginSession = session.fromPartition(partition);

      loginWindow = new BrowserWindow({
        width: STEAM_LOGIN_WINDOW_WIDTH,
        height: STEAM_LOGIN_WINDOW_HEIGHT,
        backgroundColor: "#1c1c1c",
        show: false,
        maximizable: false,
        resizable: false,
        minimizable: false,
        webPreferences: {
          sandbox: false,
          partition,
        },
      });

      loginWindow.removeMenu();

      // Clear Steam cookies so the user must log in fresh
      clearSteamCookies(loginSession)
        .then(() => {
          loginWindow?.loadURL(STEAM_LOGIN_URL);
        })
        .catch(() => {
          // Even if cookie clearing fails, still attempt navigation
          loginWindow?.loadURL(STEAM_LOGIN_URL);
        });

      // Wait for the page to finish loading after login
      loginWindow.webContents.on("did-finish-load", async () => {
        if (resolved) return;

        try {
          const pageSource =
            await loginWindow!.webContents.executeJavaScript(
              "document.documentElement.outerHTML"
            );

          const result = extractTokenFromPage(pageSource);
          if (result) {
            // Found token — persist and close
            await SteamLogin.saveCredentials(result);
            finish(result);
          }
        } catch (err) {
          logger.error("[SteamLogin] Error extracting token:", err);
        }
      });

      // Handle navigation — if the user navigates to the login page
      // we don't do anything special; the did-finish-load event will
      // fire again when the login completes and redirects back to store.
      loginWindow.webContents.on("will-navigate", (_event, url) => {
        if (resolved) return;
        logger.info("[SteamLogin] Navigating to:", url);
      });

      loginWindow.on("ready-to-show", () => {
        loginWindow?.show();
      });

      loginWindow.on("closed", () => {
        loginWindow = null;
        if (!resolved) {
          finish(null, new Error("Login window was closed by the user"));
        }
      });
    });
  }

  /**
   * Persists Steam login credentials to UserPreferences.
   */
  static async saveCredentials(result: SteamLoginResult): Promise<void> {
    const userPreferences = await db
      .get<string, UserPreferences | null>(levelKeys.userPreferences, {
        valueEncoding: "json",
      })
      .catch(() => null);

    const updated: UserPreferences = {
      ...(userPreferences ?? {}),
      steamLoginUserId: result.steamId64,
      steamLoginUsername: result.username || `Steam User ${result.steamId64.slice(-4)}`,
      steamLoginAccessToken: result.accessToken,
      steamLoginTokenObtainedAt: new Date().toISOString(),
    };

    await db.put<string, UserPreferences>(
      levelKeys.userPreferences,
      updated,
      { valueEncoding: "json" }
    );
  }

  /**
   * Clears stored Steam credentials but leaves imported games intact.
   */
  static async logout(): Promise<void> {
    const userPreferences = await db
      .get<string, UserPreferences | null>(levelKeys.userPreferences, {
        valueEncoding: "json",
      })
      .catch(() => null);

    if (!userPreferences) return;

    const updated: UserPreferences = {
      ...userPreferences,
      steamLoginUserId: null,
      steamLoginUsername: null,
      steamLoginAccessToken: null,
      steamLoginTokenObtainedAt: null,
    };

    await db.put<string, UserPreferences>(
      levelKeys.userPreferences,
      updated,
      { valueEncoding: "json" }
    );
  }

  /**
   * Returns the current Steam login state from stored preferences.
   */
  static async getLoginStatus(): Promise<{
    status: "logged-out" | "logged-in" | "expired";
    steamId64: string | null;
    username: string | null;
    lastSyncAt: string | null;
  }> {
    const userPreferences = await db
      .get<string, UserPreferences | null>(levelKeys.userPreferences, {
        valueEncoding: "json",
      })
      .catch(() => null);

    const hasCredentials =
      Boolean(userPreferences?.steamLoginUserId) &&
      Boolean(userPreferences?.steamLoginAccessToken);

    if (!hasCredentials) {
      return {
        status: "logged-out",
        steamId64: null,
        username: null,
        lastSyncAt: userPreferences?.steamLastSyncAt ?? null,
      };
    }

    return {
      status: "logged-in",
      steamId64: userPreferences!.steamLoginUserId ?? null,
      username: userPreferences!.steamLoginUsername ?? null,
      lastSyncAt: userPreferences!.steamLastSyncAt ?? null,
    };
  }
}
