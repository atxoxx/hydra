import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import List from "rc-virtual-list";
import {
  GearIcon,
  MailIcon,
  MarkGithubIcon,
  SunIcon,
  SyncIcon,
  CheckIcon,
} from "@primer/octicons-react";
import cn from "classnames";

import { Button, TextField } from "@renderer/components";
import { setHeaderTitle } from "@renderer/features";
import { useAppDispatch, useAppSelector, useToast } from "@renderer/hooks";
import { settingsContext } from "@renderer/context";
import { useContext } from "react";
import type { NewsArticle, NewsSnapshot, RssFeed } from "@types";
import { ArticleCard } from "./article-card";
import { NewsSettingsModal } from "./news-settings-modal";
import { ArticleInlineModal } from "./article-inline-modal";
import "./news.scss";

const VIRTUAL_LIST_HEIGHT = 600;
// Must comfortably fit a row at the wide-screen breakpoint (>=1100px): the
// SCSS doubles the padding (40px vertical) and grows the thumbnail to 96px,
// so the minimum row height there is ~140px before any title/summary
// content. 168 leaves headroom for 2-line title + 2-line summary +
// text-label action buttons on the right without the rc-virtual-list
// overlapping consecutive rows (which the user saw as bottom cutouts).
const VIRTUAL_LIST_ROW_HEIGHT = 168;

