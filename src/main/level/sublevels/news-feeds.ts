import type { RssFeed } from "@types";

import { db } from "../level";
import { levelKeys } from "./keys";

export const newsFeedsSublevel = db.sublevel<string, RssFeed>(
  levelKeys.newsFeeds,
  { valueEncoding: "json" }
);

export const listNewsFeeds = async (): Promise<RssFeed[]> => {
  const all = await newsFeedsSublevel.values().all();
  return all.sort((a, b) => a.addedAt - b.addedAt);
};

export const upsertNewsFeed = async (feed: RssFeed): Promise<void> => {
  await newsFeedsSublevel.put(feed.url, feed);
};

export const deleteNewsFeed = async (url: string): Promise<void> => {
  await newsFeedsSublevel.del(url);
};
