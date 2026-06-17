import axios from "axios";
import path from "node:path";
import fs from "node:fs";
import { crc32 } from "crc";
import WinReg from "winreg";
import { parseBuffer, writeBuffer } from "steam-shortcut-editor";
import { shell } from "electron";

import type { SteamAppDetails, SteamShortcut } from "@types";

import { logger } from "./logger";
import { SystemPath } from "./system-path";

export interface SteamAppDetailsResponse {
  [key: string]: {
    success: boolean;
    data: SteamAppDetails;
  };
}

export const getSteamLocation = async () => {
  if (process.platform === "linux") {
    const possiblePaths = [
      path.join(SystemPath.getPath("home"), ".steam", "steam"),
      path.join(SystemPath.getPath("home"), ".local", "share", "Steam"),
    ];

    return possiblePaths.find((p) => fs.existsSync(p)) || possiblePaths[0];
  }

  if (process.platform === "darwin") {
    return path.join(
      SystemPath.getPath("home"),
      "Library",
      "Application Support",
      "Steam"
    );
  }

  const regKey = new WinReg({
    hive: WinReg.HKCU,
    key: "\\Software\\Valve\\Steam",
  });

  return new Promise<string>((resolve, reject) => {
    regKey.get("SteamPath", (err, value) => {
      if (err) {
        reject(err);
      }

      if (!value) {
        reject(new Error("SteamPath not found in registry"));
      }

      resolve(value.value);
    });
  });
};

export const getSteamAppDetails = async (
  objectId: string,
  language: string
) => {
  const searchParams = new URLSearchParams({
    appids: objectId,
    l: language,
    cc: "us",
  });

  return axios
    .get<SteamAppDetailsResponse>(
      `http://store.steampowered.com/api/appdetails?${searchParams.toString()}`
    )
    .then((response) => {
      if (response.data[objectId].success) {
        const data = response.data[objectId].data;
        return {
          ...data,
          objectId,
        };
      }

      return null;
    })
    .catch((err) => {
      logger.error("Error on getSteamAppDetails", {
        message: err?.message,
        code: err?.code,
        name: err?.name,
      });
      return null;
    });
};

export const getSteamUsersIds = async () => {
  const steamLocation = await getSteamLocation().catch(() => null);

  if (!steamLocation) {
    return [];
  }

  const userDataPath = path.join(steamLocation, "userdata");

  if (!fs.existsSync(userDataPath)) {
    return [];
  }

  const userIds = fs.readdirSync(userDataPath, {
    withFileTypes: true,
  });

  return userIds
    .filter((dir) => dir.isDirectory())
    .map((dir) => Number(dir.name));
};

export const getSteamShortcuts = async (steamUserId: number) => {
  const shortcutsPath = path.join(
    await getSteamLocation(),
    "userdata",
    steamUserId.toString(),
    "config",
    "shortcuts.vdf"
  );

  if (!fs.existsSync(shortcutsPath)) {
    return [];
  }

  const shortcuts = parseBuffer(fs.readFileSync(shortcutsPath));

  return shortcuts.shortcuts as SteamShortcut[];
};

export const generateSteamShortcutAppId = (
  exePath: string,
  gameName: string
) => {
  const input = exePath + gameName;
  const crcValue = crc32(input) >>> 0;
  const steamAppId = (crcValue | 0x80000000) >>> 0;
  return steamAppId;
};

export interface CreateSteamShortcutOptions {
  openVr?: boolean;
}

export const composeSteamShortcut = (
  title: string,
  executablePath: string,
  iconPath: string | null,
  options?: CreateSteamShortcutOptions
): SteamShortcut => {
  return {
    appid: generateSteamShortcutAppId(executablePath, title),
    appname: title,
    Exe: `"${executablePath}"`,
    StartDir: `"${path.dirname(executablePath)}"`,
    icon: iconPath ?? "",
    ShortcutPath: "",
    LaunchOptions: "",
    IsHidden: false,
    AllowDesktopConfig: true,
    AllowOverlay: true,
    OpenVR: Boolean(options?.openVr),
    Devkit: false,
    DevkitGameID: "",
    DevkitOverrideAppID: false,
    LastPlayTime: 0,
    FlatpakAppID: "",
  };
};

export const writeSteamShortcuts = async (
  steamUserId: number,
  shortcuts: SteamShortcut[]
) => {
  const buffer = writeBuffer({ shortcuts });

  return fs.promises.writeFile(
    path.join(
      await getSteamLocation(),
      "userdata",
      steamUserId.toString(),
      "config",
      "shortcuts.vdf"
    ),
    buffer
  );
};

// --- Steam Protocol Helpers ---

/** Returns the path to steam.exe, or null if Steam is not installed */
export const getSteamExecutablePath = async (): Promise<string | null> => {
  try {
    const steamPath = await getSteamLocation();
    const exePath =
      process.platform === "win32"
        ? path.join(steamPath, "steam.exe")
        : process.platform === "darwin"
          ? path.join(steamPath, "Contents", "MacOS", "steam_osx")
          : path.join(steamPath, "steam.sh");

    return fs.existsSync(exePath) ? exePath : null;
  } catch {
    return null;
  }
};

/** Opens steam://install/{appId} to trigger a Steam game install */
export const openSteamInstall = async (appId: string): Promise<void> => {
  const url = `steam://install/${appId}`;
  logger.info(`[Steam] Opening install URL: ${url}`);
  await shell.openExternal(url);
};

/** Opens steam://rungameid/{appId} to launch a game via Steam */
export const openSteamLaunch = async (appId: string): Promise<void> => {
  const url = `steam://rungameid/${appId}`;
  logger.info(`[Steam] Opening launch URL: ${url}`);
  await shell.openExternal(url);
};
