import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import { useTranslation } from "react-i18next";
import type { HowLongToBeatCategory } from "@types";
import { ClockIcon } from "@primer/octicons-react";

import "./dashboard-card.scss";
import "./how-long-to-beat-card.scss";

const durationTranslation: Record<string, string> = {
  Hours: "hours",
  Mins: "minutes",
};

export interface HowLongToBeatCardProps {
  howLongToBeatData: HowLongToBeatCategory[] | null;
  isLoading: boolean;
}

export function HowLongToBeatCard({
  howLongToBeatData,
  isLoading,
}: Readonly<HowLongToBeatCardProps>) {
  const { t } = useTranslation("game_details");

  const getDuration = (duration: string) => {
    const [value, unit] = duration.split(" ");
    return `${value} ${t(durationTranslation[unit])}`;
  };

  if ((!howLongToBeatData || howLongToBeatData.length === 0) && !isLoading) {
    return null;
  }

  const content = howLongToBeatData ? (
    <div className="hltb-card__list">
      {howLongToBeatData.map((category) => (
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
        </div>
      ))}
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
