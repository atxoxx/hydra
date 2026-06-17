import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { CheckboxField } from "@renderer/components";
import { settingsContext } from "@renderer/context";
import { useAppSelector } from "@renderer/hooks";

import "./settings-general.scss";

export function SettingsContextNews() {
  const { t } = useTranslation(["settings", "news"]);
  const { updateUserPreferences } = useContext(settingsContext);

  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );

  const [sidebarShowNewsTab, setSidebarShowNewsTab] = useState(true);
  const [newsShowOnlyUnread, setNewsShowOnlyUnread] = useState(true);

  useEffect(() => {
    if (!userPreferences) return;
    setSidebarShowNewsTab(userPreferences.sidebarShowNewsTab !== false);
    setNewsShowOnlyUnread(userPreferences.newsShowOnlyUnread !== false);
  }, [userPreferences]);

  return (
    <div className="settings-context-panel">
      <div className="settings-context-panel__group">
        <h3>{t("news_settings_section")}</h3>

        <CheckboxField
          label={t("news_show_news_tab")}
          checked={sidebarShowNewsTab}
          onChange={() => {
            const next = !sidebarShowNewsTab;
            setSidebarShowNewsTab(next);
            updateUserPreferences({ sidebarShowNewsTab: next });
          }}
        />

        <CheckboxField
          label={t("news_only_unread_default")}
          checked={newsShowOnlyUnread}
          onChange={() => {
            const next = !newsShowOnlyUnread;
            setNewsShowOnlyUnread(next);
            updateUserPreferences({ newsShowOnlyUnread: next });
          }}
        />

        <p className="settings-context-panel__description">
          {t("news_settings_help")}
        </p>
      </div>
    </div>
  );
}
