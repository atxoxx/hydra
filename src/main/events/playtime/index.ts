import { registerSearchPlaytimeGames } from "./search-playtime-games";
import { registerFetchPlaytimeData } from "./fetch-playtime-data";
import { registerAutoMatchPlaytime } from "./auto-match-playtime";
import { registerSaveGamePlaytimeMapping } from "./save-game-playtime-mapping";

// Self-register on import so the events module picks them up via the
// existing side-effect pattern used by neighbouring feature folders.
registerSearchPlaytimeGames();
registerFetchPlaytimeData();
registerAutoMatchPlaytime();
registerSaveGamePlaytimeMapping();

export function registerPlaytimeEvents() {
  // Already invoked above; exported for explicit calls if needed.
}
