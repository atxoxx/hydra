import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  SyncIcon,
  HomeIcon,
  LinkExternalIcon,
  CopyIcon,
  LockIcon,
  GlobeIcon,
  CheckIcon,
} from "@primer/octicons-react";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";

import type { WebsiteLink } from "@renderer/services/website-links.service";
import { WEBSITE_LOGOS } from "@renderer/assets/website-logos";

interface WebsiteLinksIframeProps {
  link: WebsiteLink;
}

export function WebsiteLinksIframe({ link }: WebsiteLinksIframeProps) {
  const { t } = useTranslation("game_details");
  const webviewRef = useRef<any>(null);

  const [currentUrl, setCurrentUrl] = useState(link.url);
  const [inputValue, setInputValue] = useState(link.url);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [copied, setCopied] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleOpenInBrowser = useCallback(() => {
    window.electron.openExternal(currentUrl);
  }, [currentUrl]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(currentUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [currentUrl]);

  const handleGoBack = useCallback(() => {
    const webview = webviewRef.current;
    if (webview && webview.canGoBack()) {
      webview.goBack();
    }
  }, []);

  const handleGoForward = useCallback(() => {
    const webview = webviewRef.current;
    if (webview && webview.canGoForward()) {
      webview.goForward();
    }
  }, []);

  const handleReload = useCallback(() => {
    const webview = webviewRef.current;
    if (webview) {
      webview.reload();
    }
  }, []);

  const handleGoHome = useCallback(() => {
    const webview = webviewRef.current;
    if (webview) {
      webview.loadURL(link.url);
    }
  }, [link.url]);

  const handleAddressSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const webview = webviewRef.current;
      if (!webview || !inputValue.trim()) return;

      let targetUrl = inputValue.trim();
      // Prepend https:// if it doesn't start with a protocol (http:// or https:// or file://)
      if (!/^https?:\/\//i.test(targetUrl) && !/^file:\/\//i.test(targetUrl)) {
        targetUrl = "https://" + targetUrl;
      }

      webview.loadURL(targetUrl);
    },
    [inputValue]
  );

  // Sync webview state on navigation
  const updateNavigationState = useCallback(() => {
    const webview = webviewRef.current;
    if (webview) {
      try {
        const url = webview.getURL();
        setCurrentUrl(url);
        setInputValue(url);
        setCanGoBack(webview.canGoBack());
        setCanGoForward(webview.canGoForward());
      } catch {
        /* webview not fully loaded or ready */
      }
    }
  }, []);

  // Sync state when game link tab changes
  useEffect(() => {
    clearTimer();
    setHasError(false);

    if (!link.isEmbeddable) {
      setIsLoading(false);
      setHasError(true);
      return;
    }

    setIsLoading(true);

    const webview = webviewRef.current;
    if (webview) {
      try {
        webview.loadURL(link.url);
      } catch {
        /* webview not mounted/ready yet */
      }
    }

    // 30-second timeout fallback
    timeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setHasError(true);
    }, 30000);

    return () => {
      clearTimer();
    };
  }, [link.url, link.isEmbeddable, clearTimer]);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const onDomReady = () => {
      clearTimer();
      setIsLoading(false);
      setHasError(false);
      updateNavigationState();
    };

    const onDidStartLoading = () => {
      setIsLoading(true);
      setHasError(false);
    };

    const onDidStopLoading = () => {
      setIsLoading(false);
      updateNavigationState();
    };

    const onDidNavigate = () => {
      setHasError(false);
      updateNavigationState();
    };

    const onDidNavigateInPage = () => {
      updateNavigationState();
    };

    const onDidFailLoad = (e: any) => {
      // Ignore non-fatal aborted codes (e.g. -3 ERR_ABORTED on redirects/new navigation requests)
      if (e.errorCode === -3) return;

      clearTimer();
      setIsLoading(false);
      setHasError(true);
    };

    const onNewWindow = (e: any) => {
      e.preventDefault();
      try {
        webview.loadURL(e.url);
      } catch {
        window.electron.openExternal(e.url);
      }
    };

    webview.addEventListener("dom-ready", onDomReady);
    webview.addEventListener("did-start-loading", onDidStartLoading);
    webview.addEventListener("did-stop-loading", onDidStopLoading);
    webview.addEventListener("did-navigate", onDidNavigate);
    webview.addEventListener("did-navigate-in-page", onDidNavigateInPage);
    webview.addEventListener("did-fail-load", onDidFailLoad);
    webview.addEventListener("new-window", onNewWindow);

    return () => {
      webview.removeEventListener("dom-ready", onDomReady);
      webview.removeEventListener("did-start-loading", onDidStartLoading);
      webview.removeEventListener("did-stop-loading", onDidStopLoading);
      webview.removeEventListener("did-navigate", onDidNavigate);
      webview.removeEventListener("did-navigate-in-page", onDidNavigateInPage);
      webview.removeEventListener("did-fail-load", onDidFailLoad);
      webview.removeEventListener("new-window", onNewWindow);
    };
  }, [clearTimer, updateNavigationState]);

  const isHttps = currentUrl.startsWith("https://");

  return (
    <div className="website-links-iframe">
      {/* Premium Browser Toolbar */}
      <div className="website-links-iframe__toolbar">
        <div className="website-links-iframe__nav-controls">
          <button
            type="button"
            className="website-links-iframe__toolbar-button"
            onClick={handleGoBack}
            disabled={!canGoBack}
            title={t("back")}
          >
            <ArrowLeftIcon size={16} />
          </button>
          <button
            type="button"
            className="website-links-iframe__toolbar-button"
            onClick={handleGoForward}
            disabled={!canGoForward}
            title={t("forward")}
          >
            <ArrowRightIcon size={16} />
          </button>
          <button
            type="button"
            className="website-links-iframe__toolbar-button"
            onClick={handleReload}
            title={t("reload")}
          >
            <SyncIcon
              size={16}
              className={isLoading ? "website-links-iframe__spin" : ""}
            />
          </button>
          <button
            type="button"
            className="website-links-iframe__toolbar-button"
            onClick={handleGoHome}
            title={t("home")}
          >
            <HomeIcon size={16} />
          </button>
        </div>

        <form
          onSubmit={handleAddressSubmit}
          className="website-links-iframe__address-form"
        >
          <div className="website-links-iframe__address-bar">
            {isHttps ? (
              <LockIcon
                size={14}
                className="website-links-iframe__security-icon website-links-iframe__security-icon--secure"
              />
            ) : (
              <GlobeIcon
                size={14}
                className="website-links-iframe__security-icon"
              />
            )}
            <input
              type="text"
              className="website-links-iframe__address-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={t("search_or_type_url")}
            />
          </div>
        </form>

        <div className="website-links-iframe__action-controls">
          <button
            type="button"
            className="website-links-iframe__toolbar-button"
            onClick={handleCopyLink}
            title={t(copied ? "link_copied" : "copy_link")}
          >
            {copied ? (
              <span style={{ color: "#16b195", display: "inline-flex" }}>
                <CheckIcon size={16} />
              </span>
            ) : (
              <CopyIcon size={16} />
            )}
          </button>
          <button
            type="button"
            className="website-links-iframe__toolbar-button"
            onClick={handleOpenInBrowser}
            title={t("open_in_browser")}
          >
            <LinkExternalIcon size={16} />
          </button>
        </div>
      </div>

      <div className="website-links-iframe__content">
        {isLoading && !hasError && (
          <SkeletonTheme baseColor="#1c1c1c" highlightColor="#444">
            <div className="website-links-iframe__skeleton">
              <Skeleton
                className="website-links-iframe__skeleton-bar"
                height="100%"
              />
              <div className="website-links-iframe__skeleton-spinner" />
            </div>
          </SkeletonTheme>
        )}

        {hasError && (
          <div className="website-links-iframe__fallback">
            <div className="website-links-iframe__fallback-content">
              <img
                src={WEBSITE_LOGOS[link.iconId]}
                alt=""
                className="website-links-iframe__fallback-icon"
              />
              <p className="website-links-iframe__fallback-name">
                {t(link.name)}
              </p>
              <p className="website-links-iframe__fallback-message">
                {t("preview_unavailable")}
              </p>
              <button
                type="button"
                className="website-links-iframe__fallback-button"
                onClick={handleOpenInBrowser}
              >
                {t("open_in_browser")}
              </button>
            </div>
          </div>
        )}

        {/* eslint-disable react/no-unknown-property */}
        <webview
          ref={webviewRef}
          src={link.url}
          partition="persist:website-previews"
          className={`website-links-iframe__frame ${isLoading ? "website-links-iframe__frame--hidden" : ""}`}
          webpreferences="sandbox=yes, contextIsolation=yes"
          style={{ display: hasError ? "none" : undefined }}
        />
        {/* eslint-enable react/no-unknown-property */}
      </div>
    </div>
  );
}
