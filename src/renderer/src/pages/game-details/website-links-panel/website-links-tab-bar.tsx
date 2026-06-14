import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  WebsiteId,
  WebsiteLink,
} from "@renderer/services/website-links.service";
import { WEBSITE_LOGOS } from "@renderer/assets/website-logos";

interface WebsiteLinksTabBarProps {
  links: WebsiteLink[];
  activeTabId: WebsiteId | null;
  onTabChange: (tabId: WebsiteId) => void;
}

export function WebsiteLinksTabBar({
  links,
  activeTabId,
  onTabChange,
}: WebsiteLinksTabBarProps) {
  const { t } = useTranslation("game_details");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const updateFadeIndicators = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeftFade(el.scrollLeft > 4);
    setShowRightFade(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateFadeIndicators();
    el.addEventListener("scroll", updateFadeIndicators, { passive: true });
    window.addEventListener("resize", updateFadeIndicators);

    return () => {
      el.removeEventListener("scroll", updateFadeIndicators);
      window.removeEventListener("resize", updateFadeIndicators);
    };
  }, [updateFadeIndicators, links]);

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -200, behavior: "smooth" });
  };

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: 200, behavior: "smooth" });
  };

  if (links.length === 0) return null;

  return (
    <div className="website-links-tab-bar">
      <div
        className={`website-links-tab-bar__fade website-links-tab-bar__fade--left ${showLeftFade ? "website-links-tab-bar__fade--visible" : ""}`}
        aria-hidden="true"
      />
      <div
        className={`website-links-tab-bar__fade website-links-tab-bar__fade--right ${showRightFade ? "website-links-tab-bar__fade--visible" : ""}`}
        aria-hidden="true"
      />

      <button
        type="button"
        className={`website-links-tab-bar__arrow website-links-tab-bar__arrow--left ${showLeftFade ? "website-links-tab-bar__arrow--visible" : ""}`}
        onClick={scrollLeft}
        aria-label="Scroll tabs left"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M7.5 2.5L4 6L7.5 9.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div ref={scrollRef} className="website-links-tab-bar__scroll">
        {links.map((link) => (
          <button
            key={link.id}
            type="button"
            className={`website-links-tab-bar__tab ${activeTabId === link.id ? "website-links-tab-bar__tab--active" : ""}`}
            onClick={() => onTabChange(link.id)}
            title={t(link.name)}
          >
            <img
              src={WEBSITE_LOGOS[link.iconId]}
              alt=""
              className="website-links-tab-bar__tab-icon"
            />
            <span className="website-links-tab-bar__tab-label">
              {t(link.name)}
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className={`website-links-tab-bar__arrow website-links-tab-bar__arrow--right ${showRightFade ? "website-links-tab-bar__arrow--visible" : ""}`}
        onClick={scrollRight}
        aria-label="Scroll tabs right"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M4.5 2.5L8 6L4.5 9.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
