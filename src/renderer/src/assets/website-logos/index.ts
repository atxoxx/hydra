import type { WebsiteId } from "@renderer/services/website-links.service";

import steamLogo from "./steam.svg?url";
import steamdbLogo from "./steamdb.svg?url";
import protondbLogo from "./protondb.svg?url";
import pcgamingwikiLogo from "./pcgamingwiki.svg?url";
import twitchLogo from "./twitch.svg?url";
import nexusmodsLogo from "./nexusmods.svg?url";
import moddbLogo from "./moddb.svg?url";
import gamefaqsLogo from "./gamefaqs.svg?url";
import metacriticLogo from "./metacritic.svg?url";
import howlongtobeatLogo from "./howlongtobeat.svg?url";
import igdbLogo from "./igdb.svg?url";
import youtubeLogo from "./youtube.svg?url";

export const WEBSITE_LOGOS: Record<WebsiteId, string> = {
  steam: steamLogo,
  steamdb: steamdbLogo,
  protondb: protondbLogo,
  pcgamingwiki: pcgamingwikiLogo,
  twitch: twitchLogo,
  nexusmods: nexusmodsLogo,
  moddb: moddbLogo,
  gamefaqs: gamefaqsLogo,
  metacritic: metacriticLogo,
  howlongtobeat: howlongtobeatLogo,
  igdb: igdbLogo,
  youtube: youtubeLogo,
};
