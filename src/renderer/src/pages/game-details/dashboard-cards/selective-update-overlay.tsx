import { useEffect, useMemo, useState } from "react";
import { XIcon, CheckIcon, SyncIcon } from "@primer/octicons-react";
import { useTranslation } from "react-i18next";
import type { Game, MetadataSearchResult } from "@types";
import { useToast } from "@renderer/hooks";

import "./selective-update-overlay.scss";

interface SelectiveUpdateOverlayProps {
  /** Current persisted game — `metadata.x ?? game.x` so we never blank out an existing store value the user wants to keep. */
  game: Game;
  /** Raw search-result row from `searchGameMetadata` IPC — already shaped by the existing aggregator. */
  incoming: MetadataSearchResult;
  /** Title to show in the modal header. Falls back to incoming.title. */
  gameTitle: string;
  onClose: () => void;
  /** Called once the user confirms. Performs the IPC call so callers don't need to repeat the plumbing. */
  onApplied?: () => void;
}

interface FieldFlags {
  title: boolean;
  description: boolean;
  releaseDate: boolean;
  developers: boolean;
  publishers: boolean;
  genres: boolean;
  tags: boolean;
  coverImage: boolean;
}

const DEFAULT_FLAGS: FieldFlags = {
  title: true,
  description: true,
  releaseDate: true,
  developers: true,
  publishers: true,
  genres: true,
  tags: true,
  coverImage: true,
};

/**
 * Side-by-side comparison + per-field picker for metadata scraped from the
 * existing aggregator (see `metadata-search-aggregator.ts`).
 *
 * Lives next to the existing `GameAssetsSettings` modals, but distinct in
 * intent — those handle **images** (icon/logo/hero); this one handles the
 * **text metadata fields** the plan's "Metadata Console" was meant to expose.
 *
 * On apply it batches the chosen patches into a single `saveGameMetadata`
 * IPC call (already wired by `events/library/save-game-metadata.ts`) so
 * none of the existing IPC handlers or schema paths need to change.
 */
