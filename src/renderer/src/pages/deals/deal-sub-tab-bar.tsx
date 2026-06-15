import { useTranslation } from "react-i18next";
import "./deal-sub-tab-bar.scss";

export interface DealSubTabBarProps {
  sources: Array<{
    id: string;
    labelKey: string;
    icon: React.ReactNode;
    requiresConfig: boolean;
  }>;
  activeSourceId: string | null;
  onTabChange: (sourceId: string) => void;
}

export function DealSubTabBar({
  sources,
  activeSourceId,
  onTabChange,
}: DealSubTabBarProps) {
  const { t } = useTranslation("deals");

  if (sources.length === 0) {
    return null;
  }

  return (
    <div className="deal-sub-tab-bar" role="tablist">
      <div className="deal-sub-tab-bar__scroll">
        {sources.map((source) => (
          <button
            key={source.id}
            type="button"
            role="tab"
            className={`deal-sub-tab-bar__tab ${activeSourceId === source.id ? "deal-sub-tab-bar__tab--active" : ""}`}
            onClick={() => onTabChange(source.id)}
            aria-selected={activeSourceId === source.id}
          >
            <span className="deal-sub-tab-bar__tab-icon">{source.icon}</span>
            <span className="deal-sub-tab-bar__tab-label">
              {t(source.labelKey)}
            </span>
            {source.requiresConfig && (
              <span
                className="deal-sub-tab-bar__config-badge"
                title={t("requires_configuration")}
              >
                •
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
