import axios, { type AxiosInstance } from "axios";
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { createHash } from "node:crypto";

import type { NewsArticle, NewsSnapshot, RssFeed } from "@types";
import { logger } from "./logger";
import { WindowManager } from "./window-manager";
import {
  deleteNewsFeed,
  listNewsFeeds,
  newsFeedsSublevel,
  upsertNewsFeed,
} from "@main/level/sublevels/news-feeds";
import {
  clearAllReadStates,
  newsReadStateSublevel,
  pruneOldReadStates,
} from "@main/level/sublevels/news-read-state";

const DEFAULT_FEEDS: Array<{ url: string; label: string }> = [
  { url: "https://feeds.feedburner.com/ign/all", label: "IGN" },
  { url: "https://www.pcgamer.com/rss/", label: "PC Gamer" },
  { url: "https://www.polygon.com/rss/index.xml", label: "Polygon" },
  { url: "https://www.eurogamer.net/?format=rss", label: "Eurogamer" },
  { url: "https://kotaku.com/rss", label: "Kotaku" },
  { url: "https://www.gamespot.com/feeds/mars/", label: "GameSpot" },
  { url: "https://www.rockpapershotgun.com/feed", label: "Rock Paper Shotgun" },
];

const MAX_POLL_INTERVAL_MS = 15 * 60 * 1000;
const MAX_BACKOFF_MS = 60 * 60 * 1000;
const MAX_CACHED_ARTICLES = 2000;
const SUMMARY_MAX_LEN = 280;
const SNAPSHOT_TTL_MS = MAX_POLL_INTERVAL_MS;
const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const READ_STATE_TTL_MS = 60 * 24 * 60 * 60 * 1000;

const UA =
  "Mozilla/5.0 (compatible; Hydra/1.0; +https://hydra.launcher) RSS-Reader";

const sha1 = (input: string): string =>
  createHash("sha1").update(input).digest("hex");

const inferLabelFromUrl = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const stripHtml = (html: string | null | undefined): string | null => {
  if (!html) return null;
  const $ = cheerio.load(html);
  $("script, style").remove();
  const root: cheerio.Cheerio<any> = $.root();
  const text = root.text().replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (text.length <= SUMMARY_MAX_LEN) return text;
  const slice = text.slice(0, SUMMARY_MAX_LEN);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > 100 ? slice.slice(0, lastSpace) : slice) + "…";
};

const parseDateToMs = (raw: string | null | undefined): number => {
  if (!raw) return Date.now();
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : Date.now();
};