export function SelectiveUpdateOverlay({
  game,
  incoming,
  gameTitle,
  onClose,
  onApplied,
}: SelectiveUpdateOverlayProps) {
  const { t } = useTranslation("game_details");
  const { showSuccessToast, showErrorToast } = useToast();

  const [flags, setFlags] = useState<FieldFlags>(DEFAULT_FLAGS);
  const [selectAll, setSelectAll] = useState(true);
  const [isApplying, setIsApplying] = useState(false);

  // Pre-compute the diff values once so the table is stable across re-renders.
  const diff = useMemo(
    () => buildDiff(game, incoming),
    [game, incoming]
  );

  // Falsy incoming data shouldn't appear as an "incoming" row at all.
  const availableFields = useMemo(() => {
    return (Object.keys(diff) as (keyof Diff)[]
      ).filter((key) => diff[key].incoming !== null);
  }, [diff]);

  // Keep `selectAll` checkbox in sync with the per-row flags.
  useEffect(() => {
    const allOn = availableFields.every((key) => flags[key]);
    setSelectAll(allOn);
  }, [availableFields, flags]);

  const toggleField = (key: keyof FieldFlags) => {
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAll = () => {
    const nextCheck = !selectAll;
    const patch = { ...flags } as Record<keyof FieldFlags, boolean>;
    for (const key of availableFields) {
      // Only flip keys we have an incoming value for; missing keys would
      // map to null and accidentally wipe the user's data.
      patch[key] = nextCheck;
    }
    setFlags(patch as FieldFlags);
  };

  const handleApply = async () => {
    if (isApplying || availableFields.length === 0) return;
    setIsApplying(true);

    // Title and text metadata get split across two IPC paths:
    // - Title goes through updateCustomGame/updateGame (no generic metadata title path exists today).
    // - Description + the rest of the text metadata goes through saveGameMetadata.
    const metadataPatch: {
      description?: string | null;
      genres?: string[] | null;
      developers?: string[] | null;
      publishers?: string[] | null;
      tags?: string[] | null;
      releaseDate?: string | null;
    } = {};

    // Description is a single boolean + nullable value — straightforward.
    if (flags.description && diff.description.incoming) {
      metadataPatch.description = String(diff.description.incoming);
    }
    if (flags.releaseDate && diff.releaseDate.incoming) {
      metadataPatch.releaseDate = String(diff.releaseDate.incoming);
    }
    if (flags.developers && diff.developers.incoming) {
      metadataPatch.developers = diff.developers.incoming as string[];
    }
    if (flags.publishers && diff.publishers.incoming) {
      metadataPatch.publishers = diff.publishers.incoming as string[];
    }
    if (flags.genres && diff.genres.incoming) {
      metadataPatch.genres = diff.genres.incoming as string[];
    }
    if (flags.tags && diff.tags.incoming) {
      // Merge into existing game tags so the user keeps their manual picks.
      metadataPatch.tags = mergeUnique(
        game.tags ?? [],
        diff.tags.incoming as string[]
      );
    }

    try {
      // Persist the text-metadata patch via the existing save IPC.
      if (Object.keys(metadataPatch).length > 0) {
        const result = await window.electron.saveGameMetadata({
          shop: game.shop,
          objectId: game.objectId,
          metadata: metadataPatch,
        });
        if (!result?.ok) {
          throw new Error(result?.error ?? "saveGameMetadata failed");
        }
      }

      // Title footer — apply via updateCustomGame when the game is custom,
      // otherwise surface a hint that the user should rename through the
      // existing edit-game modal (no other IPC handler exists for store games
      // today). Keeps the toggle honest instead of silently dropping it.
      if (flags.title && diff.title.incoming && game.shop === "custom") {
        await window.electron.updateCustomGame({
          shop: game.shop,
          objectId: game.objectId,
          title: String(diff.title.incoming),
        });
      }

      showSuccessToast(
        t("selective_update_applied", { title: gameTitle })
      );
      onApplied?.();
      onClose();
    } catch (error) {
      console.error("Selective update save failed:", error);
      showErrorToast(
        error instanceof Error
          ? error.message
          : t("selective_update_failed")
      );
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="selective-update-overlay__backdrop">
      <div className="selective-update-overlay">
        <div className="selective-update-overlay__header">
          <div className="selective-update-overlay__title-block">
            <h3>{t("selective_update_title", { title: gameTitle })}</h3>
            <p className="selective-update-overlay__source">
              {t("selective_update_source", { source: incoming.source })}
            </p>
          </div>
          <button
            type="button"
            className="selective-update-overlay__close"
            onClick={onClose}
            aria-label={t("selective_update_close")}
            disabled={isApplying}
          >
            <XIcon size={20} />
          </button>
        </div>

        <div className="selective-update-overlay__toolbar">
          <label className="selective-update-overlay__select-all">
            <input
              type="checkbox"
              checked={selectAll}
              onChange={toggleAll}
              disabled={availableFields.length === 0}
            />
            <span>{t("selective_update_select_all")}</span>
          </label>
          <span className="selective-update-overlay__count">
            {t("selective_update_count", {
              selected: availableFields.filter((k) => flags[k]).length,
              total: availableFields.length,
            })}
          </span>
        </div>

        <div className="selective-update-overlay__table">
          <div className="selective-update-overlay__row selective-update-overlay__row--head">
            <span className="selective-update-overlay__cell selective-update-overlay__cell--check">
              {t("selective_update_col_import")}
            </span>
            <span className="selective-update-overlay__cell selective-update-overlay__cell--field">
              {t("selective_update_col_field")}
            </span>
            <span className="selective-update-overlay__cell selective-update-overlay__cell--current">
              {t("selective_update_col_current")}
            </span>
            <span className="selective-update-overlay__cell selective-update-overlay__cell--incoming">
              {t("selective_update_col_incoming")}
            </span>
          </div>

          {availableFields.length === 0 ? (
            <div className="selective-update-overlay__empty">
              {t("selective_update_no_fields")}
            </div>
          ) : (
            availableFields.map((key) => (
              <div key={key} className="selective-update-overlay__row">
                <span className="selective-update-overlay__cell selective-update-overlay__cell--check">
                  <input
                    type="checkbox"
                    checked={flags[key]}
                    onChange={() => toggleField(key)}
                    aria-label={t(
                      `selective_update_field_${key}_aria` as any
                    )}
                  />
                </span>
                <span className="selective-update-overlay__cell selective-update-overlay__cell--field">
                  {t(`selective_update_field_${key}` as any)}
                </span>
                <span
                  className="selective-update-overlay__cell selective-update-overlay__cell--current"
                  title={String(diff[key].current ?? "")}
                >
                  {renderValue(diff[key].current)}
                </span>
                <span
                  className="selective-update-overlay__cell selective-update-overlay__cell--incoming"
                  title={String(diff[key].incoming ?? "")}
                >
                  {renderValue(diff[key].incoming)}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="selective-update-overlay__footer">
          <button
            type="button"
            className="selective-update-overlay__btn selective-update-overlay__btn--ghost"
            onClick={onClose}
            disabled={isApplying}
          >
            {t("selective_update_cancel")}
          </button>
          <button
            type="button"
            className="selective-update-overlay__btn selective-update-overlay__btn--primary"
            onClick={handleApply}
            disabled={
              isApplying ||
              availableFields.length === 0 ||
              availableFields.every((k) => !flags[k])
            }
          >
            {isApplying ? (
              <>
                <SyncIcon size={16} className="selective-update-overlay__spin" />
                <span>{t("selective_update_applying")}</span>
              </>
            ) : (
              <>
                <CheckIcon size={16} />
                <span>{t("selective_update_apply")}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface DiffRow {
  current: string | string[] | null;
  incoming: string | string[] | null;
}

interface Diff {
  title: DiffRow;
  description: DiffRow;
  releaseDate: DiffRow;
  developers: DiffRow;
  publishers: DiffRow;
  genres: DiffRow;
  tags: DiffRow;
  coverImage: DiffRow;
}

function buildDiff(game: Game, incoming: MetadataSearchResult): Diff {
  return {
    title: {
      current: game.title || incoming.title || null,
      incoming: incoming.title || null,
    },
    description: {
      current: (game.description as string | null | undefined) ?? null,
      incoming: incoming.description?.trim() ? incoming.description : null,
    },
    releaseDate: {
      current: (game.releaseDate as string | null | undefined) ?? null,
      // Aggregator populates releaseYear (number) only — convert to plausible
      // ISO yyyy-01-01 for primitive differences the user can still react to.
      incoming:
        incoming.releaseYear != null ? `${incoming.releaseYear}-01-01` : null,
    },
    developers: {
      current: (game.developers as string[] | null | undefined) ?? [],
      incoming: incoming.developers?.length ? incoming.developers : null,
    },
    publishers: {
      current: (game.publishers as string[] | null | undefined) ?? [],
      incoming: incoming.publishers?.length ? incoming.publishers : null,
    },
    genres: {
      current: (game.genres as string[] | null | undefined) ?? [],
      incoming: incoming.genres?.length ? incoming.genres : null,
    },
    tags: {
      current: (game.tags as string[] | null | undefined) ?? [],
      incoming: incoming.tags?.length ? incoming.tags : null,
    },
    coverImage: {
      current: game.iconUrl ?? null,
      incoming: incoming.iconUrl ?? null,
    },
  };
}

function renderValue(value: string | string[] | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) {
    return value.length === 0 ? "—" : value.join(", ");
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? "—" : trimmed;
}

function mergeUnique(existing: string[], incoming: string[]): string[] {
  const seen = new Set(existing.map((s) => s.toLowerCase()));
  const merged = [...existing];
  for (const item of incoming) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }
  return merged;
}
