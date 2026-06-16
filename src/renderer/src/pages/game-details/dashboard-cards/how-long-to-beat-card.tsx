import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import { useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { HowLongToBeatCategory } from "@types";
import { ClockIcon, PaperAirplaneIcon } from "@primer/octicons-react";
import { gameDetailsContext } from "@renderer/context";
import { useToast } from "@renderer/hooks";

import "./dashboard-card.scss";
import "./how-long-to-beat-card.scss";

const durationTranslation: Record<string, string> = {
  Hours: "hours",
  Mins: "minutes",
};

function parseDurationToSeconds(duration: string): number {
  const [value, unit] = duration.split(" ");
  const num = parseFloat(value);
  if (unit === "Hours" || unit === "hours") return num * 3600;
  if (unit === "Mins" || unit === "mins" || unit === "minutes") return num * 60;
  return 0;
}

export interface HowLongToBeatCardProps {
  howLongToBeatData: HowLongToBeatCategory[] | null;
  isLoading: boolean;
}

export function HowLongToBeatCard({
  howLongToBeatData,
  isLoading,
}: Readonly<HowLongToBeatCardProps>) {
  const { t } = useTranslation("game_details");
  const { game } = useContext(gameDetailsContext);
  const { showSuccessToast, showErrorToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getDuration = (duration: string) => {
    const [value, unit] = duration.split(" ");
    return `${value} ${t(durationTranslation[unit])}`;
  };

  const userPlaytimeSeconds = useMemo(
    () => (game?.playTimeInMilliseconds ?? 0) / 1000,
    [game?.playTimeInMilliseconds]
  );

  const getProgressPercent = (duration: string): number => {
    const estimated = parseDurationToSeconds(duration);
    if (estimated <= 0) return 0;
    return Math.min(Math.round((userPlaytimeSeconds / estimated) * 100), 100);
  };

  const handleSubmitPlaytime = async () => {
    if (!game || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await window.electron.hydraApi.post(
        `/games/${game.shop}/${game.objectId}/hltb/submit`,
        {
          data: { playtimeSeconds: userPlaytimeSeconds },
          needsAuth: true,
        }
      );
      showSuccessToast(t("hltb_submitted"));
    } catch {
      showErrorToast(t("hltb_submit_failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if ((!howLongToBeatData || howLongToBeatData.length === 0) && !isLoading) {
    return null;
  }

  const content = howLongToBeatData ? (
    <div className="hltb-card__list">
      {howLongToBeatData.map((category) => {
        const progress = getProgressPercent(category.duration);
        return (
          <div key={category.title} className="hltb-card__item">
            <span className="hltb-card__item-title">{category.title}</span>
            <span className="hltb-card__item-duration">
              {getDuration(category.duration)}
            </span>
            {category.accuracy !== "00" && (
              <span className="hltb-card__item-accuracy">
                {t("accuracy", { accuracy: category.accuracy })}
              </span>
            )}
            {userPlaytimeSeconds > 0 && (
              <div className="hltb-card__progress-container">
                <div className="hltb-card__progress-track">
                  <div
                    className="hltb-card__progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="hltb-card__progress-label">{progress}%</span>
              </div>
            )}
          </div>
        );
      })}

      {userPlaytimeSeconds > 0 && (
        <button
          type="button"
          className="hltb-card__submit-btn"
          onClick={handleSubmitPlaytime}
          disabled={isSubmitting}
          title={t("hltb_submit_playtime")}
        >
          <PaperAirplaneIcon size={14} />
          <span>{t("hltb_submit_playtime")}</span>
        </button>
      )}
    </div>
  ) : (
    <div className="hltb-card__list">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="hltb-card__skeleton" />
      ))}
    </div>
  );

  return (
    <SkeletonTheme baseColor="#1c1c1c" highlightColor="#444">
      <div className="dashboard-card hltb-card">
        <div className="dashboard-card__header">
          <span className="dashboard-card__header-icon">
            <ClockIcon size={16} />
          </span>
          <h3 className="dashboard-card__header-title">HowLongToBeat</h3>
        </div>

        <div className="dashboard-card__body">{content}</div>
      </div>
    </SkeletonTheme>
  );
}
