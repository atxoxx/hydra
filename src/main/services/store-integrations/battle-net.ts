import { BrowserWindow, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { BaseStore } from "./base-store";
import type { StoreGame, AuthResult, SyncResult } from "@types";

const BNET_GAMES: Record<string, { title: string }> = {
  Pro: { title: "Overwatch 2" },
  W3: { title: "Warcraft III: Reforged" },
  WoW: { title: "World of Warcraft" },
  D3: { title: "Diablo III" },
  WTCG: { title: "Hearthstone" },
  Hero: { title: "Heroes of the Storm" },
  S2: { title: "StarCraft II" },
  S1: { title: "StarCraft" },
  Fen: { title: "Diablo IV" },
  VIPR: { title: "Call of Duty: Warzone" },
  ODIN: { title: "Call of Duty: Modern Warfare" },
};

export class BattleNetStore extends BaseStore {
  readonly storeId = "battle-net" as const;
  readonly storeName = "Battle.net";
  readonly storeIcon = "battlenet";
  readonly authMethod = "browser" as const;

  private readonly bnetConfigPath = path.join(
    os.homedir(),
    "AppData",
    "Roaming",
    "Battle.net",
    "Battle.net.config"
  );

  async login(_parentWindow: BrowserWindow): Promise<AuthResult> {
    // Battle.net: check local config for installed games
    const account = {
      storeId: this.storeId,
      displayName: "Battle.net User",
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
    return true;
  }

  async refreshAuth(): Promise<boolean> {
    return true;
  }

  async syncLibrary(): Promise<SyncResult> {
    try {
      const games: StoreGame[] = [];

      if (fs.existsSync(this.bnetConfigPath)) {
        try {
          const config = JSON.parse(
            fs.readFileSync(this.bnetConfigPath, "utf8")
          );
          const installedGames = config?.Client?.Games || {};

          for (const [uid, gameData] of Object.entries(installedGames)) {
            const gameDef = BNET_GAMES[uid];
            const data = gameData as any;

            games.push({
              storeGameId: uid,
              title: gameDef?.title || uid,
              isOwned: true,
              isInstalled: true,
              installPath: data.InstallPath ?? null,
              extraData: { uid, ...data },
            });
          }
        } catch (err) {
          this.logError("Failed to parse Battle.net config", err);
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
    shell.openExternal(`battlenet://INSTALL?game=${gameId}`);
  }

  async launchGame(gameId: string): Promise<void> {
    shell.openExternal(`battlenet://${gameId}`);
  }
}