const findAbsoluteLink = (
  root: cheerio.CheerioAPI,
  item: AnyNode,
  isAtom: boolean
): string | null => {
  const $it = root(item);
  if (isAtom) {
    let altLink: string | null = null;
    let normalLink: string | null = null;
    for (const el of $it.find("link").toArray()) {
      const $link = root(el);
      const rel = ($link.attr("rel") || "").toLowerCase();
      const href = $link.attr("href");
      if (!href) continue;
      if (rel === "alternate") {
        altLink = href;
        break;
      }
      if (!normalLink && /^https?:\/\//i.test(href)) {
        normalLink = href;
      }
    }
    if (altLink && /^https?:\/\//i.test(altLink)) return altLink;
    if (normalLink) return normalLink;
    return null;
  }
  const text = $it.find("link").first().text().trim();
  if (/^https?:\/\//i.test(text)) return text;
  return text.length > 0 ? text : null;
};

const findGuid = (
  root: cheerio.CheerioAPI,
  item: AnyNode,
  isAtom: boolean,
  resolvedLink: string | null,
  title: string,
  feedUrl: string
): string => {
  const $it = root(item);
  const direct = (isAtom ? $it.find("id") : $it.find("guid"))
    .first()
    .text()
    .trim();
  if (direct) return direct;
  if (resolvedLink) return resolvedLink;
  return sha1(`${feedUrl}:${title}`);
};

const findThumbnail = (
  root: cheerio.CheerioAPI,
  item: AnyNode,
  isAtom: boolean,
  feedUrl: string
): string | null => {
  const $it = root(item);
  if (isAtom) {
    let thumb: string | null = null;
    for (const el of $it.find("media\\:thumbnail, media\\:content").toArray()) {
      const $m = root(el);
      const url = $m.attr("url");
      const medium = ($m.attr("medium") || "").toLowerCase();
      if (url && (medium === "" || medium === "image")) {
        thumb = url;
        break;
      }
    }
    if (thumb) return thumb;
  }
  let enclosureImage: string | null = null;
  let enclosureAny: string | null = null;
  for (const el of $it.find("enclosure").toArray()) {
    const $e = root(el);
    const type = ($e.attr("type") || "").toLowerCase();
    const url = $e.attr("url");
    if (!url) continue;
    if (type.startsWith("image/")) {
      enclosureImage = url;
      break;
    }
    if (!enclosureAny && /\.(jpe?g|png|gif|webp|avif|bmp)(\?|$)/i.test(url)) {
      enclosureAny = url;
    }
  }
  if (enclosureImage) return enclosureImage;
  if (enclosureAny) return enclosureAny;
  try {
    const host = new URL(feedUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
  } catch {
    return null;
  }
};

const findCategories = (
  root: cheerio.CheerioAPI,
  item: AnyNode,
  isAtom: boolean
): string[] => {
  const $it = root(item);
  const out = new Set<string>();
  $it.find("category").each((_, el) => {
    const $c = root(el);
    const text = isAtom ? $c.attr("term") || $c.text() : $c.text();
    const trimmed = text?.trim();
    if (trimmed) out.add(trimmed);
  });
  return Array.from(out);
};

const parseFeed = (body: string, feed: RssFeed): NewsArticle[] => {
  const articles: NewsArticle[] = [];
  // cheerio.load is synchronous and does NOT throw on malformed XML — it
  // returns a degraded DOM. We therefore don't wrap it in try/catch; bail out
  // only on structurally empty/binary input.
  if (!body || body.length < 10) {
    return [];
  }
  const root: cheerio.CheerioAPI = cheerio.load(body, { xml: true });

  const isAtom = root("feed > entry").length > 0;
  const itemSelector = isAtom ? "entry" : "channel > item";
  const itemNodes = root(itemSelector);

  itemNodes.each((_, item) => {
    try {
      const $it = root(item);
      const title = ($it.find("title").first().text() || "Untitled").trim();
      if (!title) return;
      const link = findAbsoluteLink(root, item, isAtom);
      const guid = findGuid(root, item, isAtom, link, title, feed.url);
      const pubDateRaw = isAtom
        ? $it.find("published").first().text() ||
          $it.find("updated").first().text()
        : $it.find("pubDate").first().text();
      const summaryRaw = isAtom
        ? $it.find("summary").first().html() ||
          ($it.find("content").first().html() ?? null)
        : $it.find("description").first().html();
      const authorRaw = isAtom
        ? $it.find("author name").first().text().trim() || null
        : $it.find("author").first().text().trim() || null;
      const summary = stripHtml(summaryRaw);
      const thumbnail = findThumbnail(root, item, isAtom, feed.url);
      const categories = findCategories(root, item, isAtom);

      articles.push({
        guid,
        feedUrl: feed.url,
        feedLabel: feed.label,
        title,
        link: link ?? feed.url,
        author: authorRaw,
        pubDate: parseDateToMs(pubDateRaw),
        summary,
        thumbnailUrl: thumbnail,
        categories,
      });
    } catch (err) {
      logger.warn(`News: failed to parse an item in ${feed.url}`, err);
    }
  });

  return articles;
};

class NewsServiceClass {
  private client: AxiosInstance;
  private backoffMs = new Map<string, number>();
  private lastPollAt = 0;
  private cachedSnapshot: NewsSnapshot | null = null;
  private isPolling = false;
  private inFlightPoll: Promise<NewsSnapshot> | null = null;
  private lastPruneAt = 0;
  // Single-flight guarantee for seeding default feeds on first run.
  // Without this, the first renderer-side getNewsSnapshot() call may race
  // against init() (fired from main-loop) and observe an empty feed list.
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.client = axios.create({
      timeout: 10_000,
      headers: {
        "User-Agent": UA,
        Accept:
          "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8",
      },
      responseType: "text",
      validateStatus: (s) => s >= 200 && s < 400,
    });
  }

  private broadcastUnreadCount(count: number): void {
    try {
      if (WindowManager.mainWindow) {
        WindowManager.mainWindow.webContents.send("onUnreadNewsCountUpdated", {
          count,
        });
      }
    } catch (err) {
      logger.warn("News: failed to broadcast unread count", err);
    }
  }

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      try {
        const existing = await newsFeedsSublevel.values().all();
        if (existing.length === 0) {
          const now = Date.now();
          for (const feed of DEFAULT_FEEDS) {
            await newsFeedsSublevel.put(feed.url, {
              url: feed.url,
              label: feed.label,
              enabled: true,
              isDefault: true,
              addedAt: now,
              lastFetchAt: null,
              lastError: null,
              etag: null,
              lastModified: null,
            });
          }
          logger.info(
            `News: seeded ${DEFAULT_FEEDS.length} default feeds on first run`
          );
        }
      } catch (err) {
        logger.error("News: init failed", err);
        // Reset so a later caller can retry.
        this.initPromise = null;
      }
    })();
    return this.initPromise;
  }

  async listFeeds(): Promise<RssFeed[]> {
    return listNewsFeeds();
  }

  async addFeed(input: { url: string; label?: string }): Promise<RssFeed> {
    let parsed: URL;
    try {
      parsed = new URL(input.url);
    } catch {
      throw new Error("news/invalid-url");
    }
    if (!/^https?:$/.test(parsed.protocol)) {
      throw new Error("news/invalid-url");
    }
    const canonical = parsed.toString();

    const existing = await newsFeedsSublevel.get(canonical).catch(() => null);
    if (existing) {
      throw new Error("news/feed-exists");
    }

    const label = input.label?.trim() || inferLabelFromUrl(canonical);
    const feed: RssFeed = {
      url: canonical,
      label,
      enabled: false, // stays disabled until a successful first fetch.
      isDefault: false,
      addedAt: Date.now(),
      lastFetchAt: null,
      lastError: null,
      etag: null,
      lastModified: null,
    };

    // Verify the feed is fetchable BEFORE persisting it. If the fetch fails
    // we surface the error to the UI and the sublevel stays untouched, so no
    // broken URL ever enters the polling loop.
    try {
      await this.pollFeed(feed);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const fetchFailed = new Error(message) as Error & {
        code?: string;
      };
      fetchFailed.code = "news/fetch-failed";
      throw fetchFailed;
    }

    await upsertNewsFeed({ ...feed, enabled: true });
    return { ...feed, enabled: true };
  }

  async removeFeed(url: string): Promise<void> {
    await deleteNewsFeed(url);
    this.backoffMs.delete(url);
    this.invalidateSnapshot();
  }

  async toggleFeed(url: string, enabled: boolean): Promise<void> {
    const existing = await newsFeedsSublevel.get(url).catch(() => null);
    if (!existing) return;
    await upsertNewsFeed({ ...existing, enabled });
    this.invalidateSnapshot();
  }

  async listReadGuids(): Promise<string[]> {
    const keys: string[] = [];
    for await (const [key] of newsReadStateSublevel.iterator()) {
      keys.push(key);
    }
    return keys;
  }

  invalidateSnapshot(): void {
    this.cachedSnapshot = null;
  }

  async getSnapshot(forceRefresh = false): Promise<NewsSnapshot> {
    // Make sure default feeds are seeded before we attempt to read a snapshot;
    // otherwise the very first call sees an empty feed list and the user must
    // hit Refresh to recover.
    await this.init();

    const isFresh =
      this.cachedSnapshot &&
      !forceRefresh &&
      Date.now() - this.lastPollAt < SNAPSHOT_TTL_MS;
    if (isFresh && this.cachedSnapshot) return this.cachedSnapshot;
    return this.runPoll();
  }

  async pollOnce(): Promise<NewsSnapshot> {
    return this.runPoll();
  }

  private async runPoll(): Promise<NewsSnapshot> {
    if (this.isPolling && this.inFlightPoll) {
      return this.inFlightPoll;
    }
    this.isPolling = true;
    const promise = this.doPoll();
    this.inFlightPoll = promise;
    try {
      return await promise;
    } finally {
      this.isPolling = false;
      this.inFlightPoll = null;
    }
  }

  private async doPoll(): Promise<NewsSnapshot> {
    try {
      const feeds = await listNewsFeeds();
      const enabledFeeds = feeds.filter((f) => f.enabled);

      const results = await Promise.allSettled(
        enabledFeeds.map((feed) => this.pollFeed(feed))
      );

      const updatedFeeds = await listNewsFeeds();
      const deduped = new Map<string, NewsArticle>();
      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        for (const article of r.value) {
          deduped.set(article.guid, article);
        }
      }
      const articles = Array.from(deduped.values())
        .sort((a, b) => b.pubDate - a.pubDate)
        .slice(0, MAX_CACHED_ARTICLES);

      const totalUnread = await this.countUnread(articles);

      const snapshot: NewsSnapshot = {
        feeds: updatedFeeds,
        articles,
        fetchedAt: Date.now(),
        totalUnread,
      };
      this.cachedSnapshot = snapshot;
      this.lastPollAt = Date.now();
      this.broadcastUnreadCount(totalUnread);

      if (Date.now() - this.lastPruneAt > PRUNE_INTERVAL_MS) {
        this.lastPruneAt = Date.now();
        pruneOldReadStates(READ_STATE_TTL_MS)
          .then((n) => {
            if (n > 0)
              logger.info(`News: pruned ${n} stale read-state entries`);
          })
          .catch(() => {});
      }

      return snapshot;
    } catch (err) {
      logger.error("News: poll failed", err);
      return (
        this.cachedSnapshot ?? {
          feeds: [],
          articles: [],
          fetchedAt: Date.now(),
          totalUnread: 0,
        }
      );
    }
  }

  private async pollFeed(feed: RssFeed): Promise<NewsArticle[]> {
    const backoff = this.backoffMs.get(feed.url) ?? 0;
    const nextEligibleAt = feed.lastFetchAt ? feed.lastFetchAt + backoff : 0;
    if (Date.now() < nextEligibleAt) {
      const cached = this.cachedSnapshot?.articles.filter(
        (a) => a.feedUrl === feed.url
      );
      return cached ?? [];
    }

    try {
      const response = await this.client.get<string>(feed.url);
      const body = typeof response.data === "string" ? response.data : "";
      const articles = parseFeed(body, feed);

      await upsertNewsFeed({
        ...feed,
        lastFetchAt: Date.now(),
        lastError: null,
        etag: response.headers["etag"]
          ? String(response.headers["etag"])
          : (feed.etag ?? null),
        lastModified:
          (response.headers["last-modified"] as string | undefined) ??
          feed.lastModified ??
          null,
      });
      this.backoffMs.delete(feed.url);
      return articles;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const prevBackoff = this.backoffMs.get(feed.url) ?? MAX_POLL_INTERVAL_MS;
      const doubled = Math.min(MAX_BACKOFF_MS, prevBackoff * 2);
      const jittered = doubled * (0.9 + Math.random() * 0.2);
      this.backoffMs.set(feed.url, jittered);
      logger.warn(`News: fetch failed for ${feed.url} — backing off`, message);
      try {
        await upsertNewsFeed({
          ...feed,
          lastFetchAt: Date.now(),
          lastError: message.slice(0, 280),
        });
      } catch {
        // ignore
      }
      return [];
    }
  }

  private async countUnread(articles: NewsArticle[]): Promise<number> {
    let count = 0;
    for (const a of articles) {
      const read = await newsReadStateSublevel.get(a.guid).catch(() => null);
      if (!read) count++;
    }
    return count;
  }

  async markRead(guid: string): Promise<{ guid: string; readAt: number }> {
    const readAt = Date.now();
    await newsReadStateSublevel.put(guid, { readAt });
    if (this.cachedSnapshot) {
      const isInSnapshot = this.cachedSnapshot.articles.some(
        (a) => a.guid === guid
      );
      if (isInSnapshot) {
        this.cachedSnapshot = {
          ...this.cachedSnapshot,
          totalUnread: Math.max(0, this.cachedSnapshot.totalUnread - 1),
        };
        this.broadcastUnreadCount(this.cachedSnapshot.totalUnread);
      }
    }
    return { guid, readAt };
  }

  async markAllRead(): Promise<{ count: number }> {
    if (!this.cachedSnapshot) {
      return { count: 0 };
    }
    const now = Date.now();
    let count = 0;
    for (const a of this.cachedSnapshot.articles) {
      const existing = await newsReadStateSublevel
        .get(a.guid)
        .catch(() => null);
      if (!existing) {
        await newsReadStateSublevel.put(a.guid, { readAt: now });
        count++;
      }
    }
    this.cachedSnapshot = { ...this.cachedSnapshot, totalUnread: 0 };
    this.broadcastUnreadCount(0);
    return { count };
  }

  async clearAllReadHistory(): Promise<void> {
    await clearAllReadStates();
    if (this.cachedSnapshot) {
      const totalUnread = await this.countUnread(this.cachedSnapshot.articles);
      this.cachedSnapshot = { ...this.cachedSnapshot, totalUnread };
      this.broadcastUnreadCount(totalUnread);
    }
  }
}

export const NewsService = new NewsServiceClass();
