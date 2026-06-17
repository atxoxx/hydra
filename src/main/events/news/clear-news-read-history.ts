import { registerEvent } from "../register-event";
import { NewsService } from "@main/services/news-service";

const clearNewsReadHistory = async () => {
  await NewsService.clearAllReadHistory();
};

registerEvent("clearNewsReadHistory", clearNewsReadHistory);
