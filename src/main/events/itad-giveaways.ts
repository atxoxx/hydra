import { ipcMain } from "electron";
import { getGiveaways } from "@main/services/itad-giveaway-service";

ipcMain.handle("getItadGiveaways", async () => {
  return getGiveaways();
});
