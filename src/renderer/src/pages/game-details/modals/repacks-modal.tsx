import { useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  AlertIcon,
  PlusCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DownloadIcon,
} from "@primer/octicons-react";
import { Inbox, Loader2 } from "lucide-react";
import { Tooltip } from "react-tooltip";

import {
  Badge,
  Button,
  Modal,
  TextField,
  CheckboxField,
} from "@renderer/components";
import type { DownloadSource, Game, GameRepack } from "@types";

import { DownloadSettingsModal } from "./download-settings-modal";
import { gameDetailsContext } from "@renderer/context";
import { Downloader } from "@shared";
import { orderBy } from "lodash-es";
import { useDate, useAppDispatch, useAppSelector } from "@renderer/hooks";
import { clearNewDownloadOptions } from "@renderer/features";
import { levelDBService } from "@renderer/services/leveldb.service";
import { getGameKey } from "@renderer/helpers";
import "./repacks-modal.scss";

export interface RepacksModalProps {
  visible: boolean;
  startDownload: (
    repack: GameRepack,
    downloader: Downloader,
    downloadPath: string,
    automaticallyExtract: boolean,
    addToQueueOnly?: boolean,
    fileIndices?: number[],
    selectedFilesSize?: number | null,
    automaticallyDeleteArchiveFiles?: boolean,
    signal?: AbortSignal
  ) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}

