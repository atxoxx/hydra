import { BrowserWindow, shell } from "electron";
import axios from "axios";
import { BaseStore } from "./base-store";
import type { StoreGame, AuthResult, SyncResult } from "@types";

const GOG_CLIENT_ID = "46899977096215655";
const GOG_CLIENT_SECRET =
  "9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9";
const GOG_REDIRECT_URI = "https://embed.gog.com/on_login_success?origin=client";

export class GOGStore extends BaseStore {
  readonly storeId = "gog" as const;
  readonly storeName = "GOG Galaxy";
  readonly storeIcon = "gog";
  readonly authMethod = "browser" as const;

  async login(parentWindow: BrowserWindow): Promise<AuthResult> {
    return new Promise((resolve) => {
      const loginWindow = new BrowserWindow({
        width: 800,
        height: 700,
        parent: parentWindow,
        modal: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      });

      const authUrl =
        "https://auth.gog.com/auth?" +
        new URLSearchParams({
          client_id: GOG_CLIENT_ID,
          redirect_uri: GOG_REDIRECT_URI,
          response_type: "code",
          layout: "client2",
        }).toString();

      loginWindow.loadURL(authUrl);

      let resolved = false;

      const handleRedirect = async (_event: Electron.Event, url: string) => {
        if (resolved) return;
        if (!url.includes("on_login_success") || !url.includes("code=")) return;

        resolved = true;
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get("code");

        loginWindow.close();

        if (!code) {
          resolve({ success: false, error: "No authorization code received" });
          return;
        }

        try {
          const tokenResponse = await axios.post(
            "https://auth.gog.com/token",
            new URLSearchParams({
              client_id: GOG_CLIENT_ID,
              client_secret: GOG_CLIENT_SECRET,
              grant_type: "authorization_code",
              code,
              redirect_uri: GOG_REDIRECT_URI,
            }),
            {
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
            }
          );

          const { access_token, refresh_token, expires_in } =
            tokenResponse.data;

          const userResponse = await axios.get(
            "https://embed.gog.com/userData.json",
            {
              headers: { Authorization: `Bearer ${access_token}` },
            }
          );

          const { username, userId, email } = userResponse.data;

          const account = {
            storeId: this.storeId,
            displayName: username,
            email,
            accountId: String(userId),
            isAuthenticated: true,
            accessToken: access_token,
            refreshToken: refresh_token,
            tokenExpiry: Date.now() + expires_in * 1000,
          };

          await this.saveAccount(account);
          resolve({ success: true, account });
        } catch (error: any) {
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
        "https://auth.gog.com/token",
        new URLSearchParams({
          client_id: GOG_CLIENT_ID,
          client_secret: GOG_CLIENT_SECRET,
          grant_type: "refresh_token",
          refresh_token: account.refreshToken,
        }),
        {
          headers: {
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

  async syncLibrary(): Promise<SyncResult> {
    try {
      if (!(await this.isTokenValid())) await this.refreshAuth();
      const account = await this.loadAccount();
      const token = account!.accessToken!;

      const games: StoreGame[] = [];
      let page = 1;
      let totalPages = 1;

      while (page <= totalPages) {
        const response = await axios.get(
          "https://embed.gog.com/account/getFilteredProducts",
          {
            params: { mediaType: 1, page, sortBy: "title" },
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        totalPages = response.data.totalPages;
        const products = response.data.products || [];

        for (const product of products) {
          games.push({
            storeGameId: String(product.id),
            title: product.title,
            coverImageUrl: product.image
              ? `https:${product.image}_392.jpg`
              : null,
            isOwned: true,
            storeUrl: `https://www.gog.com${product.url}`,
            extraData: {
              gogId: product.id,
              worksOn: product.worksOn,
            },
          });
        }
        page++;
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
    shell.openExternal(`goggalaxy://installGame/${gameId}`);
  }

  async launchGame(gameId: string): Promise<void> {
    shell.openExternal(`goggalaxy://openGame/${gameId}`);
  }
}
