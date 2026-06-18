import { BrowserWindow, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { BaseStore } from "./base-store";
import type { StoreGame, AuthResult, SyncResult } from "@types";

export class AmazonGamesStore extends BaseStore {
  readonly storeId = "amazon" as const;
  readonly storeName = "Amazon Games";
  readonly storeIcon = "amazon";
  readonly authMethod = "browser" as const;

  private get localDbPath(): string {
    return path.join(
      os.homedir(),
      "AppData",
      "Local",
      "Amazon Games",
      "Data",
      "Games",
      "Sql",
      "GameInstallInfo.sqlite"
    );
  }

  async login(_parentWindow: BrowserWindow): Promise<AuthResult> {
    const account = {
      storeId: this.storeId,
      displayName: "Amazon Games User",
      accountId: "local",
      isAuthenticated: true,
    };

    await this.saveAccount(account);
    return { success: true, account };
  }

  async logout(): Promise<void> {
    await this.clearStoredTokens();
  }

  async isTokenValid(): Promise<boolean> {
    const account = await this.loadAccount();
    return account?.isAuthenticated === true;
  }

  async refreshAuth(): Promise<boolean> {
    return this.isTokenValid();
  }

  async syncLibrary(): Promise<SyncResult> {
    try {
      const games: StoreGame[] = [];

      // Try reading Amazon's local SQLite database
      if (fs.existsSync(this.localDbPath)) {
        try {
          const Database = require("better-sqlite3");
          const amazonDb = new Database(this.localDbPath, { readonly: true });
          const rows = amazonDb.prepare("SELECT * FROM DbSet").all();

          for (const row of rows) {
            games.push({
              storeGameId: row.Id,
              title: row.ProductTitle,
              coverImageUrl: row.ProductIconUrl ?? null,
              isOwned: true,
              isInstalled: row.IsInstalled === 1,
              installPath: row.InstallDirectory ?? null,
              executablePath: row.ExePath ?? null,
              extraData: {
                productId: row.Id,
                productAsin: row.ProductAsin,
              },
            });
          }
          amazonDb.close();
        } catch (err) {
          this.logError("Failed to read Amazon SQLite DB", err);
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
    shell.openExternal(`amazon-games://install/${gameId}`);
  }

  async launchGame(gameId: string): Promise<void> {
    shell.openExternal(`amazon-games://play/${gameId}`);
  }
}
