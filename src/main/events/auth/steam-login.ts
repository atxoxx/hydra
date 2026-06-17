import { registerEvent } from "../register-event";
import { SteamLogin } from "@main/services/steam-login";
import { SteamGameSync } from "@main/services/steam-game-sync";
import { SteamWebApi } from "@main/services/steam-web-api";
import {
  openSteamInstall,
  openSteamLaunch,
  getSteamExecutablePath,
} from "@main/services/steam";
import {
  startSteamInstallWatcher,
  stopSteamInstallWatcher,
} from "@main/services/steam-install-watcher";
import { db, levelKeys } from "@main/level";
import type { UserPreferences } from "@types";

const steamLogin = async () => {
  return SteamLogin.login();
};

const steamLogout = async () => {
  return SteamLogin.logout();
};

const steamGetLoginStatus = async () => {
  return SteamLogin.getLoginStatus();
};

const steamSync = async () => {
  const userPreferences = await db
    .get<string, UserPreferences | null>(levelKeys.userPreferences, {
      valueEncoding: "json",
    })
    .catch(() => null);

  const accessToken = userPreferences?.steamLoginAccessToken;
  const steamId64 = userPreferences?.steamLoginUserId;

  if (!accessToken || !steamId64) {
    throw new Error("Not logged in to Steam");
  }

  return SteamGameSync.syncAll(accessToken, steamId64);
};

const steamInstallGame = async (
  _event: Electron.IpcMainInvokeEvent,
  appId: string
) => {
  const exePath = await getSteamExecutablePath();
  if (!exePath) {
    throw new Error("Steam is not installed");
  }
  await openSteamInstall(appId);
  startSteamInstallWatcher(appId);
};

const steamLaunchGame = async (
  _event: Electron.IpcMainInvokeEvent,
  appId: string
) => {
  const exePath = await getSteamExecutablePath();
  if (!exePath) {
    throw new Error("Steam is not installed");
  }
  await openSteamLaunch(appId);
};

registerEvent("steamLogin", steamLogin);
registerEvent("steamLogout", steamLogout);
registerEvent("steamGetLoginStatus", steamGetLoginStatus);
registerEvent("steamSync", steamSync);
const steamStartInstallWatcherHandler = async (
  _event: Electron.IpcMainInvokeEvent,
  appId: string
) => startSteamInstallWatcher(appId);

const steamStopInstallWatcherHandler = async (
  _event: Electron.IpcMainInvokeEvent,
  appId: string
) => stopSteamInstallWatcher(appId);

const steamCheckOwnership = async (
  _event: Electron.IpcMainInvokeEvent,
  appId: string
) => {
  const userPreferences = await db
    .get<string, UserPreferences | null>(levelKeys.userPreferences, {
      valueEncoding: "json",
    })
    .catch(() => null);

  const accessToken = userPreferences?.steamLoginAccessToken;
  const steamId64 = userPreferences?.steamLoginUserId;

  if (!accessToken || !steamId64) {
    return false;
  }

  return SteamWebApi.checkGameOwnership(
    steamId64,
    accessToken,
    Number(appId)
  );
};

registerEvent("steamInstallGame", steamInstallGame);
registerEvent("steamLaunchGame", steamLaunchGame);
registerEvent(
  "steamStartInstallWatcher",
  steamStartInstallWatcherHandler
);
registerEvent("steamStopInstallWatcher", steamStopInstallWatcherHandler);
registerEvent("steamCheckOwnership", steamCheckOwnership);
