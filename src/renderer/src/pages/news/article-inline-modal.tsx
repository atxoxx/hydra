import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LinkExternalIcon,
  SyncIcon,
  XIcon,
  GlobeIcon,
} from "@primer/octicons-react";

import { Button, Modal } from "@renderer/components";
import type { NewsArticle } from "@types";

const WEBVIEW_LOAD_TIMEOUT_MS = 12000;
// Cap retries on inline preview failure to avoid the user clicking
// Retry forever on a URL that the publisher genuinely cannot embed.
const MAX_RETRIES = 2;

export interface ArticleInlineModalProps {
  article: NewsArticle | null;
  visible: boolean;
  onClose: () => void;
  onOpenExternal: () => void;
}

function formatPubDate(ms: number): string {
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type InlineState = "loading" | "ready" | "blocked";

export function ArticleInlineModal({
  article,
  visible,
  onClose,
  onOpenExternal,
}: ArticleInlineModalProps) {
  const { t } = useTranslation("news");
  const [state, setState] = useState<InlineState>("loading");
  const [retryCount, setRetryCount] = useState(0);
  // Match the established pattern in src/renderer/src/pages/game-details/
  // website-links-panel/website-links-iframe.tsx. The Electron renderer
  // <webview> ref doesn't have a clean typed surface here, so `any` is
  // the pragmatic choice over fighting @types/electron namespace types.
  const webviewRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Remount the webview when retrying or when a different article opens.
  const webviewKey = `${article?.guid ?? "none"}-${retryCount}`;

  // Reset state when modal closes.
  useEffect(() => {
    if (!visible) {
      setState("loading");
    }
  }, [visible]);

  // Drive the load state machine. We use BOTH a wall-clock timeout AND
  // webview events (`dom-ready`, `did-fail-load`). The timeout catches
  // publishers that hang indefinitely without firing DOM-ready; events
  // catch the common path. If `dom-ready` fires we treat the article
  // as loaded — even though publisher pages may include heavy remote
  // assets, the document is reachable for the user to scroll.
  //
  // The webview lives in the renderer but uses session
  // "persist:website-previews" — see main/services/window-manager.ts,
  // which strips x-frame-options and CSP frame-ancestors on every
  // response. That's why Eurogamer/IGN/etc. embed successfully here
  // when they refuse to load in a plain <iframe>.
  useEffect(() => {
    if (!visible || !article) return;
    setState("loading");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setState((current) => (current === "loading" ? "blocked" : current));
    }, WEBVIEW_LOAD_TIMEOUT_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, article?.guid, retryCount]);

  // Subscribe to webview events when the webview DOM node is available.
  // Note: Electron's <webview> events dispatch as native DOM Event with
  // properties on the event root (NOT CustomEvent.detail). We type the
  // handler as `(e: any)` and read directly: `e.errorCode`,
  // `e.preventDefault()`, `e.url`. This matches the working pattern
  // in website-links-iframe.tsx.
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleDomReady = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setState((current) => (current === "loading" ? "ready" : current));
    };

    const handleDidFailLoad = (e: any) => {
      // -3 ERR_ABORTED: redirected / cancelled navigation. Don't treat
      // as blocked — it's a normal subresource race.
      if (e.errorCode === -3) return;

      // Fatal errors: -2 ERR_FAILED, -6 ERR_FILE_NOT_FOUND,
      // -10 ERR_ACCESS_DENIED, -20 ERR_BLOCKED_BY_CLIENT,
      // -21 ERR_BLOCKED_BY_RESPONSE (CSP that survived our strip).
      const fatalErrors = [-2, -6, -10, -20, -21];
      if (fatalErrors.includes(e.errorCode)) {
        if (timerRef.current) clearTimeout(timerRef.current);
        setState("blocked");
      }
    };

    const handleNewWindow = (e: any) => {
      e.preventDefault();
      window.electron.openExternal(e.url);
    };

    webview.addEventListener("dom-ready", handleDomReady);
    webview.addEventListener("did-fail-load", handleDidFailLoad);
    webview.addEventListener("new-window", handleNewWindow);

    return () => {
      webview.removeEventListener("dom-ready", handleDomReady);
      webview.removeEventListener("did-fail-load", handleDidFailLoad);
      webview.removeEventListener("new-window", handleNewWindow);
    };
  }, [article?.guid, retryCount]);

  const handleTryAgain = useCallback(() => {
    // Guard at the action layer too: clicking the button is no-op once
    // we've exhausted retries. (The button itself is hidden, but
    // defensive guard avoids setState churn.)
    setRetryCount((n) => {
      if (n >= MAX_RETRIES) return n;
      return n + 1;
    });
    setState("loading");
  }, []);

  return (
    <Modal
      visible={visible && article !== null}
      title={article?.title?.trim() || article?.feedLabel || ""}
      onClose={onClose}
      large
    >
      {article && (
        <div className="article-inline">
          {/* Persistent meta header. Always visible so the user
           * has source / date / author / title context plus the
           * global actions (Open in browser, Close) even if the
           * webview behind it fails to load. */}
          <div className="article-inline__header">
            {article.thumbnailUrl && (
              <img
                src={article.thumbnailUrl}
                alt=""
                className="article-inline__header-thumb"
                loading="lazy"
                onError={(event) => {
                  (event.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <div className="article-inline__header-body">
              <div className="article-inline__header-meta">
                <span className="article-inline__header-source">
                  {article.feedLabel}
                </span>
                <span aria-hidden="true">•</span>
                <span>{formatPubDate(article.pubDate)}</span>
                {article.author && (
                  <>
                    <span aria-hidden="true">•</span>
                    <span>{article.author}</span>
                  </>
                )}
              </div>
              <h2 className="article-inline__header-title">{article.title}</h2>
            </div>
            <div className="article-inline__header-actions">
              <Button type="button" theme="primary" onClick={onOpenExternal}>
                <LinkExternalIcon size={14} />
                <span>{t("news_open_external")}</span>
              </Button>
              <Button type="button" theme="outline" onClick={onClose}>
                <XIcon size={14} />
                <span>{t("news_close")}</span>
              </Button>
            </div>
          </div>

          <div className="article-inline__viewport">
            {/* The <webview> tag uses session
             * "persist:website-previews" — that session strips
             * X-Frame-Options and CSP frame-ancestors from
             * responses (see main/services/window-manager.ts),
             * so publishers that block standard <iframe>
             * embedding (Eurogamer, IGN, etc.) load normally
             * here. The user always sees the article. */}
            {/* eslint-disable react/no-unknown-property */}
            {/* The `partition="persist:website-previews"` attribute
             * selects the isolated preview session configured in
             * main/services/window-manager.ts. That session
             * strips X-Frame-Options and CSP frame-ancestors on
             * every response, so publishers that block standard
             * <iframe> embedding (Eurogamer, IGN, GameSpot, ...)
             * load normally here. Note on referrer policy:
             * Chromium's default for the webview's initial
             * cross-origin navigation is
             * `strict-origin-when-cross-origin`, which means the
             * renderer origin (file://...hydra) MAY appear in the
             * Referer header of publisher URLs. Electron does not
             * document a Referer-policy webpreference key.
             * Subresource Referer is already rewritten by
             * `previewSession.onBeforeSendHeaders`. We accept the
             * small main-frame navigation leak as a known
             * limitation. */}
            <webview
              key={webviewKey}
              ref={webviewRef}
              src={article.link}
              partition="persist:website-previews"
              className={`article-inline__webview${
                state === "blocked" ? " article-inline__webview--hidden" : ""
              }`}
              title={article.title}
            />
            {/* eslint-enable react/no-unknown-property */}

            {state === "blocked" && (
              <div className="article-inline__blocked-overlay">
                <GlobeIcon
                  size={32}
                  className="article-inline__blocked-overlay-icon"
                />
                <div className="article-inline__blocked-overlay-body">
                  <strong>{t("news_inline_blocked_title")}</strong>
                  <p>{t("news_inline_blocked_body")}</p>
                  {article.summary && (
                    <div className="article-inline__blocked-overlay-summary">
                      {article.summary}
                    </div>
                  )}
                </div>
                <div className="article-inline__blocked-overlay-actions">
                  <Button
                    type="button"
                    theme="primary"
                    onClick={onOpenExternal}
                  >
                    <LinkExternalIcon size={14} />
                    <span>{t("news_open_external")}</span>
                  </Button>
                  {retryCount < MAX_RETRIES && (
                    <Button
                      type="button"
                      theme="outline"
                      onClick={handleTryAgain}
                    >
                      <SyncIcon size={14} />
                      <span>{t("news_inline_retry")}</span>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
