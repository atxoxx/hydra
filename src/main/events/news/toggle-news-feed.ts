import { registerEvent } from "../register-event";
import { NewsService } from "@main/services/news-service";

const toggleNewsFeed = async (
  _event: Electron.IpcMainInvokeEvent,
  url: string,
  enabled: boolean
): Promise<void> => {
  await NewsService.toggleFeed(url, enabled);
};

registerEvent("toggleNewsFeed", toggleNewsFeed);
