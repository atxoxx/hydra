import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CatalogueSearchResult, WatchlistPriority } from "@types";

import { Button, Modal, SelectField } from "@renderer/components";
import { useToast, useWatchlist } from "@renderer/hooks";

import "./watchlist-modal.scss";

export interface WatchlistModalProps {
  visible: boolean;
  game: CatalogueSearchResult | null;
  onClose: () => void;
}

const PRIORITY_OPTIONS: { key: string; value: WatchlistPriority; label: string }[] = [
  { key: "must-play", value: "must-play", label: "Must-play" },
  { key: "want", value: "want", label: "Want" },
  { key: "later", value: "later", label: "Later" },
];

export function WatchlistModal({
  visible,
  game,
  onClose,
}: Readonly<WatchlistModalProps>) {
  const { t } = useTranslation("watchlist");
  const { showSuccessToast, showErrorToast } = useToast();
  const { addToWatchlist, getWatchlistEntry } = useWatchlist();

  const [priority, setPriority] = useState<WatchlistPriority>("want");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const existingEntry = game
    ? getWatchlistEntry(game.shop, game.objectId)
    : undefined;

  const isEditing = !!existingEntry;

  // Reset form when modal opens
  useEffect(() => {
    if (visible && game) {
      if (existingEntry) {
        setPriority(existingEntry.priority);
        setNotes(existingEntry.notes);
      } else {
        setPriority("want");
        setNotes("");
      }
    }
  }, [visible, game, existingEntry]);

  const handleClose = useCallback(() => {
    if (isSaving) return;
    setNotes("");
    setPriority("want");
    onClose();
  }, [isSaving, onClose]);

  const handleSave = async () => {
    if (!game) return;

    setIsSaving(true);
    try {
      await addToWatchlist({
        shop: game.shop,
        objectId: game.objectId,
        title: game.title,
        priority,
        notes: notes.trim(),
        initialDownloadSources: game.downloadSources,
        libraryImageUrl: game.libraryImageUrl,
      });

      showSuccessToast(
        isEditing
          ? t("updated_watchlist", { title: game.title, defaultValue: `Updated ${game.title} watchlist` })
          : t("added_to_watchlist", { title: game.title, defaultValue: `Added ${game.title} to your watchlist` })
      );

      handleClose();
    } catch (error) {
      console.error(error);
      showErrorToast(t("failed_to_save_watchlist", { defaultValue: "Failed to save watchlist" }));
    } finally {
      setIsSaving(false);
    }
  };

  if (!game) return null;

  return (
    <Modal
      visible={visible}
      title={
        isEditing
          ? t("edit_watchlist_title", { title: game.title, defaultValue: `Edit ${game.title} in watchlist` })
          : t("add_watchlist_title", { title: game.title, defaultValue: `Add ${game.title} to your watchlist` })
      }
      onClose={handleClose}
    >
      <div className="watchlist-modal">
        <SelectField
          label={t("priority_label", { defaultValue: "Priority" })}
          theme="dark"
          value={priority}
          options={PRIORITY_OPTIONS}
          onChange={(event) =>
            setPriority(event.target.value as WatchlistPriority)
          }
          disabled={isSaving}
        />

        <label className="watchlist-modal__notes-label">
          {t("notes_label", { defaultValue: "Notes" })}
        </label>
        <textarea
          className="watchlist-modal__notes-input"
          placeholder={t("notes_placeholder", { defaultValue: "Why do you want to play this game? (optional)" })}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          disabled={isSaving}
          maxLength={500}
          rows={4}
        />
        <small className="watchlist-modal__notes-counter">
          {notes.length}/500
        </small>

        <div className="watchlist-modal__actions">
          <Button
            type="button"
            theme="outline"
            onClick={handleClose}
            disabled={isSaving}
          >
            {t("cancel", { defaultValue: "Cancel" })}
          </Button>

          <Button
            type="button"
            theme="primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isEditing
              ? t("update", { defaultValue: "Update" })
              : t("add_to_watchlist_btn", { defaultValue: "Add to watchlist" })}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
