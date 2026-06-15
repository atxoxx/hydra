import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DealSubTabBar } from "./deal-sub-tab-bar";
import { DEAL_SOURCES } from "./deal-sources";
import "./deals.scss";

const STORAGE_KEY_LAST_TAB = "hydra_deals_last_tab";

function loadLastTab(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_LAST_TAB);
  } catch {
    return null;
  }
}

function saveLastTab(sourceId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_LAST_TAB, sourceId);
  } catch {
    /* storage full or unavailable */
  }
}

export function Deals() {
  const { t } = useTranslation("deals");
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);

  const enabledSources = useMemo(
    () => DEAL_SOURCES.filter((s) => s.enabled),
    []
  );

  const sourceMap = useMemo(
    () => new Map(enabledSources.map((s) => [s.id, s])),
    [enabledSources]
  );

  const handleTabChange = useCallback((sourceId: string) => {
    setActiveSourceId(sourceId);
    saveLastTab(sourceId);
  }, []);

  const handleConfigured = useCallback(() => {
    // Force re-evaluation of enabled/configured sources
    setActiveSourceId((prev) => prev);
  }, []);

  useEffect(() => {
    if (enabledSources.length === 0) {
      setActiveSourceId(null);
      return;
    }

    const lastTab = loadLastTab();
    const validLastTab =
      lastTab && sourceMap.has(lastTab) ? lastTab : undefined;

    setActiveSourceId(validLastTab ?? enabledSources[0].id);
  }, [enabledSources, sourceMap]);

  const activeSource = activeSourceId ? sourceMap.get(activeSourceId) ?? null : null;

  return (
    <section className="deals__container">
      <div className="deals__content">
        <header className="deals__header">
          <h2 className="deals__title">{t("deals")}</h2>
        </header>

        <DealSubTabBar
          sources={enabledSources.map((s) => ({
            id: s.id,
            labelKey: s.labelKey,
            icon: s.icon,
            requiresConfig: s.requiresConfig,
          }))}
          activeSourceId={activeSourceId}
          onTabChange={handleTabChange}
        />

        <div className="deals__source-content">
          {activeSource ? (
            <activeSource.component onConfigured={handleConfigured} />
          ) : enabledSources.length === 0 ? (
            <div className="deals__empty">
              <p>{t("no_sources_enabled")}</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
