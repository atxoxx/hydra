import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { DeviceCameraVideoIcon } from "@primer/octicons-react";
import { GallerySlider } from "../gallery-slider/gallery-slider";
import { gameDetailsContext } from "@renderer/context";

import "./dashboard-card.scss";

export function GalleryCard() {
  const { t } = useTranslation("game_details");
  const { shopDetails } = useContext(gameDetailsContext);

  const hasMedia =
    shopDetails &&
    (shopDetails.screenshots?.length || shopDetails.movies?.length);

  if (!hasMedia) return null;

  return (
    <div className="dashboard-card">
      <div className="dashboard-card__header">
        <span className="dashboard-card__header-icon">
          <DeviceCameraVideoIcon size={16} />
        </span>
        <h3 className="dashboard-card__header-title">{t("media")}</h3>
      </div>

      <div className="dashboard-card__body" style={{ padding: "8px" }}>
        <GallerySlider />
      </div>
    </div>
  );
}
