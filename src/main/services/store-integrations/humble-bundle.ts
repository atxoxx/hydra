import { BrowserWindow, shell } from "electron";
import axios from "axios";
import { BaseStore } from "./base-store";
import type { StoreGame, AuthResult, SyncResult } from "@types";

export class HumbleBundleStore extends BaseStore {
  readonly storeId = "humble" as const;
  readonly storeName = "Humble Bundle";
  readonly storeIcon = "humble";
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

      loginWindow.loadURL("https://www.humblebundle.com/login");
      let resolved = false;

      loginWindow.webContents.on(
        "did-navigate",
        async (_event: Electron.Event, url: string) => {
          if (resolved) return;
          if (
            url !== "https://www.humblebundle.com/" &&
            !url.includes("humblebundle.com/home")
          )
            return;

          resolved = true;

          try {
            const cookies = await loginWindow.webContents.session.cookies.get({
              domain: "humblebundle.com",
              name: "_simpleauth_sess",
            });

            if (cookies.length > 0) {
              const sessionToken = cookies[0].value;
              loginWindow.close();

              const account = {
                storeId: this.storeId,
                displayName: "Humble User",
                accountId: "humble_user",
                isAuthenticated: true,
                accessToken: sessionToken,
              };

              await this.saveAccount(account);
              resolve({ success: true, account });
            } else {
              loginWindow.close();
              resolve({ success: false, error: "No session cookie found" });
            }
          } catch (error: any) {
            if (!loginWindow.isDestroyed()) loginWindow.close();
            resolve({ success: false, error: error.message });
          }
        }
      );

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
    if (!account?.accessToken) return false;

    try {
      await axios.get(
        "https://www.humblebundle.com/api/v1/user/order?ajax=true",
        {
          headers: {
            Cookie: `_simpleauth_sess=${account.accessToken}`,
          },
          timeout: 5000,
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async refreshAuth(): Promise<boolean> {
    return this.isTokenValid();
  }

  async syncLibrary(): Promise<SyncResult> {
    const account = await this.loadAccount();
    if (!account?.accessToken) {
      return { success: false, gamesSynced: 0, error: "Not authenticated" };
    }

    const cookie = `_simpleauth_sess=${account.accessToken}`;

    try {
      const ordersResponse = await axios.get(
        "https://www.humblebundle.com/api/v1/user/order?ajax=true",
        { headers: { Cookie: cookie } }
      );

      const gamekeys = ordersResponse.data.map((o: any) => o.gamekey);
      const games: StoreGame[] = [];
      const seen = new Set<string>();

      for (const gamekey of gamekeys) {
        try {
          await new Promise((r) => setTimeout(r, 100));

          const orderResponse = await axios.get(
            `https://www.humblebundle.com/api/v1/order/${gamekey}?ajax=true`,
            { headers: { Cookie: cookie } }
          );

          const subproducts = orderResponse.data.subproducts || [];

          for (const product of subproducts) {
            if (seen.has(product.machine_name)) continue;
            seen.add(product.machine_name);

            const downloads = product.downloads || [];
            const hasDownloads = downloads.length > 0;

            if (hasDownloads) {
              games.push({
                storeGameId: product.machine_name,
                title: product.human_name,
                coverImageUrl: product.icon ?? null,
                isOwned: true,
                storeUrl: "https://www.humblebundle.com/home/library",
                extraData: {
                  gamekey,
                  machineName: product.machine_name,
                  downloads,
                },
              });
            }
          }
        } catch (err) {
          this.logError(`Failed to fetch order ${gamekey}`, err);
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

  async installGame(_gameId: string): Promise<void> {
    shell.openExternal("https://www.humblebundle.com/home/library");
  }
}
