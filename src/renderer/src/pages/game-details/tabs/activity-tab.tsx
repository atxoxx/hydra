import { useContext } from "react";
import { gameDetailsContext } from "@renderer/context";
import { GameActivityPanel } from "../game-activity-panel";

export function ActivityTab() {
  const { shop, objectId } = useContext(gameDetailsContext);

  return (
    <div className="activity-panel-tab">
      {shop && objectId && (
        <GameActivityPanel
          key={`${shop}-${objectId}`}
          shop={shop}
          objectId={objectId}
        />
      )}
    </div>
  );
}