export default function News() {
  const dispatch = useAppDispatch();
  const { showSuccessToast, showErrorToast } = useToast();
  const { t } = useTranslation(["news", "sidebar"]);
  const { updateUserPreferences } = useContext(settingsContext);
  const newsShowOnlyUnreadPref = useAppSelector(
    (state) => state.userPreferences.value?.newsShowOnlyUnread
  );

  const [snapshot, setSnapshot] = useState<NewsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<{
    article: NewsArticle;
    mode: "inline";
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSourceFilter, setActiveSourceFilter] = useState<string | null>(
    null
  );
  const [readGuids, setReadGuids] = useState<Set<string>>(new Set());

  const refresh = useCallback(
    async (force = false) => {
      if (force) setIsRefreshing(true);
      try {
        const next = await window.electron.getNewsSnapshot(force);
        setSnapshot(next);
        // If the active source filter no longer references an enabled feed,
        // clear it so the user isn't stranded on an empty filter.
        setActiveSourceFilter((prev) => {
          if (prev === null) return null;
          return next.feeds.some((f) => f.url === prev && f.enabled)
            ? prev
            : null;
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        showErrorToast(t("news_refresh_failed", { message }));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [showErrorToast, t]
  );

  // Seed read-guids ONCE on mount so "Show only unread" is correct after a restart.
  useEffect(() => {
    let cancelled = false;
    window.electron
      .listNewsReadGuids()
      .then((guids) => {
        if (!cancelled) setReadGuids(new Set(guids));
      })
      .catch(() => {
        if (!cancelled) setReadGuids(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    dispatch(setHeaderTitle(t("news")));
    void refresh(false);
  }, [dispatch, refresh, t]);

  // Default the filter OFF so that clicking an article does NOT cause it to
  // vanish from the list. Read articles stay in the list and get dimmed via
  // the `news__row--read` modifier. Users who want to focus on unread only
  // can explicitly toggle the "Unread" chip on.
  const showOnlyUnread = newsShowOnlyUnreadPref === true;

  const filteredArticles = useMemo(() => {
    if (!snapshot) return [];
    const q = searchQuery.trim().toLowerCase();
    return snapshot.articles.filter((article) => {
      if (
        activeSourceFilter !== null &&
        article.feedUrl !== activeSourceFilter
      ) {
        return false;
      }
      if (showOnlyUnread && readGuids.has(article.guid)) {
        return false;
      }
      if (!q) return true;
      const haystack = (
        article.title +
        " " +
        article.feedLabel +
        " " +
        (article.summary ?? "")
      ).toLowerCase();
      return haystack.includes(q);
    });
  }, [snapshot, activeSourceFilter, showOnlyUnread, readGuids, searchQuery]);

  const handleMarkRead = useCallback(async (guid: string) => {
    try {
      await window.electron.markNewsArticleRead(guid);
      setReadGuids((prev) => {
        const next = new Set(prev);
        next.add(guid);
        return next;
      });
    } catch {
      // ignore — UI optimistic update already applied
    }
  }, []);

  const handleOpenArticle = useCallback(
    async (article: NewsArticle, mode: "inline" | "external") => {
      await handleMarkRead(article.guid);
      if (mode === "external") {
        try {
          await window.electron.openExternal(article.link);
        } catch {
          showErrorToast(t("news_open_external_failed"));
        }
        return;
      }
      setSelectedArticle({ article, mode: "inline" });
    },
    [handleMarkRead, showErrorToast, t]
  );

  const handleMarkAllRead = useCallback(async () => {
    try {
      const result = await window.electron.markAllNewsRead();
      showSuccessToast(t("news_mark_all_done", { count: result.count }));
      setReadGuids((prev) => {
        const next = new Set(prev);
        for (const a of filteredArticles) next.add(a.guid);
        return next;
      });
    } catch {
      showErrorToast(t("news_mark_all_failed"));
    }
  }, [filteredArticles, showErrorToast, showSuccessToast, t]);

  const handleToggleShowOnlyUnread = useCallback(() => {
    void updateUserPreferences({ newsShowOnlyUnread: !showOnlyUnread });
  }, [showOnlyUnread, updateUserPreferences]);

  return (
    <section className="news__container">
      <div className="news__page-header">
        <div className="news__page-header-left">
          <h1 className="news__page-title">
            <MailIcon size={20} />
            <span>{t("news")}</span>
            {snapshot && snapshot.totalUnread > 0 && (
              <span className="news__unread-badge">
                {snapshot.totalUnread > 99 ? "99+" : snapshot.totalUnread}
              </span>
            )}
          </h1>
        </div>
        <div className="news__page-header-right">
          <Button
            type="button"
            theme="outline"
            onClick={() => void refresh(true)}
            disabled={isRefreshing}
          >
            <SyncIcon size={16} className={cn({ news__spin: isRefreshing })} />
            <span>{t("news_refresh")}</span>
          </Button>
          <Button
            type="button"
            theme="outline"
            onClick={handleMarkAllRead}
            disabled={filteredArticles.length === 0}
          >
            <CheckIcon size={16} />
            <span>{t("news_mark_all")}</span>
          </Button>
          <Button
            type="button"
            theme="primary"
            onClick={() => setShowSettings(true)}
          >
            <GearIcon size={16} />
            <span>{t("news_settings")}</span>
          </Button>
        </div>
      </div>

      <div className="news__toolbar">
        <TextField
          label={t("news_search_label")}
          placeholder={t("news_search_placeholder")}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          theme="dark"
        />
        <div
          className="news__chip-row"
          role="group"
          aria-label={t("news_filter_aria")}
        >
          <button
            type="button"
            className={cn("news__chip", {
              "news__chip--active": activeSourceFilter === null,
            })}
            onClick={() => setActiveSourceFilter(null)}
          >
            {t("news_chip_all")}
          </button>
          {(snapshot?.feeds ?? [])
            .filter((feed: RssFeed) => feed.enabled)
            .map((feed: RssFeed) => (
              <button
                key={feed.url}
                type="button"
                className={cn("news__chip", {
                  "news__chip--active": activeSourceFilter === feed.url,
                })}
                onClick={() => {
                  setActiveSourceFilter((prev) =>
                    prev === feed.url ? null : feed.url
                  );
                }}
              >
                {feed.label}
              </button>
            ))}
          <button
            type="button"
            className={cn("news__chip", {
              "news__chip--active": showOnlyUnread,
            })}
            onClick={handleToggleShowOnlyUnread}
          >
            {t("news_chip_unread")}
          </button>
        </div>
      </div>

      <div className="news__list">
        {isLoading && (
          <div className="news__placeholder">
            <SunIcon size={24} />
            <p>{t("news_loading")}</p>
          </div>
        )}
        {!isLoading && filteredArticles.length === 0 && (
          <div className="news__placeholder">
            {snapshot && snapshot.feeds.length > 0 ? (
              <>
                <MarkGithubIcon size={24} />
                <p>{t("news_empty")}</p>
              </>
            ) : (
              <>
                <MailIcon size={24} />
                <p>{t("news_empty_filtered")}</p>
                <Button
                  type="button"
                  theme="primary"
                  onClick={() => setShowSettings(true)}
                >
                  {t("news_add_first_feed")}
                </Button>
              </>
            )}
          </div>
        )}
        {!isLoading && filteredArticles.length > 0 && (
          <List
            height={VIRTUAL_LIST_HEIGHT}
            data={filteredArticles}
            itemHeight={VIRTUAL_LIST_ROW_HEIGHT}
            itemKey={(article) => article.guid}
            className="news__virtual-list"
          >
            {(article) => (
              <ArticleCard
                article={article}
                read={readGuids.has(article.guid)}
                onOpen={(mode) => void handleOpenArticle(article, mode)}
              />
            )}
          </List>
        )}
      </div>

      <NewsSettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        onChanged={() => void refresh(true)}
      />

      <ArticleInlineModal
        article={selectedArticle?.article ?? null}
        visible={selectedArticle !== null}
        onClose={() => setSelectedArticle(null)}
        onOpenExternal={async () => {
          const article = selectedArticle?.article;
          if (article) {
            try {
              await window.electron.openExternal(article.link);
            } catch {
              showErrorToast(t("news_open_external_failed"));
            }
          }
          setSelectedArticle(null);
        }}
      />
    </section>
  );
}
