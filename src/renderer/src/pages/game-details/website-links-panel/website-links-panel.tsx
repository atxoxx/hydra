import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDownIcon } from "@primer/octicons-react";

import { gameDetailsContext } from "@renderer/context";
import {
  buildWebsiteLinks,
  DEFAULT_WEBSITE_ORDER,
  type WebsiteId,
} from "@renderer/services/website-links.service";
import { WebsiteLinksTabBar } from "./website-links-tab-bar";
import { WebsiteLinksIframe } from "./website-links-iframe";
import "./website-links-panel.scss";

const STORAGE_KEY_ENABLED = "hydra_website_links_enabled";
const STORAGE_KEY_ORDER = "hydra_website_links_order";
const STORAGE_KEY_LAST_TAB = "hydra_website_links_last_tab";

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable */
  }
}

export function WebsiteLinksPanel() {
  const { t } = useTranslation("game_details");
  const { objectId, shop, gameTitle } = useContext(gameDetailsContext);

  const [isOpen, setIsOpen] = useState(true);

  const [_enabledSites, _setEnabledSites] = useState<WebsiteId[]>(() =>
    loadJson<WebsiteId[]>(STORAGE_KEY_ENABLED, DEFAULT_WEBSITE_ORDER)
  );

  const [_siteOrder, _setSiteOrder] = useState<WebsiteId[]>(() =>
    loadJson<WebsiteId[]>(STORAGE_KEY_ORDER, DEFAULT_WEBSITE_ORDER)
  );

  const [lastTabs, setLastTabs] = useState<Record<string, WebsiteId>>(() =>
    loadJson<Record<string, WebsiteId>>(STORAGE_KEY_LAST_TAB, {})
  );

  const gameKey = useMemo(
    () => (objectId ? `${shop}:${objectId}` : ""),
    [shop, objectId]
  );

  const links = useMemo(() => {
    if (!objectId || !gameTitle) return [];
    return buildWebsiteLinks({
      objectId,
      shop,
      gameTitle,
    });
  }, [objectId, shop, gameTitle]);

  const orderedLinks = useMemo(() => {
    const linkMap = new Map(links.map((l) => [l.id, l]));
    return _siteOrder
      .filter((id) => _enabledSites.includes(id) && linkMap.has(id))
      .map((id) => linkMap.get(id)!);
  }, [links, _siteOrder, _enabledSites]);

  const [activeTabId, setActiveTabId] = useState<WebsiteId | null>(null);

  useEffect(() => {
    if (orderedLinks.length === 0) {
      setActiveTabId(null);
      return;
    }

    const lastTab = gameKey ? lastTabs[gameKey] : undefined;
    const validLastTab =
      lastTab && orderedLinks.some((l) => l.id === lastTab)
        ? lastTab
        : undefined;

    setActiveTabId(validLastTab ?? orderedLinks[0].id);
  }, [orderedLinks, gameKey]);

  const activeLink = useMemo(
    () => orderedLinks.find((l) => l.id === activeTabId) ?? null,
    [orderedLinks, activeTabId]
  );

  const handleTabChange = useCallback(
    (tabId: WebsiteId) => {
      setActiveTabId(tabId);
      if (gameKey) {
        const next = { ...lastTabs, [gameKey]: tabId };
        setLastTabs(next);
        saveJson(STORAGE_KEY_LAST_TAB, next);
      }
    },
    [gameKey, lastTabs]
  );

  if (!objectId || !gameTitle || orderedLinks.length === 0) {
    return null;
  }

  return (
    <div className="website-links-panel">
      <button
        type="button"
        className="website-links-panel__header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <ChevronDownIcon
          className={`website-links-panel__chevron ${isOpen ? "website-links-panel__chevron--open" : ""}`}
        />
        <span>{t("websites")}</span>
      </button>

      <div
        className={`website-links-panel__body ${isOpen ? "website-links-panel__body--open" : ""}`}
      >
        <WebsiteLinksTabBar
          links={orderedLinks}
          activeTabId={activeTabId}
          onTabChange={handleTabChange}
        />

        {activeLink && (
          <WebsiteLinksIframe key={activeLink.id} link={activeLink} />
        )}
      </div>
    </div>
  );
}
