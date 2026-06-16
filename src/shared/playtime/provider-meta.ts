import type { PlaytimeProviderId } from "@types";

/** Stable display info for each playtime provider. Used by the renderer
 *  to render chips/labels without round-tripping through the main process. */
export interface RenderableProviderMeta {
  id: PlaytimeProviderId;
  displayName: string;
  supportsSubmit: boolean;
  /** Logo URL resolved from the web assets directory. */
  logoPath: string | null;
}

export const RENDERABLE_PROVIDER_META: Record<
  PlaytimeProviderId,
  RenderableProviderMeta
> = {
  howlongtobeat: {
    id: "howlongtobeat",
    displayName: "HowLongToBeat",
    supportsSubmit: true,
    logoPath: "/website-logos/howlongtobeat.svg",
  },
  backlogged: {
    id: "backlogged",
    displayName: "Backlogged",
    supportsSubmit: false,
    logoPath: null,
  },
  igdb_steam: {
    id: "igdb_steam",
    displayName: "IGDB / Steam",
    supportsSubmit: false,
    logoPath: null,
  },
};

/** Provider display order — used in the Edit picker dropdown. */
export const PROVIDER_ORDER: PlaytimeProviderId[] = [
  "howlongtobeat",
  "backlogged",
  "igdb_steam",
];
