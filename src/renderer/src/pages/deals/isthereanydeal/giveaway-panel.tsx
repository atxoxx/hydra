import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { LinkExternalIcon, SyncIcon, ClockIcon } from "@primer/octicons-react";
import type { Giveaway } from "../../../declaration";
import type { DealSourceProps } from "../deal-sources";
import "./giveaway-panel.scss";

export function GiveawayPanel(_props: DealSourceProps) {
  const { t } = useTranslation("deals");
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGiveaways = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await window.electron.getItadGiveaways();
      setGiveaways(data ?? []);
    } catch {
      setError(t("could_not_load_giveaways"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchGiveaways();
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

  if (error && giveaways.length === 0) {
    return (
      <div className="giveaway-panel">
        <div className="giveaway-panel__error">
          <p>{error}</p>
          <button
            type="button"
            className="giveaway-panel__retry-button"
            onClick={fetchGiveaways}
          >
            <SyncIcon size={14} />
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="giveaway-panel">
      <div className="giveaway-panel__header">
        <h3 className="giveaway-panel__title">
          {t("giveaways")}
        </h3>
        <button
          type="button"
          className="giveaway-panel__refresh-button"
          onClick={fetchGiveaways}
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
          href="https://isthereanydeal.com/giveaways/"
          target="_blank"
          rel="noopener noreferrer"
          className="giveaway-panel__view-all"
          onClick={(e) => {
            e.preventDefault();
            openLink("https://isthereanydeal.com/giveaways/");
          }}
        >
          {t("view_all_on_itad")}
          <LinkExternalIcon size={12} />
        </a>
      </div>
    </div>
  );
}
