import { registerEvent } from "../register-event";
import { NewsService } from "@main/services/news-service";

const markNewsArticleRead = async (
  _event: Electron.IpcMainInvokeEvent,
  guid: string
) => {
  return NewsService.markRead(guid);
};

registerEvent("markNewsArticleRead", markNewsArticleRead);
