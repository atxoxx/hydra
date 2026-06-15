import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { useUserDetails } from "@renderer/hooks";
import { gameDetailsContext } from "@renderer/context";
import { AchievementList } from "../../achievements/achievement-list";
import { AchievementPanel } from "../../achievements/achievement-panel";
import { LockIcon } from "@primer/octicons-react";
import "./achievements-tab.scss";

export function AchievementsTab() {
  const { t } = useTranslation("game_details");
  const { userDetails } = useUserDetails();
  const { achievements } =
    useContext(gameDetailsContext);

  if (!userDetails) {
    return (
      <div className="achievements-tab">
        <div className="achievements-tab__sign-in">
          <LockIcon size={48} />
          <h2>{t("sign_in_to_see_achievements")}</h2>
        </div>
      </div>
    );
  }

  if (!achievements || achievements.length === 0) {
    return (
      <div className="achievements-tab">
        <div className="achievements-tab__empty">
          <p>{t("no_achievements_found")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="achievements-tab">
      <AchievementPanel achievements={achievements} />
      <AchievementList achievements={achievements} />
    </div>
  );
}
