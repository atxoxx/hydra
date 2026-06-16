import { registerEvent } from "../register-event";
import { autoMatchPlaytime } from "@main/services/playtime-providers/playtime-aggregator";
import type { PlaytimeSearchResult } from "@types";

export interface AutoMatchPlaytimeArgs {
  title: string;
  releaseYear?: number | null;
  appId?: number | null;
}

export function registerAutoMatchPlaytime() {
  registerEvent(
    "autoMatchPlaytime",
    async (
      _event,
      { title, releaseYear, appId }: AutoMatchPlaytimeArgs
    ): Promise<PlaytimeSearchResult | null> => {
      try {
        const trimmed = (title ?? "").trim();
        if (trimmed.length < 2) return null;

        return await autoMatchPlaytime({
          title: trimmed,
          releaseYear: releaseYear ?? null,
          appId: appId ?? null,
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[autoMatchPlaytime] failed:", error);
        return null;
      }
    }
  );
}
