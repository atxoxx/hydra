import { registerEvent } from "../register-event";
import { NewsService } from "@main/services/news-service";

const listNewsReadGuids = async () => {
  return NewsService.listReadGuids();
};

registerEvent("listNewsReadGuids", listNewsReadGuids);
