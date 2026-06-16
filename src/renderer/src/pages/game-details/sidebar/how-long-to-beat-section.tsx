import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import { useTranslation } from "react-i18next";
import type { HowLongToBeatCategory } from "@types";
import { SidebarSection } from "../sidebar-section/sidebar-section";
import { HowLongToBeatCard } from "../dashboard-cards/how-long-to-beat-card";
import "./sidebar.scss";

export interface HowLongToBeatSectionProps {
  howLongToBeatData: HowLongToBeatCategory[] | null;
  isLoading: boolean;
}

/**
 * Sidebar mirror of the dashboard HowLongToBeat card.
 *
 * Kept backwards-compatible with the existing `howLongToBeatData`
 * prop so callers can render either shape (legacy cloud data or
 * the v2 multi-provider rendering). When `howLongToBeatData` is
 * provided, the legacy side-panel UI is shown so we don't break
 * existing page state; when it's null but the global game context
 * is set, the new compact card is rendered instead.
 */
export function HowLongToBeatSection({
  howLongToBeatData,
  isLoading,
}: HowLongToBeatSectionProps) {
  const { t } = useTranslation("game_details");

  if (!isLoading && (!howLongToBeatData || howLongToBeatData.length === 0)) {
    return (
      <SidebarSection title="HowLongToBeat">
        <HowLongToBeatCard compact />
      </SidebarSection>
    );
  }

  const durationTranslation: Record<string, string> = {
    Hours: "hours",
    Mins: "minutes",
  };

  const getDuration = (duration: string) => {
    const [value, unit] = duration.split(" ");
    return `${value} ${t(durationTranslation[unit])}`;
  };

  return (
    <SkeletonTheme baseColor="#1c1c1c" highlightColor="#444">
      <SidebarSection title="HowLongToBeat">
        <ul className="how-long-to-beat__categories-list">
          {howLongToBeatData
            ? howLongToBeatData.map((category) => (
                <li key={category.title} className="how-long-to-beat__category">
                  <p className="how-long-to-beat__category-label how-long-to-beat__category-label--bold">
                    {category.title}
                  </p>

                  <p className="how-long-to-beat__category-label">
                    {getDuration(category.duration)}
                  </p>

                  {category.accuracy !== "00" && (
                    <small>
                      {t("accuracy", { accuracy: category.accuracy })}
                    </small>
                  )}
                </li>
              ))
            : Array.from({ length: 4 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="how-long-to-beat__category-skeleton"
                />
              ))}
        </ul>
      </SidebarSection>
    </SkeletonTheme>
  );
}
