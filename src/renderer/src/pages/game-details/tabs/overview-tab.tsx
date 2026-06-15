import { useContext, useEffect, useState } from "react";
import type { HowLongToBeatCategory } from "@types";
import { gameDetailsContext } from "@renderer/context";
import { PlayStatusCard } from "../dashboard-cards/play-status-card";
import { StatsCard } from "../dashboard-cards/stats-card";
import { HowLongToBeatCard } from "../dashboard-cards/how-long-to-beat-card";
import { DescriptionCard } from "../dashboard-cards/description-card";
import { GalleryCard } from "../dashboard-cards/gallery-card";
import { SimilarGames } from "../similar-games/similar-games";
import "./overview-tab.scss";

export function OverviewTab() {
  const { effectiveObjectId, effectiveShop, objectId } =
    useContext(gameDetailsContext);

  const [howLongToBeat, setHowLongToBeat] = useState<{
    isLoading: boolean;
    data: HowLongToBeatCategory[] | null;
  }>({ isLoading: true, data: null });

  // Fetch HowLongToBeat data for the dashboard card
  useEffect(() => {
    if (objectId) {
      setHowLongToBeat({ isLoading: true, data: null });

      window.electron.hydraApi
        .get<HowLongToBeatCategory[] | null>(
          `/games/${effectiveShop}/${effectiveObjectId}/how-long-to-beat`,
          {
            needsAuth: false,
          }
        )
        .then((data) => {
          setHowLongToBeat({ isLoading: false, data });
        })
        .catch(() => {
          setHowLongToBeat({ isLoading: false, data: null });
        });
    }
  }, [effectiveObjectId, effectiveShop, objectId]);

  return (
    <div className="overview-tab">
      <div className="overview-tab__dashboard-grid">
        <PlayStatusCard />
        <StatsCard />
        <HowLongToBeatCard
          howLongToBeatData={howLongToBeat.data}
          isLoading={howLongToBeat.isLoading}
        />
        <div className="overview-tab__full-width">
          <DescriptionCard />
        </div>
        <div className="overview-tab__full-width">
          <GalleryCard />
        </div>
      </div>

      <SimilarGames shop={effectiveShop} objectId={effectiveObjectId} />
    </div>
  );
}
