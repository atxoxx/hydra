import type { AddNewsFeedPayload, RssFeed } from "@types";
import { registerEvent } from "../register-event";
import { NewsService } from "@main/services/news-service";

const addNewsFeed = async (
  _event: Electron.IpcMainInvokeEvent,
  payload: AddNewsFeedPayload
): Promise<RssFeed> => {
  return NewsService.addFeed(payload);
};

registerEvent("addNewsFeed", addNewsFeed);
