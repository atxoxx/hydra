import { BrowserWindow, shell } from "electron";
import axios from "axios";
import { BaseStore } from "./base-store";
import type { StoreGame, AuthResult, SyncResult } from "@types";

const EPIC_CLIENT_ID = "34a02cf8f4414e29b15921876da36f9a";
const EPIC_CLIENT_SECRET = "daafbccc737745039dffe53d94fc76cf";
const EPIC_TOKEN_ENDPOINT =
  "https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token";
const EPIC_AUTH_HEADER = Buffer.from(
  `${EPIC_CLIENT_ID}:${EPIC_CLIENT_SECRET}`
).toString("base64");

export class EpicGamesStore extends BaseStore {
  readonly storeId = "epic" as const;
  readonly storeName = "Epic Games Store";
  readonly storeIcon = "epic";
  readonly authMethod = "browser" as const;

  async login(parentWindow: BrowserWindow): Promise<AuthResult> {
    return new Promise((resolve) => {
      const loginWindow = new BrowserWindow({
        width: 800,
        height: 700,
        parent: parentWindow,
        modal: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      const loginUrl =
        "https://www.epicgames.com/id/login?" +
        new URLSearchParams({
          redirectUrl:
            "https://www.epicgames.com/id/api/redirect?clientId=" +
            EPIC_CLIENT_ID +
            "&responseType=code",
        }).toString();

      loginWindow.loadURL(loginUrl, {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      });

      let resolved = false;

      const handleRedirect = async (_event: Electron.Event, url: string) => {
        if (resolved) return;

        // Epic's OAuth flow: after login, the browser is redirected through
        // epicgames.com/id/api/redirect → then to localhost/launcher/authorized?code=XXX
        // We catch ANY redirect URL that contains the authorization code.
        let authCode: string | null = null;
        try {
          authCode = new URL(url).searchParams.get("code");
        } catch {
          return; // Not a valid URL, skip
        }

        if (!authCode) return;

        // Only accept codes from Epic domains or the localhost callback
        if (
          !url.includes("epicgames.com") &&
          !url.includes("launcher/authorized")
        ) {
          return;
        }

        resolved = true;
        try {
          loginWindow.close();

          const tokenResponse = await axios.post(
            EPIC_TOKEN_ENDPOINT,
            new URLSearchParams({
              grant_type: "authorization_code",
              code: authCode,
              token_type: "eg1",
            }),
            {
              headers: {
                Authorization: `Basic ${EPIC_AUTH_HEADER}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
            }
          );

          const {
            access_token,
            refresh_token,
            expires_in,
            account_id,
            displayName,
          } = tokenResponse.data;

          const account = {
            storeId: this.storeId,
            displayName,
            accountId: account_id,
            isAuthenticated: true,
            accessToken: access_token,
            refreshToken: refresh_token,
            tokenExpiry: Date.now() + expires_in * 1000,
          };

          await this.saveAccount(account);
          resolve({ success: true, account });
        } catch (error: any) {
          if (!loginWindow.isDestroyed()) loginWindow.close();
          resolve({ success: false, error: error.message });
        }
      };

      loginWindow.webContents.on("will-redirect", handleRedirect);

      loginWindow.on("closed", () => {
        if (!resolved) {
          resolve({ success: false, error: "Login window closed by user" });
        }
      });
    });
  }

  async logout(): Promise<void> {
    await this.clearStoredTokens();
    this.account = null;
  }

  async isTokenValid(): Promise<boolean> {
    const account = await this.loadAccount();
    if (!account?.tokenExpiry) return false;
    return Date.now() < account.tokenExpiry - 60_000;
  }

  async refreshAuth(): Promise<boolean> {
    const account = await this.loadAccount();
    if (!account?.refreshToken) return false;

    try {
      const response = await axios.post(
        EPIC_TOKEN_ENDPOINT,
        new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: account.refreshToken,
          token_type: "eg1",
        }),
        {
          headers: {
            Authorization: `Basic ${EPIC_AUTH_HEADER}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;
      await this.saveAccount({
        ...account,
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiry: Date.now() + expires_in * 1000,
      });
      return true;
    } catch {
      return false;
    }
  }

  private async getAccessToken(): Promise<string> {
    if (!(await this.isTokenValid())) {
      const refreshed = await this.refreshAuth();
      if (!refreshed)
        throw new Error(
          "Epic Games authentication expired. Please login again."
        );
    }
    const account = await this.loadAccount();
    return account!.accessToken!;
  }

  async syncLibrary(): Promise<SyncResult> {
    try {
      const token = await this.getAccessToken();

      const libraryResponse = await axios.get(
        "https://library-service.live.use1a.on.epicgames.com/library/api/public/items?includeMetadata=true&platform=Windows",
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const records = libraryResponse.data.records || [];
      const gameRecords = records.filter(
        (r: any) => r.sandboxType === "PRIVATE" || r.sandboxType === "LIVE"
      );

      const games: StoreGame[] = [];
      const batchSize = 50;

      for (let i = 0; i < gameRecords.length; i += batchSize) {
        const batch = gameRecords.slice(i, i + batchSize);

        const byNamespace: Record<string, string[]> = {};
        for (const record of batch) {
          if (!byNamespace[record.namespace])
            byNamespace[record.namespace] = [];
          byNamespace[record.namespace].push(record.catalogItemId);
        }

        for (const [namespace, ids] of Object.entries(byNamespace)) {
          try {
            const catalogResponse = await axios.get(
              `https://catalog-public-service-prod.ol.epicgames.com/catalog/api/shared/namespace/${namespace}/bulk/items`,
              {
                params: {
                  id: ids.join(","),
                  includeDLCDetails: true,
                  includeMainGameDetails: true,
                  country: "US",
                  locale: "en-US",
                },
                headers: { Authorization: `Bearer ${token}` },
              }
            );

            const catalogItems = catalogResponse.data;

            for (const [itemId, item] of Object.entries(catalogItems as any)) {
              const metadata = item as any;

              const coverImage = metadata.keyImages?.find(
                (img: any) =>
                  img.type === "DieselGameBox" || img.type === "Thumbnail"
              );
              const backgroundImage = metadata.keyImages?.find(
                (img: any) =>
                  img.type === "DieselGameBoxTall" ||
                  img.type === "OfferImageTall"
              );

              const record = batch.find((r: any) => r.catalogItemId === itemId);

              games.push({
                storeGameId: metadata.id || itemId,
                title: metadata.title,
                slug: metadata.urlSlug,
                coverImageUrl: coverImage?.url ?? null,
                backgroundImageUrl: backgroundImage?.url ?? null,
                description: metadata.description ?? null,
                developers: metadata.developer ? [metadata.developer] : [],
                releaseDate: metadata.releaseInfo?.[0]?.dateAdded ?? null,
                isOwned: true,
                storeUrl: `https://store.epicgames.com/product/${metadata.urlSlug}`,
                extraData: {
                  namespace,
                  appName: record?.appName,
                  catalogItemId: itemId,
                },
              });
            }
          } catch (err) {
            this.logError(
              `Failed to fetch catalog for namespace ${namespace}`,
              err
            );
          }
        }
      }

      await this.saveGames(games);
      this.log(`Synced ${games.length} games`);
      await this.logSync({ success: true, gamesSynced: games.length });
      return { success: true, gamesSynced: games.length };
    } catch (error: any) {
      await this.logSync({
        success: false,
        gamesSynced: 0,
        error: error.message,
      });
      return { success: false, gamesSynced: 0, error: error.message };
    }
  }

  async getOwnedGames(): Promise<StoreGame[]> {
    return this.getStoredGames();
  }

  async installGame(gameId: string): Promise<void> {
    const games = await this.getStoredGames();
    const game = games.find((g) => g.storeGameId === gameId);
    const extraData = (game?.extraData ?? {}) as any;

    shell.openExternal(
      `com.epicgames.launcher://apps/${extraData.appName ?? gameId}?action=install`
    );
  }

  async launchGame(gameId: string): Promise<void> {
    const games = await this.getStoredGames();
    const game = games.find((g) => g.storeGameId === gameId);
    const extraData = (game?.extraData ?? {}) as any;

    shell.openExternal(
      `com.epicgames.launcher://apps/${extraData.appName ?? gameId}?action=launch`
    );
  }
}
