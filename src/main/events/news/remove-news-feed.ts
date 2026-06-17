import { registerEvent } from "../register-event";
import { NewsService } from "@main/services/news-service";

const removeNewsFeed = async (
  _event: Electron.IpcMainInvokeEvent,
  url: string
): Promise<void> => {
  await NewsService.removeFeed(url);
};

registerEvent("removeNewsFeed", removeNewsFeed);
