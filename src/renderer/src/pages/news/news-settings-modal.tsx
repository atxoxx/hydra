import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TrashIcon, PlusIcon, SyncIcon } from "@primer/octicons-react";

import { Button, Modal, TextField, CheckboxField } from "@renderer/components";
import type { RssFeed } from "@types";
import { useToast } from "@renderer/hooks";

export interface NewsSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

const DEFAULT_FEED_LABELS = [
  "IGN",
  "PC Gamer",
  "Polygon",
  "Eurogamer",
  "Kotaku",
  "GameSpot",
  "Rock Paper Shotgun",
];

export function NewsSettingsModal({
  visible,
  onClose,
  onChanged,
}: NewsSettingsModalProps) {
  const { t } = useTranslation("news");
  const { showErrorToast, showSuccessToast } = useToast();

  const [feeds, setFeeds] = useState<RssFeed[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const loadFeeds = useCallback(async () => {
    try {
      const list = await window.electron.listNewsFeeds();
      setFeeds(list);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showErrorToast(t("news_settings_load_failed", { message }));
    }
  }, [showErrorToast, t]);

  useEffect(() => {
    if (visible) {
      void loadFeeds();
    }
  }, [visible, loadFeeds]);

  const handleAdd = useCallback(async () => {
    if (!newUrl.trim()) {
      showErrorToast(t("news_add_feed_invalid"));
      return;
    }
    setIsAdding(true);
    try {
      await window.electron.addNewsFeed({
        url: newUrl.trim(),
        label: newLabel.trim(),
      });
      setNewUrl("");
      setNewLabel("");
      showSuccessToast(t("news_add_feed_success"));
      await loadFeeds();
      onChanged?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("news/feed-exists")) {
        showErrorToast(t("news_add_feed_exists"));
      } else if (message.includes("news/invalid-url")) {
        showErrorToast(t("news_add_feed_invalid"));
      } else {
        showErrorToast(t("news_add_feed_failed", { message }));
      }
    } finally {
      setIsAdding(false);
    }
  }, [
    newUrl,
    newLabel,
    loadFeeds,
    onChanged,
    showErrorToast,
    showSuccessToast,
    t,
  ]);

  const handleRemove = useCallback(
    async (url: string) => {
      try {
        await window.electron.removeNewsFeed(url);
        await loadFeeds();
        onChanged?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        showErrorToast(t("news_remove_failed", { message }));
      }
    },
    [loadFeeds, onChanged, showErrorToast, t]
  );

  const handleToggle = useCallback(
    async (feed: RssFeed) => {
      try {
        await window.electron.toggleNewsFeed(feed.url, !feed.enabled);
        await loadFeeds();
        onChanged?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        showErrorToast(t("news_toggle_failed", { message }));
      }
    },
    [loadFeeds, onChanged, showErrorToast, t]
  );

  const handleClearHistory = useCallback(async () => {
    setIsClearing(true);
    try {
      await window.electron.clearNewsReadHistory();
      showSuccessToast(t("news_history_cleared"));
      onChanged?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showErrorToast(t("news_history_clear_failed", { message }));
    } finally {
      setIsClearing(false);
    }
  }, [onChanged, showErrorToast, showSuccessToast, t]);

  return (
    <Modal
      visible={visible}
      title={t("news_settings_modal_title")}
      description={t("news_settings_modal_description")}
      onClose={onClose}
      large
    >
      <div className="news-settings">
        <div className="news-settings__group">
          <h3>{t("news_add_feed")}</h3>
          <div className="news-settings__add-row">
            <TextField
              label={t("news_add_feed_url_label")}
              placeholder="https://example.com/feed"
              value={newUrl}
              onChange={(event) => setNewUrl(event.target.value)}
              theme="dark"
            />
            <TextField
              label={t("news_add_feed_label_label")}
              placeholder={t("news_add_feed_label_placeholder")}
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
              theme="dark"
            />
            <Button
              type="button"
              theme="primary"
              disabled={isAdding || !newUrl.trim()}
              onClick={() => void handleAdd()}
            >
              <PlusIcon size={16} />
              <span>{t("news_add_feed_submit")}</span>
            </Button>
          </div>
          <div className="news-settings__default-hint">
            <span>
              {t("news_default_feed_hint", {
                labels: DEFAULT_FEED_LABELS.join(", "),
              })}
            </span>
          </div>
        </div>

        <div className="news-settings__group">
          <h3>{t("news_subscribed_feeds")}</h3>
          {feeds.length === 0 ? (
            <p className="news-settings__empty">
              {t("news_no_feeds_subscribed")}
            </p>
          ) : (
            <ul className="news-settings__feed-list">
              {feeds.map((feed) => (
                <li key={feed.url} className="news-settings__feed-row">
                  <CheckboxField
                    label={feed.label}
                    checked={feed.enabled}
                    onChange={() => void handleToggle(feed)}
                  />
                  <span className="news-settings__feed-url">{feed.url}</span>
                  {feed.lastError && (
                    <span
                      className="news-settings__feed-error"
                      title={feed.lastError}
                    >
                      <SyncIcon size={14} /> {t("news_feed_error_short")}
                    </span>
                  )}
                  {feed.isDefault && (
                    <span className="news-settings__feed-default">
                      {t("news_feed_default_badge")}
                    </span>
                  )}
                  <Button
                    type="button"
                    theme="outline"
                    onClick={() => void handleRemove(feed.url)}
                    aria-label={t("news_feed_remove")}
                  >
                    <TrashIcon size={14} />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="news-settings__group">
          <h3>{t("news_history_section")}</h3>
          <Button
            type="button"
            theme="outline"
            disabled={isClearing}
            onClick={() => void handleClearHistory()}
          >
            <TrashIcon size={16} />
            <span>{t("news_settings_clear_history")}</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
