import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DownloadIcon,
  GearIcon,
  HeartFillIcon,
  HeartIcon,
  PinIcon,
  PinSlashIcon,
  PlayIcon,
  PlusCircleIcon,
  ListUnorderedIcon,
} from "@primer/octicons-react";
import { XCircle } from "lucide-react";

import {
  Button,
  ConfirmationModal,
  WatchlistModal,
} from "@renderer/components";
import {
  useDownload,
  useLibrary,
  useToast,
  useUserDetails,
  useWatchlist,
} from "@renderer/hooks";
import { useNavigate } from "react-router-dom";
import { gameDetailsContext } from "@renderer/context";
import { getClassicsLaunchErrorCode } from "@renderer/helpers";
import { DiscSelectionModal } from "../modals/disc-selection-modal";

import { useEffect } from "react";
import { formatDownloadProgress } from "@renderer/helpers";

import "./dashboard-card.scss";
import "./play-status-card.scss";

export function PlayStatusCard() {
  const [toggleLibraryGameDisabled, setToggleLibraryGameDisabled] =
    useState(false);
  const { isGameDeleting, lastPacket } = useDownload();
  const { userDetails } = useUserDetails();

  const {
    game,
    repacks,
    isGameRunning,
    shop,
    objectId,
    gameTitle,
    shopDetails,
    setShowGameOptionsModal,
    setGameOptionsInitialCategory,
    setShowRepacksModal,
    updateGame,
    selectGameExecutable,
    isTransferring,
    transferProgress,
  } = useContext(gameDetailsContext);

  const { updateLibrary } = useLibrary();
  const { showSuccessToast, showErrorToast } = useToast();
  const navigate = useNavigate();

  const {
    isGameWatchlisted,
    loadWatchlist,
    hasLoaded: watchlistHasLoaded,
  } = useWatchlist();

  const [showWatchlistModal, setShowWatchlistModal] = useState(false);
  const [showDiscSelectionModal, setShowDiscSelectionModal] = useState(false);
  const [pendingClassicsLaunch, setPendingClassicsLaunch] = useState<{
    discPath: string | undefined;
  } | null>(null);

  const { progress } = useDownload();

  const { t } = useTranslation("game_details");

  useEffect(() => {
    if (!watchlistHasLoaded) {
      loadWatchlist();
    }
  }, [watchlistHasLoaded, loadWatchlist]);

  useEffect(() => {
    const onOpenDiscSelection = (event: Event) => {
      const detail = (event as CustomEvent<{ objectId?: string }>).detail;
      if (!detail?.objectId || detail.objectId === game?.objectId) {
        if (game?.shop === "launchbox" && (game?.discs?.length ?? 0) > 1) {
          setShowDiscSelectionModal(true);
        }
      }
    };
    window.addEventListener(
      "hydra:openDiscSelection",
      onOpenDiscSelection as EventListener
    );
    return () => {
      window.removeEventListener(
        "hydra:openDiscSelection",
        onOpenDiscSelection as EventListener
      );
    };
  }, [game?.objectId, game?.shop, game?.discs?.length]);

  useEffect(() => {
    const handler = () => {
      updateLibrary();
      updateGame();
    };

    const events = [
      "hydra:game-favorite-toggled",
      "hydra:game-removed-from-library",
      "hydra:game-files-removed",
    ];
    events.forEach((e) => window.addEventListener(e, handler as EventListener));
    return () => {
      events.forEach((e) =>
        window.removeEventListener(e, handler as EventListener)
      );
    };
  }, [updateLibrary, updateGame]);

  const addGameToLibrary = async () => {
    setToggleLibraryGameDisabled(true);
    try {
      await window.electron.addGameToLibrary(
        shop,
        objectId!,
        gameTitle,
        shopDetails?.platform ?? null
      );
      updateLibrary();
      updateGame();
    } finally {
      setToggleLibraryGameDisabled(false);
    }
  };

  const toggleGameFavorite = async () => {
    setToggleLibraryGameDisabled(true);
    try {
      if (game?.favorite && objectId) {
        await window.electron.removeGameFromFavorites(shop, objectId);
        showSuccessToast(t("game_removed_from_favorites"));
      } else {
        if (!objectId) return;
        await window.electron.addGameToFavorites(shop, objectId);
        showSuccessToast(t("game_added_to_favorites"));
      }
      updateLibrary();
      updateGame();
    } finally {
      setToggleLibraryGameDisabled(false);
    }
  };

  const toggleGamePinned = async () => {
    setToggleLibraryGameDisabled(true);
    try {
      if (game?.isPinned && objectId) {
        await window.electron.toggleGamePin(shop, objectId, false);
        showSuccessToast(t("game_removed_from_pinned"));
      } else {
        if (!objectId) return;
        await window.electron.toggleGamePin(shop, objectId, true);
        showSuccessToast(t("game_added_to_pinned"));
      }
      updateLibrary();
      updateGame();
    } finally {
      setToggleLibraryGameDisabled(false);
    }
  };

  const launchClassicsWithErrorHandling = async (
    discPath?: string,
    force?: boolean
  ): Promise<void> => {
    if (!game) return;
    try {
      await window.electron.openClassicsGame(
        game.shop,
        game.objectId,
        discPath,
        force
      );
    } catch (error) {
      const code = getClassicsLaunchErrorCode(error);
      if (code === "EMULATOR_NOT_CONFIGURED") {
        showErrorToast(t("emulator_not_configured_toast"));
        navigate("/settings?tab=emulation");
      } else if (code === "PLATFORM_UNKNOWN") {
        showErrorToast(t("platform_unknown_toast"));
      } else if (code === "NO_DISC") {
        showErrorToast(t("no_disc_toast"));
      } else if (code === "EMULATOR_ALREADY_RUNNING") {
        setPendingClassicsLaunch({ discPath });
      } else {
        showErrorToast(t("launch_failed_toast"));
      }
    }
  };

  const openClassicsGame = async () => {
    if (!game) return;
    const discs = game.discs ?? [];
    if (discs.length <= 1) {
      await launchClassicsWithErrorHandling();
      return;
    }
    if (game.dontAskDiscSelection && game.selectedDiscPath) {
      await launchClassicsWithErrorHandling(game.selectedDiscPath);
      return;
    }
    setShowDiscSelectionModal(true);
  };

  const handleDiscSelectionConfirm = async (
    discPath: string,
    dontAskAgain: boolean
  ) => {
    if (!game) return;
    setShowDiscSelectionModal(false);
    try {
      await window.electron.updateClassicsDisc(game.shop, game.objectId, {
        selectedDiscPath: discPath,
        dontAskDiscSelection: dontAskAgain,
      });
      updateGame();
    } catch {
      // non-fatal
    }
    await launchClassicsWithErrorHandling(discPath);
  };

  const openGame = async () => {
    if (!game) return;
    if (game.shop === "launchbox") {
      await openClassicsGame();
      return;
    }
    if (game.executablePath) {
      window.electron.openGame(
        game.shop,
        game.objectId,
        game.executablePath,
        game.launchOptions
      );
      return;
    }
    const gameExecutablePath = await selectGameExecutable();
    if (gameExecutablePath)
      window.electron.openGame(
        game.shop,
        game.objectId,
        gameExecutablePath,
        game.launchOptions
      );
  };

  const closeGame = () => {
    if (game) window.electron.closeGame(game.shop, game.objectId);
  };

  const deleting = game ? isGameDeleting(game?.id) : false;
  const isGameDownloading =
    game?.download?.status === "active" && lastPacket?.gameId === game?.id;

  const watchlisted = isGameWatchlisted(shop, objectId ?? "");

  const watchlistGame = {
    id: `${shop}:${objectId}`,
    objectId: objectId ?? "",
    title: gameTitle,
    shop,
    genres: (shopDetails?.genres ?? []).map((g) =>
      typeof g === "string" ? g : g.name
    ),
    releaseYear: shopDetails?.release_date?.date
      ? new Date(shopDetails.release_date.date).getFullYear()
      : null,
    libraryImageUrl:
      shopDetails?.assets?.libraryImageUrl ?? game?.libraryImageUrl ?? null,
    downloadSources: shopDetails?.assets?.downloadSources ?? [],
  };

  const hasDownload =
    game?.download?.status &&
    ["active", "paused"].includes(game.download.status) &&
    game.download.progress !== 1;

  const getStatusText = () => {
    if (isTransferring) return t("transferring");
    if (isGameRunning) return t("playing_now");
    if (game?.lastTimePlayed) return t("ready_to_play");
    if (game) return t("not_played_yet", { title: game.title });
    if (repacks.length) return t("download_options", { count: repacks.length });
    return t("no_downloads");
  };

  const getSubStatusText = () => {
    if (isTransferring) {
      return formatDownloadProgress(transferProgress);
    }
    if (hasDownload) {
      return isGameDownloading
        ? progress
        : formatDownloadProgress(game?.download?.progress);
    }
    return null;
  };

  const getActionButton = () => {
    if (isTransferring) {
      return (
        <Button
          theme="outline"
          className="play-status-card__action"
          onClick={() => {
            setGameOptionsInitialCategory("locations");
            setShowGameOptionsModal(true);
          }}
        >
          {t("transferring")} {Math.round(transferProgress * 100)}%
        </Button>
      );
    }

    if (isGameRunning) {
      return (
        <Button
          onClick={closeGame}
          theme="outline"
          disabled={deleting}
          className="play-status-card__action"
        >
          <XCircle size={18} />
          {t("close")}
        </Button>
      );
    }

    const isPlayableClassics =
      game?.shop === "launchbox" && (game?.discs?.length ?? 0) > 0;

    if (game?.executablePath || isPlayableClassics) {
      return (
        <Button
          onClick={openGame}
          theme="outline"
          disabled={deleting || isGameRunning}
          className="play-status-card__action"
        >
          <PlayIcon />
          {t("play")}
        </Button>
      );
    }

    if (repacks.length > 0) {
      return (
        <Button
          onClick={() => setShowRepacksModal(true)}
          theme="outline"
          disabled={isGameDownloading}
          className="play-status-card__action"
        >
          <DownloadIcon />
          {t("download")}
        </Button>
      );
    }

    return null;
  };

  return (
    <div className="dashboard-card play-status-card">
      <div className="dashboard-card__header">
        <span className="dashboard-card__header-icon">
          {isGameRunning ? <PlayIcon size={16} /> : <DownloadIcon size={16} />}
        </span>
        <h3 className="dashboard-card__header-title">
          {game ? t("game_status") : t("download")}
        </h3>
      </div>

      <div className="dashboard-card__body">
        <div className="play-status-card__status">
          <span className="play-status-card__status-text">
            {getStatusText()}
          </span>
          {getSubStatusText() && (
            <span className="play-status-card__status-subtext">
              {getSubStatusText()}
            </span>
          )}
        </div>

        <div className="play-status-card__actions">
          {/* Primary action button — prominent Play/Download */}
          {(game || repacks.length > 0) && (
            <div className="play-status-card__primary-action">
              {getActionButton()}
            </div>
          )}

          {/* Add to library when game not owned */}
          {!game && (
            <div className="play-status-card__secondary-actions">
              <Button
                theme="outline"
                disabled={toggleLibraryGameDisabled}
                onClick={addGameToLibrary}
                className="play-status-card__action"
              >
                <PlusCircleIcon />
                {t("add_to_library")}
              </Button>
            </div>
          )}

          {/* Secondary action row */}
          <div className="play-status-card__secondary-actions">
            {/* Watchlist */}
            <Button
              theme="outline"
              onClick={() => setShowWatchlistModal(true)}
              className="play-status-card__action"
            >
              <ListUnorderedIcon />
              {watchlisted
                ? t("in_watchlist", { defaultValue: "In watchlist" })
                : t("add_to_watchlist", { defaultValue: "Add to watchlist" })}
            </Button>

            {game && (
              <>
                <Button
                  onClick={toggleGameFavorite}
                  theme="outline"
                  disabled={deleting || toggleLibraryGameDisabled}
                  className="play-status-card__action play-status-card__action--icon"
                  title={
                    game.favorite
                      ? t("remove_from_favorites")
                      : t("add_to_favorites")
                  }
                >
                  {game.favorite ? <HeartFillIcon /> : <HeartIcon />}
                </Button>

                {userDetails && game.shop !== "custom" && (
                  <Button
                    onClick={toggleGamePinned}
                    theme="outline"
                    disabled={deleting || toggleLibraryGameDisabled}
                    className="play-status-card__action play-status-card__action--icon"
                    title={game.isPinned ? t("unpin_game") : t("pin_game")}
                  >
                    {game.isPinned ? <PinSlashIcon /> : <PinIcon />}
                  </Button>
                )}

                <Button
                  onClick={() => {
                    setGameOptionsInitialCategory("general");
                    setShowGameOptionsModal(true);
                  }}
                  theme="outline"
                  disabled={deleting}
                  className="play-status-card__action play-status-card__action--icon"
                  title={t("options")}
                >
                  <GearIcon />
                </Button>
              </>
            )}
          </div>
        </div>

        {hasDownload && (
          <progress
            max={1}
            value={game?.download?.progress}
            className={`play-status-card__progress-bar ${game?.download?.status === "paused" ? "play-status-card__progress-bar--disabled" : ""}`}
          />
        )}
      </div>

      <WatchlistModal
        visible={showWatchlistModal}
        game={watchlistGame as never}
        onClose={() => setShowWatchlistModal(false)}
      />

      {game?.shop === "launchbox" && (
        <DiscSelectionModal
          visible={showDiscSelectionModal}
          discs={game.discs ?? []}
          defaultDiscPath={game.selectedDiscPath ?? null}
          defaultDontAsk={Boolean(game.dontAskDiscSelection)}
          onClose={() => setShowDiscSelectionModal(false)}
          onConfirm={handleDiscSelectionConfirm}
        />
      )}

      <ConfirmationModal
        visible={pendingClassicsLaunch !== null}
        title={t("rpcs3_already_running_title")}
        descriptionText={t("rpcs3_already_running_description")}
        confirmButtonLabel={t("rpcs3_already_running_confirm")}
        cancelButtonLabel={t("cancel")}
        onClose={() => setPendingClassicsLaunch(null)}
        onConfirm={() => {
          const pending = pendingClassicsLaunch;
          setPendingClassicsLaunch(null);
          if (pending) {
            void launchClassicsWithErrorHandling(pending.discPath, true);
          }
        }}
      />
    </div>
  );
}
