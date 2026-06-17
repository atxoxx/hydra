import { useTranslation } from "react-i18next";
import { EyeIcon, LinkExternalIcon } from "@primer/octicons-react";
import type { NewsArticle } from "@types";

export interface ArticleCardProps {
  article: NewsArticle;
  read: boolean;
  onOpen: (mode: "inline" | "external") => void;
}

const formatPubDate = (ms: number): string => {
  try {
    const d = new Date(ms);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

export function ArticleCard({ article, read, onOpen }: ArticleCardProps) {
  const { t } = useTranslation("news");

  // Article rows are not clickable anymore — the user clicks one of the
  // two explicit action buttons at the right edge ("Open inline" / "Open
  // externally"). Both buttons automatically mark the article as read via
  // the parent's onOpen handler.
  return (
    <div className={`news__row ${read ? "news__row--read" : ""}`}>
      {article.thumbnailUrl && (
        <img
          src={article.thumbnailUrl}
          alt=""
          className="news__row-thumb"
          loading="lazy"
          onError={(event) => {
            (event.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      <div className="news__row-body">
        <div className="news__row-meta">
          <span className="news__row-source">{article.feedLabel}</span>
          <span className="news__row-divider">•</span>
          <span className="news__row-date">
            {formatPubDate(article.pubDate)}
          </span>
          {!read && <span className="news__row-dot" aria-hidden="true" />}
        </div>
        <div className="news__row-title">{article.title}</div>
        {article.summary && (
          <div className="news__row-summary">{article.summary}</div>
        )}
      </div>

      <div className="news__row-actions">
        <button
          type="button"
          className="news__row-action"
          onClick={() => onOpen("inline")}
          title={t("news_open_inline")}
          aria-label={t("news_open_inline")}
        >
          <EyeIcon size={14} />
          <span>{t("news_open_inline")}</span>
        </button>
        <button
          type="button"
          className="news__row-action"
          onClick={() => onOpen("external")}
          title={t("news_open_external")}
          aria-label={t("news_open_external")}
        >
          <LinkExternalIcon size={14} />
          <span>{t("news_open_external")}</span>
        </button>
      </div>
    </div>
  );
}
