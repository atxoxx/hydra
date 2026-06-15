import { useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { getDateLocale } from "@shared";
import { gameDetailsContext } from "@renderer/context";
import { BookIcon } from "@primer/octicons-react";

import "./dashboard-card.scss";
import "./description-card.scss";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function processMediaElements(document: Document) {
  const $images = Array.from(document.querySelectorAll("img"));
  $images.forEach(($image) => {
    $image.loading = "lazy";
    $image.removeAttribute("width");
    $image.removeAttribute("height");
    $image.removeAttribute("style");
    $image.style.maxWidth = "100%";
    $image.style.width = "auto";
    $image.style.height = "auto";
    $image.style.boxSizing = "border-box";
  });

  const $videos = Array.from(document.querySelectorAll("video"));
  $videos.forEach(($video) => {
    $video.removeAttribute("width");
    $video.removeAttribute("height");
    $video.removeAttribute("style");
    $video.style.maxWidth = "100%";
    $video.style.width = "auto";
    $video.style.height = "auto";
    $video.style.boxSizing = "border-box";
  });
}

export function DescriptionCard() {
  const { t, i18n } = useTranslation("game_details");
  const { shopDetails, game } = useContext(gameDetailsContext);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const descriptionRef = useRef<HTMLDivElement>(null);

  const aboutTheGame = useMemo(() => {
    const aboutTheGame = shopDetails?.about_the_game;
    if (aboutTheGame) {
      const document = new DOMParser().parseFromString(
        aboutTheGame,
        "text/html"
      );
      processMediaElements(document);
      return document.body.outerHTML;
    }

    if (game?.shop === "custom") {
      return "";
    }

    return "";
  }, [shopDetails, t, game?.shop]);

  useLayoutEffect(() => {
    const el = descriptionRef.current;
    if (!el) {
      setIsOverflowing(false);
      return;
    }

    const measure = () => {
      const collapsedMaxHeight = 250;
      setIsOverflowing(el.scrollHeight > collapsedMaxHeight);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);

    const images = Array.from(el.querySelectorAll("img"));
    const onMediaLoad = () => measure();
    images.forEach((img) => {
      if (!img.complete) img.addEventListener("load", onMediaLoad);
    });

    return () => {
      observer.disconnect();
      images.forEach((img) => img.removeEventListener("load", onMediaLoad));
    };
  }, [aboutTheGame]);

  const rawDate = shopDetails?.release_date.date ?? "";
  let displayDate = rawDate;
  if (ISO_DATE_REGEX.test(rawDate)) {
    const parsed = new Date(`${rawDate}T00:00:00`);
    if (!isNaN(parsed.getTime())) {
      displayDate = format(parsed, "MMM d, yyyy", {
        locale: getDateLocale(i18n.language),
      });
    }
  }

  return (
    <div className="dashboard-card description-card">
      <div className="dashboard-card__header">
        <span className="dashboard-card__header-icon">
          <BookIcon size={16} />
        </span>
        <h3 className="dashboard-card__header-title">{t("about_the_game")}</h3>
      </div>

      <div className="dashboard-card__body">
        {shopDetails && (
          <div className="description-card__meta">
            <p>{t("release_date", { date: displayDate })}</p>
            {Array.isArray(shopDetails.publishers) && (
              <p>{t("publisher", { publisher: shopDetails.publishers[0] })}</p>
            )}
          </div>
        )}

        {aboutTheGame ? (
          <>
            <div
              ref={descriptionRef}
              dangerouslySetInnerHTML={{
                __html: aboutTheGame,
              }}
              className={`description-card__body ${
                isExpanded
                  ? "description-card__body--expanded"
                  : isOverflowing
                    ? "description-card__body--collapsed"
                    : ""
              }`}
            />
            {isOverflowing && (
              <button
                type="button"
                className="description-card__toggle"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? t("show_less") : t("show_more")}
              </button>
            )}
          </>
        ) : (
          <p
            className="description-card__body"
            style={{ color: "var(--muted-color, #f0f1f7)" }}
          >
            {t("no_shop_details")}
          </p>
        )}
      </div>
    </div>
  );
}