export function RepacksModal({
  visible,
  startDownload,
  onClose,
}: Readonly<RepacksModalProps>) {
  const [filteredRepacks, setFilteredRepacks] = useState<GameRepack[]>([]);
  const [repack, setRepack] = useState<GameRepack | null>(null);
  const [showSelectFolderModal, setShowSelectFolderModal] = useState(false);
  const [downloadSources, setDownloadSources] = useState<DownloadSource[]>([]);
  const [isLoadingDownloadSources, setIsLoadingDownloadSources] =
    useState(true);
  const [downloadSourcesLoadError, setDownloadSourcesLoadError] =
    useState<"broken" | null>(null);
  const [sourcesRevision, setSourcesRevision] = useState(0);
  const [selectedFingerprints, setSelectedFingerprints] = useState<string[]>(
    []
  );
  const [filterTerm, setFilterTerm] = useState("");

  const [lastCheckTimestamp, setLastCheckTimestamp] = useState<string | null>(
    null
  );
  const [isLoadingTimestamp, setIsLoadingTimestamp] = useState(true);
  const [viewedRepackIds, setViewedRepackIds] = useState<Set<string>>(
    new Set()
  );

  const [activeTab, setActiveTab] = useState<"hydra" | "steam">("hydra");
  const [isOwned, setIsOwned] = useState<boolean | null>(null);
  const [isCheckingOwnership, setIsCheckingOwnership] = useState(false);
  const [isSteamLoggedIn, setIsSteamLoggedIn] = useState(false);

  const { game, repacks } = useContext(gameDetailsContext);

  const { t } = useTranslation("game_details");

  const { formatDate } = useDate();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      setIsLoadingDownloadSources(true);
      setDownloadSourcesLoadError(null);
      try {
        const sources = await window.electron.getDownloadSources();
        if (cancelled) return;
        setDownloadSources(orderBy(sources ?? [], "createdAt", "desc"));
      } catch (error) {
        if (cancelled) return;
        // The fetch is async IPC and not a true network call, so we treat any
        // thrown error as a broken-source state. The retry button re-runs this.
        console.error("Failed to load download sources:", error);
        setDownloadSourcesLoadError("broken");
      } finally {
        if (!cancelled) setIsLoadingDownloadSources(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sourcesRevision]);

  const handleRetryFetchSources = () => {
    setSourcesRevision((prev) => prev + 1);
  };

  useEffect(() => {
    const fetchLastCheckTimestamp = async () => {
      setIsLoadingTimestamp(true);

      try {
        const timestamp = (await levelDBService.get(
          "downloadSourcesSinceValue",
          null,
          "utf8"
        )) as string | null;

        setLastCheckTimestamp(timestamp);
      } catch {
        setLastCheckTimestamp(null);
      } finally {
        setIsLoadingTimestamp(false);
      }
    };

    if (visible && userPreferences?.enableNewDownloadOptionsBadges !== false) {
      fetchLastCheckTimestamp();
    } else {
      setIsLoadingTimestamp(false);
    }
  }, [visible, repacks, userPreferences?.enableNewDownloadOptionsBadges]);

  useEffect(() => {
    if (
      visible &&
      game?.newDownloadOptionsCount &&
      game.newDownloadOptionsCount > 0
    ) {
      const gameKey = getGameKey(game.shop, game.objectId);
      levelDBService
        .get(gameKey, "games")
        .then((gameData) => {
          if (gameData) {
            const updated = {
              ...(gameData as Game),
              newDownloadOptionsCount: undefined,
            };
            return levelDBService.put(gameKey, updated, "games");
          }
          return Promise.resolve();
        })
        .catch(() => {});

      const gameId = `${game.shop}:${game.objectId}`;
      dispatch(clearNewDownloadOptions({ gameId }));
    }
  }, [visible, game, dispatch]);

  useEffect(() => {
    if (visible && game?.shop === "steam") {
      window.electron.steamGetLoginStatus().then((status) => {
        setIsSteamLoggedIn(status.status === "logged-in");
      });
    } else {
      setIsSteamLoggedIn(false);
    }
  }, [visible, game?.shop]);

  useEffect(() => {
    let cancelled = false;

    if (activeTab === "steam" && isSteamLoggedIn && game?.objectId) {
      setIsCheckingOwnership(true);
      setIsOwned(null);
      window.electron
        .steamCheckOwnership(game.objectId)
        .then((owned) => {
          if (!cancelled) setIsOwned(owned);
        })
        .catch(() => {
          if (!cancelled) setIsOwned(false);
        })
        .finally(() => {
          if (!cancelled) setIsCheckingOwnership(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [activeTab, isSteamLoggedIn, game?.objectId]);

  const handleInstallViaSteam = async () => {
    if (game) {
      try {
        await window.electron.steamInstallGame(game.objectId);
        onClose();
      } catch {
        // Keep modal open so user can try again or pick a Hydra source
      }
    }
  };

  const sortedRepacks = useMemo(() => {
    return orderBy(repacks, [(repack) => repack.uploadDate], ["desc"]);
  }, [repacks]);

  const getRepackAvailabilityStatus = (
    repack: GameRepack
  ): "online" | "partial" | "offline" => {
    const unavailableSet = new Set(repack.unavailableUris ?? []);
    const availableCount = repack.uris.filter(
      (uri) => !unavailableSet.has(uri)
    ).length;
    const unavailableCount = repack.uris.length - availableCount;

    if (unavailableCount === 0) return "online";
    if (availableCount === 0) return "offline";
    return "partial";
  };

  useEffect(() => {
    const term = filterTerm.trim().toLowerCase();

    const byTerm = sortedRepacks.filter((repack) => {
      if (!term) return true;
      const lowerTitle = repack.title.toLowerCase();
      const lowerRepacker = repack.downloadSourceName.toLowerCase();
      return lowerTitle.includes(term) || lowerRepacker.includes(term);
    });

    const bySource = byTerm.filter((repack) => {
      if (selectedFingerprints.length === 0) return true;

      return downloadSources.some(
        (src) =>
          src.fingerprint &&
          selectedFingerprints.includes(src.fingerprint) &&
          src.name === repack.downloadSourceName
      );
    });

    setFilteredRepacks(bySource);
  }, [sortedRepacks, filterTerm, selectedFingerprints, downloadSources]);

  const handleRepackClick = (repack: GameRepack) => {
    setRepack(repack);
    setShowSelectFolderModal(true);
    setViewedRepackIds((prev) => new Set(prev).add(repack.id));
  };

  const handleFilter: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    setFilterTerm(event.target.value);
  };

  const toggleFingerprint = (fingerprint: string) => {
    setSelectedFingerprints((prev) =>
      prev.includes(fingerprint)
        ? prev.filter((f) => f !== fingerprint)
        : [...prev, fingerprint]
    );
  };

  const checkIfLastDownloadedOption = (repack: GameRepack) => {
    if (!game?.download) return false;
    return repack.uris.some((uri) => uri.includes(game.download!.uri));
  };

  const isNewRepack = (repack: GameRepack): boolean => {
    if (isLoadingTimestamp) return false;

    if (viewedRepackIds.has(repack.id)) return false;

    if (!lastCheckTimestamp || !repack.createdAt) {
      return false;
    }

    try {
      const lastCheckDate = new Date(lastCheckTimestamp);

      if (isNaN(lastCheckDate.getTime())) {
        return false;
      }

      const lastCheckUtc = lastCheckDate.toISOString();

      return repack.createdAt > lastCheckUtc;
    } catch {
      return false;
    }
  };

  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  useEffect(() => {
    if (!visible) {
      setFilterTerm("");
      setSelectedFingerprints([]);
      setIsFilterDrawerOpen(false);
      setActiveTab("hydra");
      setIsOwned(null);
    }
  }, [visible]);

  const showSteamTab = game?.shop === "steam" && isSteamLoggedIn;

  return (
    <>
      <DownloadSettingsModal
        visible={showSelectFolderModal}
        onClose={() => setShowSelectFolderModal(false)}
        startDownload={startDownload}
        repack={repack}
      />

      <Modal
        visible={visible}
        title={t("download_options_title")}
        description={t("repacks_modal_description")}
        onClose={onClose}
      >
        {showSteamTab && (
          <div className="repacks-modal__tabs">
            <button
              type="button"
              className={`repacks-modal__tab ${activeTab === "hydra" ? "repacks-modal__tab--active" : ""}`}
              onClick={() => setActiveTab("hydra")}
            >
              {t("hydra_sources")}
            </button>
            <button
              type="button"
              className={`repacks-modal__tab ${activeTab === "steam" ? "repacks-modal__tab--active" : ""}`}
              onClick={() => setActiveTab("steam")}
            >
              {t("steam_store")}
            </button>
          </div>
        )}

        {activeTab === "hydra" ? (
          <>
            {isLoadingDownloadSources ? (
              <div
                className="repacks-modal__empty-state"
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                <div className="repacks-modal__empty-state-icon repacks-modal__empty-state-icon--info repacks-modal__empty-state-icon--spinner">
                  <Loader2
                    size={48}
                    className="repacks-modal__spinner"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="repacks-modal__empty-state-title">
                  {t("downloads_loading")}
                </h3>
              </div>
            ) : downloadSourcesLoadError ? (
              <div className="repacks-modal__empty-state" role="alert">
                <div className="repacks-modal__empty-state-icon repacks-modal__empty-state-icon--warning">
                  <AlertIcon size={48} aria-hidden="true" />
                </div>
                <h3 className="repacks-modal__empty-state-title">
                  {t("downloads_sources_broken_title")}
                </h3>
                <p className="repacks-modal__empty-state-description">
                  {t("downloads_sources_broken_description")}
                </p>
                <Button
                  type="button"
                  theme="primary"
                  onClick={handleRetryFetchSources}
                  className="repacks-modal__empty-state-action"
                >
                  {t("downloads_error_retry")}
                </Button>
              </div>
            ) : downloadSources.length === 0 ? (
              <div className="repacks-modal__empty-state">
                <div className="repacks-modal__empty-state-icon repacks-modal__empty-state-icon--warning">
                  <AlertIcon size={48} />
                </div>
                <h3 className="repacks-modal__empty-state-title">
                  {t("no_download_source_title")}
                </h3>
                <p className="repacks-modal__empty-state-description">
                  {t("no_download_source_description")}
                </p>
                <Button
                  type="button"
                  theme="primary"
                  onClick={() => {
                    onClose();
                    navigate("/settings?tab=2");
                  }}
                  className="repacks-modal__empty-state-action"
                >
                  <PlusCircleIcon />
                  {t("add_download_source", { ns: "settings" })}
                </Button>
              </div>
            ) : repacks.length === 0 ? (
              <div className="repacks-modal__empty-state">
                <div className="repacks-modal__empty-state-icon repacks-modal__empty-state-icon--info">
                  <Inbox size={48} />
                </div>
                <h3 className="repacks-modal__empty-state-title">
                  {t("no_available_downloads_title")}
                </h3>
                <p className="repacks-modal__empty-state-description">
                  {t("no_available_downloads_description")}
                </p>
                <Button
                  type="button"
                  theme="primary"
                  onClick={() => {
                    onClose();
                    navigate("/settings?tab=2");
                  }}
                  className="repacks-modal__empty-state-action"
                >
                  <PlusCircleIcon />
                  {t("no_available_downloads_action")}
                </Button>
              </div>
            ) : (
              <>
                <div
                  className={`repacks-modal__filter-container ${isFilterDrawerOpen ? "repacks-modal__filter-container--drawer-open" : ""}`}
                >
                  <div className="repacks-modal__filter-top">
                    <TextField
                      placeholder={t("filter")}
                      value={filterTerm}
                      onChange={handleFilter}
                    />
                    {downloadSources.length > 0 && (
                      <Button
                        type="button"
                        theme="outline"
                        onClick={() =>
                          setIsFilterDrawerOpen(!isFilterDrawerOpen)
                        }
                        className="repacks-modal__filter-toggle"
                      >
                        {t("filter_by_source")}
                        {isFilterDrawerOpen ? (
                          <ChevronUpIcon />
                        ) : (
                          <ChevronDownIcon />
                        )}
                      </Button>
                    )}
                  </div>

                  <div
                    className={`repacks-modal__download-sources ${isFilterDrawerOpen ? "repacks-modal__download-sources--open" : ""}`}
                  >
                    <div className="repacks-modal__source-grid">
                      {downloadSources
                        .filter(
                          (
                            source
                          ): source is DownloadSource & {
                            fingerprint: string;
                          } => source.fingerprint !== undefined
                        )
                        .map((source) => {
                          const label = source.name || source.url;
                          const truncatedLabel =
                            label.length > 16
                              ? label.substring(0, 16) + "..."
                              : label;
                          return (
                            <div
                              key={source.fingerprint}
                              className="repacks-modal__source-item"
                            >
                              <CheckboxField
                                label={truncatedLabel}
                                checked={selectedFingerprints.includes(
                                  source.fingerprint
                                )}
                                onChange={() =>
                                  toggleFingerprint(source.fingerprint)
                                }
                              />
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>

                <div className="repacks-modal__repacks">
                  {filteredRepacks.length === 0 ? (
                    <div className="repacks-modal__no-results">
                      <div className="repacks-modal__no-results-content">
                        <div className="repacks-modal__no-results-text">
                          {t("no_repacks_found")}
                        </div>
                        <div className="repacks-modal__no-results-button">
                          <Button
                            type="button"
                            theme="primary"
                            onClick={() => {
                              onClose();
                              navigate("/settings?tab=2");
                            }}
                          >
                            <PlusCircleIcon />
                            {t("add_download_source", { ns: "settings" })}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    filteredRepacks.map((repack) => {
                      const isLastDownloadedOption =
                        checkIfLastDownloadedOption(repack);
                      const availabilityStatus =
                        getRepackAvailabilityStatus(repack);
                      const tooltipId = `availability-orb-${repack.id}`;

                      return (
                        <Button
                          key={repack.id}
                          theme="dark"
                          onClick={() => handleRepackClick(repack)}
                          className="repacks-modal__repack-button"
                        >
                          <span
                            className={`repacks-modal__availability-orb repacks-modal__availability-orb--${availabilityStatus}`}
                            data-tooltip-id={tooltipId}
                            data-tooltip-content={t(
                              `source_${availabilityStatus}`
                            )}
                          />
                          <Tooltip id={tooltipId} />

                          <p className="repacks-modal__repack-title">
                            {repack.title}
                            {userPreferences?.enableNewDownloadOptionsBadges !==
                              false &&
                              isNewRepack(repack) && (
                                <span className="repacks-modal__new-badge">
                                  {t("new_download_option")}
                                </span>
                              )}
                          </p>

                          {isLastDownloadedOption && (
                            <Badge>{t("last_downloaded_option")}</Badge>
                          )}

                          <p className="repacks-modal__repack-info">
                            {repack.fileSize} - {repack.downloadSourceName} -{" "}
                            {repack.uploadDate
                              ? formatDate(repack.uploadDate)
                              : ""}
                          </p>
                        </Button>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="repacks-modal__steam-store">
            {isCheckingOwnership ? (
              <p className="repacks-modal__steam-store-status">
                {t("checking_ownership")}
              </p>
            ) : isOwned ? (
              <Button
                onClick={handleInstallViaSteam}
                theme="outline"
                className="repacks-modal__steam-install-button"
              >
                <DownloadIcon />
                {t("install_via_steam")}
              </Button>
            ) : (
              <div className="repacks-modal__steam-not-owned">
                <p className="repacks-modal__steam-not-owned-text">
                  {t("not_in_steam_library")}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
