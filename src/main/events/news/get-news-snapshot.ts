import { registerEvent } from "../register-event";
import { NewsService } from "@main/services/news-service";

const getNewsSnapshot = async (
  _event: Electron.IpcMainInvokeEvent,
  forceRefresh?: boolean
) => {
  return NewsService.getSnapshot(Boolean(forceRefresh));
};

registerEvent("getNewsSnapshot", getNewsSnapshot);
