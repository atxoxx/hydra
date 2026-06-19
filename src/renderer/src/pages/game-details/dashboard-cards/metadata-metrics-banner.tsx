import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { gameDetailsContext } from "@renderer/context";
import type {
  DeckCompatibilityLevel,
  GameMetadata,
  ProtonDbTier,
} from "@types";

import "./metadata-metrics-banner.scss";

/**
 * Compact top-of-page strip showing the metadata-driven compatibility,
 * review and engine data. Sits below `MetadataChipsRow` on the Overview
 * tab so the user can scan ProtonDB tier, IGN score and engine at a
 * glance without opening the sidebar.
 *
 * Reads metadata directly from the game-details context; the metadata
 * cache is populated automatically by `fetchGameMetadata` IPC under the
 * hood (`events/metadata/fetch-game-metadata.ts`).
 */
export function MetadataMetricsBanner() {
  const { t } = useTranslation("game_details");
  const { game, shopDetails } = useContext(gameDetailsContext);

  if (!game) return null;

  const metadata = readMetadata(game, shopDetails);
  if (!hasAnything(metadata)) return null;

  return (
    <div className="metadata-metrics-banner" role="group">
      {metadata.proton && (
        <div className="metadata-metrics-banner__cell metadata-metrics-banner__cell--proton">
          <span className="metadata-metrics-banner__icon" aria-hidden>
            🐧
          </span>
          <div className="metadata-metrics-banner__content">
            <div className="metadata-metrics-banner__label">
              {t("metrics_banner_proton_label")}
            </div>
            <div
              className={`metadata-metrics-banner__value metadata-metrics-banner__value--proton-${metadata.proton.tier ?? "unknown"}`}
            >
              {metadata.proton.tier
                ? t(`metrics_proton_tier_${metadata.proton.tier}` as any, {
                    defaultValue: metadata.proton.tier.toUpperCase(),
                  })
                : t("metrics_proton_unknown")}
            </div>
            {metadata.proton.deckCompatibility &&
              metadata.proton.deckCompatibility !== "unknown" && (
                <div className="metadata-metrics-banner__sub">
                  {t("metrics_banner_deck", {
                    level: t(
                      `metrics_deck_${metadata.proton.deckCompatibility}` as any
                    ),
                  })}
                </div>
              )}
          </div>
        </div>
      )}

      {metadata.engine && (
        <div className="metadata-metrics-banner__cell">
          <span className="metadata-metrics-banner__icon" aria-hidden>
            ⚙️
          </span>
          <div className="metadata-metrics-banner__content">
            <div className="metadata-metrics-banner__label">
              {t("metrics_banner_engine_label")}
            </div>
            <div className="metadata-metrics-banner__value">
              {metadata.engine}
            </div>
          </div>
        </div>
      )}

      {metadata.ignScore !== null && (
        <div className="metadata-metrics-banner__cell">
          <span
            className="metadata-metrics-banner__icon metadata-metrics-banner__icon--ign"
            aria-hidden
          >
            IGN
          </span>
          <div className="metadata-metrics-banner__content">
            <div className="metadata-metrics-banner__label">
              {t("metrics_banner_ign_label")}
            </div>
            <div className="metadata-metrics-banner__value">
              {metadata.ignScore}/10
            </div>
          </div>
        </div>
      )}

      {metadata.hltbMain && (
        <div className="metadata-metrics-banner__cell">
          <span className="metadata-metrics-banner__icon" aria-hidden>
            ⏱️
          </span>
          <div className="metadata-metrics-banner__content">
            <div className="metadata-metrics-banner__label">
              {t("metrics_banner_hltb_label")}
            </div>
            <div className="metadata-metrics-banner__value">
              {metadata.hltbMain}
            </div>
            {metadata.hltbExtra && (
              <div className="metadata-metrics-banner__sub">
                {t("metrics_banner_hltb_extra", {
                  main: metadata.hltbMain,
                  extra: metadata.hltbExtra,
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface BannerSnapshot {
  proton: {
    tier: ProtonDbTier | null;
    deckCompatibility: DeckCompatibilityLevel | null;
  } | null;
  engine: string | null;
  ignScore: number | null;
  hltbMain: string | null;
  hltbExtra: string | null;
}

function hasAnything(snapshot: BannerSnapshot): boolean {
  return Boolean(
    snapshot.proton ||
      snapshot.engine ||
      snapshot.ignScore !== null ||
      snapshot.hltbMain
  );
}

/**
 * Build a resilient view-model from whatever data is currently attached to
 * the game record. Falls back gracefully when the metadata cache hasn't
 * been hydrated yet — ProtonDB only feeds in for Steam shops, IGN/Engine
 * arrive via the existing Promise.allSettled pipeline, and HLTB comes in
 * separately through the playtime provider flow.
 */
function readMetadata(
  game: any,
  shopDetails: any
): BannerSnapshot {
  const gameMetadata: GameMetadata | undefined = game?.metadata;
  const metadata =
    gameMetadata && typeof gameMetadata === "object" ? gameMetadata : null;

  let proton: BannerSnapshot["proton"] = null;
  if (metadata?.protonCompatibility) {
    proton = {
      tier: metadata.protonCompatibility.tier,
      deckCompatibility: metadata.protonCompatibility.deckCompatibility,
    };
  } else if (game?.shop === "steam") {
    // Sidebar already populated ProtonDB tier on the legacy path; expose
    // it here too so the banner stays in sync even before the metadata
    // orchestrator runs.
    const tier = game?.protondbTier ?? shopDetails?.protondbTier ?? null;
    const deck =
      game?.deckCompatibility ??
      shopDetails?.deckCompatibility ??
      null;
    if (tier) {
      proton = { tier, deckCompatibility: deck };
    }
  }

  const engine =
    metadata?.technicalInfo?.engine && metadata.technicalInfo.engine.length > 0
      ? metadata.technicalInfo.engine
      : null;

  const ignScore =
    typeof metadata?.ignReviewScore === "number"
      ? metadata.ignReviewScore
      : null;

  // HLTB isn't (yet) persisted on GameMetadata — renderer-side reading via
  // the metrics currently happens through shopDetails until the playtime
  // provider flow is wired into metadata. Display only when present.
  const hltbMain =
    shopDetails?.hltb?.categories?.find?.(
      (c: any) =>
        typeof c?.title === "string" &&
        c.title.toLowerCase().includes("main")
    )?.duration ?? null;
  const hltbExtra =
    shopDetails?.hltb?.categories?.find?.(
      (c: any) =>
        typeof c?.title === "string" &&
        (c.title.toLowerCase().includes("main +") ||
          c.title.toLowerCase().includes("main &") ||
          c.title.toLowerCase().includes("sides"))
    )?.duration ?? null;

  return { proton, engine, ignScore, hltbMain, hltbExtra };
}
