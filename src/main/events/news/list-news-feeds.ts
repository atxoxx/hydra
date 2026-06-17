import { registerEvent } from "../register-event";
import { NewsService } from "@main/services/news-service";

const listNewsFeeds = async () => {
  return NewsService.listFeeds();
};

registerEvent("listNewsFeeds", listNewsFeeds);
