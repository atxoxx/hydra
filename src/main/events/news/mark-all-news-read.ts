import { registerEvent } from "../register-event";
import { NewsService } from "@main/services/news-service";

const markAllNewsRead = async () => {
  return NewsService.markAllRead();
};

registerEvent("markAllNewsRead", markAllNewsRead);
