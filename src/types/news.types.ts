export interface RssFeed {
  url: string;
  label: string;
  enabled: boolean;
  isDefault: boolean;
  addedAt: number;
  lastFetchAt: number | null;
  lastError: string | null;
  etag?: string | null;
  lastModified?: string | null;
}

export interface NewsArticle {
  guid: string;
  feedUrl: string;
  feedLabel: string;
  title: string;
  link: string;
  author?: string | null;
  pubDate: number;
  summary: string | null;
  thumbnailUrl: string | null;
  categories: string[];
}

export interface NewsSnapshot {
  feeds: RssFeed[];
  articles: NewsArticle[];
  fetchedAt: number;
  totalUnread: number;
}

export interface MarkReadResult {
  guid: string;
  readAt: number;
}

export interface AddNewsFeedPayload {
  url: string;
  label: string;
}
