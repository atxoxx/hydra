import { registerEvent } from "../register-event";
import { searchGameAssets } from "@main/services/duckduckgo-image-search";
import type { AssetType } from "@main/services/duckduckgo-image-search";

const searchGameAssetsEvent = async (
  _event: Electron.IpcMainInvokeEvent,
  gameTitle: string,
  assetType: AssetType
) => {
  return searchGameAssets(gameTitle, assetType);
};

registerEvent("searchGameAssets", searchGameAssetsEvent);
