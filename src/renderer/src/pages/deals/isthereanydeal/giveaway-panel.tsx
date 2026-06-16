import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { LinkExternalIcon, SyncIcon, ClockIcon } from "@primer/octicons-react";
import type { Giveaway } from "../../../declaration";
import type { DealSourceProps } from "../deal-sources";
import "./giveaway-panel.scss";

const MAX_AUTO_RETRIES = 3;
const AUTO_RETRY_DELAY_MS = 1500;

const ITAD_GIVEAWAYS_URL = "https://isthereanydeal.com/giveaways/";

export function GiveawayPanel(_props: DealSourceProps) {
  const { t } = useTranslation("deals");
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRetryCount, setAutoRetryCount] = useState(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchGiveaways = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setError(null);
      setAutoRetryCount(0);

      let attempt = 0;
      while (attempt < MAX_AUTO_RETRIES) {
        if (!isMountedRef.current) return;

        attempt++;
        if (attempt > 1) {
          setAutoRetryCount(attempt);
          // Wait before retrying
          await new Promise((resolve) =>
            setTimeout(resolve, AUTO_RETRY_DELAY_MS)
          );
          if (!isMountedRef.current) return;
        }

        try {
          const result = await window.electron.getItadGiveaways(forceRefresh);

          if (result.error && result.giveaways.length === 0) {
            // API returned an error with no data — retry
            console.warn(
              `[GiveawayPanel] Attempt ${attempt}/${MAX_AUTO_RETRIES} failed:`,
              result.error
            );
            if (attempt < MAX_AUTO_RETRIES) continue;
            // All retries exhausted
            setError(t("could_not_load_giveaways"));
            setAutoRetryCount(0);
            break;
          }

          // Success (or partial success with stale cache)
          setGiveaways(result.giveaways ?? []);
          setError(null);
          setAutoRetryCount(0);
          break;
        } catch {
          console.warn(
            `[GiveawayPanel] Attempt ${attempt}/${MAX_AUTO_RETRIES} threw an exception`
          );
          if (attempt < MAX_AUTO_RETRIES) continue;
          // All retries exhausted
          setError(t("could_not_load_giveaways"));
          setAutoRetryCount(0);
        }
      }

      if (isMountedRef.current) {
        setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    fetchGiveaways();
  }, [fetchGiveaways]);

  const handleRefresh = useCallback(() => {
    fetchGiveaways(true);
  }, [fetchGiveaways]);

  const formatExpiry = (date: Date | null): string => {
    if (!date) return "";
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return t("expired");
    if (diffDays === 0) return t("expires_today");
    if (diffDays === 1) return t("expires_tomorrow");
    if (diffDays < 7) return t("expires_in_days", { count: diffDays });
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  const getExpiryClass = (date: Date | null): string => {
    if (!date) return "";
    const diffMs = date.getTime() - Date.now();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return "giveaway-panel__card--expired";
    if (diffDays < 2) return "giveaway-panel__card--urgent";
    return "";
  };

  const openLink = (url: string) => {
    try {
      window.electron.openExternal(url);
    } catch {
      window.open(url, "_blank");
    }
  };

  // Auto-retry in progress
  if (loading && autoRetryCount > 0) {
    return (
      <div className="giveaway-panel">
        <div className="giveaway-panel__loading">
          <div className="giveaway-panel__spinner" />
          <p>
            {t("retrying_giveaways", {
              attempt: autoRetryCount,
              max: MAX_AUTO_RETRIES,
            })}
          </p>
        </div>
      </div>
    );
  }

  // Initial loading
  if (loading && giveaways.length === 0) {
    return (
      <div className="giveaway-panel">
        <div className="giveaway-panel__loading">
          <div className="giveaway-panel__spinner" />
          <p>{t("loading_giveaways")}</p>
        </div>
      </div>
    );
  }

  // Error state (after all retries exhausted, no cached data)
  if (error && giveaways.length === 0) {
    return (
      <div className="giveaway-panel">
        <div className="giveaway-panel__error">
          <p>{error}</p>
          <div className="giveaway-panel__error-actions">
            <button
              type="button"
              className="giveaway-panel__retry-button"
              onClick={handleRefresh}
            >
              <SyncIcon size={14} />
              {t("retry")}
            </button>
            <button
              type="button"
              className="giveaway-panel__view-itad-button"
              onClick={() => openLink(ITAD_GIVEAWAYS_URL)}
            >
              {t("view_all_on_itad")}
              <LinkExternalIcon size={12} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="giveaway-panel">
      <div className="giveaway-panel__header">
        <h3 className="giveaway-panel__title">{t("giveaways")}</h3>
        <button
          type="button"
          className="giveaway-panel__refresh-button"
          onClick={handleRefresh}
          disabled={loading}
          title={t("refresh")}
        >
          <SyncIcon size={14} />
          <span>{t("refresh")}</span>
        </button>
      </div>

      {giveaways.length === 0 ? (
        <div className="giveaway-panel__empty">
          <p>{t("no_giveaways")}</p>
          <a
            href={ITAD_GIVEAWAYS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="giveaway-panel__view-all"
            onClick={(e) => {
              e.preventDefault();
              openLink(ITAD_GIVEAWAYS_URL);
            }}
          >
            {t("view_all_on_itad")}
            <LinkExternalIcon size={12} />
          </a>
        </div>
      ) : (
        <div className="giveaway-panel__grid">
          {giveaways.map((giveaway, index) => (
            <div
              key={`${giveaway.title}-${index}`}
              className={`giveaway-panel__card ${getExpiryClass(giveaway.expiryDate)}`}
            >
              {giveaway.boxartUrl && (
                <img
                  className="giveaway-panel__card-boxart"
                  src={giveaway.boxartUrl}
                  alt={giveaway.gameTitle}
                  loading="lazy"
                />
              )}
              <div className="giveaway-panel__card-body">
                <div className="giveaway-panel__card-shop">
                  {giveaway.shopName || t("giveaway")}
                </div>

                <h4 className="giveaway-panel__card-title">
                  {giveaway.gameTitle || giveaway.title}
                </h4>

                {giveaway.gameCount > 1 && (
                  <span className="giveaway-panel__card-count">
                    +{giveaway.gameCount - 1} {t("more_games")}
                  </span>
                )}

                {giveaway.expiryDate && (
                  <div className="giveaway-panel__card-expiry">
                    <ClockIcon size={12} />
                    <span>{formatExpiry(giveaway.expiryDate)}</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                className="giveaway-panel__card-link"
                onClick={() => openLink(giveaway.link)}
                title={t("open_giveaway")}
              >
                <LinkExternalIcon size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="giveaway-panel__footer">
        <a
          href={ITAD_GIVEAWAYS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="giveaway-panel__view-all"
          onClick={(e) => {
            e.preventDefault();
            openLink(ITAD_GIVEAWAYS_URL);
          }}
        >
          {t("view_all_on_itad")}
          <LinkExternalIcon size={12} />
        </a>
      </div>
    </div>
  );
}
