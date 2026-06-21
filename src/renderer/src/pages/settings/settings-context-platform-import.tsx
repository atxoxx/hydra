import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  CheckboxField,
  TextField,
  Button,
  SelectField,
  DiscoveryWizardModal,
} from "@renderer/components";
import { settingsContext } from "@renderer/context";
import { useAppSelector, useToast } from "@renderer/hooks";
import { useSteamLogin } from "@renderer/hooks/use-steam-login";
import type {
  GameShop,
  PlatformScanConfig,
  PlatformGame,
  StoreId,
  StoreStatus,
} from "@types";
import { LinkIcon } from "@primer/octicons-react";
import cn from "classnames";
import type React from "react";
import {
  SteamIcon,
  EpicIcon,
  GogIcon,
  BattlenetIcon,
  AmazonIcon,
  UbisoftIcon,
  EaIcon,
  XboxIcon,
  RockstarIcon,
  ItchioIcon,
  HumbleIcon,
} from "@renderer/assets/store-icons";
import "./settings-platform-import.scss";

interface PlatformInfo {
  shop: GameShop;
  labelKey: string;
  storeId?: StoreId;
  needsApiKey: boolean;
  apiKeyLabel?: string;
  apiKeyPlaceholder?: string;
  setupUrl?: string;
}

const IMPORT_PLATFORMS: PlatformInfo[] = [
  {
    shop: "steam",
    labelKey: "platform_steam",
    needsApiKey: true,
    apiKeyLabel: "steam_web_api_key",
    apiKeyPlaceholder: "steam_web_api_key_placeholder",
    setupUrl: "https://steamcommunity.com/dev/apikey",
  },
  {
    shop: "epic",
    labelKey: "platform_epic",
    storeId: "epic",
    needsApiKey: false,
  },
  { shop: "gog", labelKey: "platform_gog", storeId: "gog", needsApiKey: false },
  {
    shop: "battle-net",
    labelKey: "platform_battle_net",
    storeId: "battle-net",
    needsApiKey: false,
  },
  {
    shop: "amazon",
    labelKey: "platform_amazon",
    storeId: "amazon",
    needsApiKey: false,
  },
  {
    shop: "ubisoft",
    labelKey: "platform_ubisoft",
    storeId: "ubisoft",
    needsApiKey: false,
  },
  { shop: "ea", labelKey: "platform_ea", storeId: "ea", needsApiKey: false },
  {
    shop: "xbox",
    labelKey: "platform_xbox",
    storeId: "xbox",
    needsApiKey: false,
  },
  { shop: "rockstar", labelKey: "platform_rockstar", needsApiKey: false },
  { shop: "itch-io", labelKey: "platform_itch_io", needsApiKey: false },
  {
    shop: "humble",
    labelKey: "platform_humble",
    storeId: "humble",
    needsApiKey: false,
  },
];

/** Map each platform shop to its SVG icon component */
const PLATFORM_ICON_MAP: Partial<
  Record<GameShop, React.ComponentType<{ className?: string }>>
> = {
  steam: SteamIcon,
  epic: EpicIcon,
  gog: GogIcon,
  "battle-net": BattlenetIcon,
  amazon: AmazonIcon,
  ubisoft: UbisoftIcon,
  ea: EaIcon,
  xbox: XboxIcon,
  rockstar: RockstarIcon,
  "itch-io": ItchioIcon,
  humble: HumbleIcon,
};

/* Store types that use browser OAuth (need explicit Login button) */
const BROWSER_OAUTH_STORES = new Set<StoreId>(["epic", "gog", "xbox"]);

/* Store types that auto-detect local data (show Scan button) */
const AUTODETECT_STORES = new Set<StoreId>([
  "amazon",
  "humble",
  "ubisoft",
  "ea",
  "battle-net",
]);

export function SettingsContextPlatformImport() {
  const { t } = useTranslation("settings");
  const { updateUserPreferences } = useContext(settingsContext);

  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );

  const [enablePlatformImport, setEnablePlatformImport] = useState(false);
  const [steamApiKey, setSteamApiKey] = useState("");
  const [steamFamilyShareIds, setSteamFamilyShareIds] = useState("");
  const [scanInstalled, setScanInstalled] = useState<Record<string, boolean>>(
    {}
  );
  const [fetchOwned, setFetchOwned] = useState<Record<string, boolean>>({});
  const [importPreference, setImportPreference] = useState<"wizard" | "auto">(
    "wizard"
  );
  const [scanningStatus, setScanningStatus] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [discoveredGames, setDiscoveredGames] = useState<PlatformGame[]>([]);
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [showSteamExtras, setShowSteamExtras] = useState(false);

  /* Store integration state */
  const [storeStatuses, setStoreStatuses] = useState<StoreStatus[]>([]);
  const [storeActions, setStoreActions] = useState<Record<string, string>>({});

  const { showSuccessToast, showErrorToast } = useToast();

  const steamLogin = useSteamLogin();

  /* Load store statuses on mount and listen for updates */
  useEffect(() => {
    window.electron
      .getStoreStatuses()
      .then(setStoreStatuses)
      .catch(() => {});

    const unsubscribe = window.electron.onStoreSyncStatusUpdate((statuses) => {
      setStoreStatuses(statuses);
    });

    return unsubscribe;
  }, []);

  const getStoreStatus = (storeId: StoreId): StoreStatus | undefined =>
    storeStatuses.find((s) => s.storeId === storeId);

  /* Load from user preferences */
  useEffect(() => {
    if (!userPreferences) return;

    const platformConfigs = userPreferences.platformScanConfigs ?? {};
    const hasAnyEnabled = Object.values(platformConfigs).some(
      (cfg) => (cfg as Partial<PlatformScanConfig>)?.enabled
    );

    setEnablePlatformImport(hasAnyEnabled);
    setSteamApiKey(userPreferences.steamApiKey ?? "");
    setSteamFamilyShareIds(
      (userPreferences.steamFamilyShareIds ?? []).join(", ")
    );
    setImportPreference(userPreferences.importDiscoveryPreference ?? "wizard");

    const scanInstalledMap: Record<string, boolean> = {};
    const fetchOwnedMap: Record<string, boolean> = {};

    for (const platform of IMPORT_PLATFORMS) {
      const cfg = platformConfigs[platform.shop] as
        | Partial<PlatformScanConfig>
        | undefined;
      scanInstalledMap[platform.shop] = cfg?.scanInstalled ?? true;
      fetchOwnedMap[platform.shop] = cfg?.fetchOwned ?? false;
    }

    setScanInstalled(scanInstalledMap);
    setFetchOwned(fetchOwnedMap);
  }, [userPreferences]);

  const savePlatformConfigs = async (
    newEnablePlatformImport: boolean,
    newScanInstalled: Record<string, boolean>,
    newFetchOwned: Record<string, boolean>
  ) => {
    const configs: Record<string, PlatformScanConfig> = {};

    for (const platform of IMPORT_PLATFORMS) {
      configs[platform.shop] = {
        enabled: newEnablePlatformImport,
        scanPaths: [],
        scanInstalled: newScanInstalled[platform.shop] ?? true,
        fetchOwned: newFetchOwned[platform.shop] ?? false,
        apiKey: platform.shop === "steam" ? steamApiKey || null : null,
        familyShareIds:
          platform.shop === "steam"
            ? parseSteamIds(steamFamilyShareIds)
            : undefined,
      };
    }

    await updateUserPreferences({
      platformScanConfigs: configs,
    });
  };

  const handleToggleEnable = async () => {
    const next = !enablePlatformImport;
    setEnablePlatformImport(next);
    await savePlatformConfigs(next, scanInstalled, fetchOwned);
  };

  const handleToggleScanInstalled = async (shop: GameShop) => {
    const next = { ...scanInstalled, [shop]: !scanInstalled[shop] };
    setScanInstalled(next);
    await savePlatformConfigs(enablePlatformImport, next, fetchOwned);
  };

  const handleSteamApiKeyChange = async (value: string) => {
    setSteamApiKey(value);
    await updateUserPreferences({ steamApiKey: value || null });
  };

  const handleSteamFamilyShareIdsChange = async (value: string) => {
    setSteamFamilyShareIds(value);
    const ids = parseSteamIds(value);
    await updateUserPreferences({ steamFamilyShareIds: ids });
  };

  const handleImportPreferenceChange = async (value: "wizard" | "auto") => {
    setImportPreference(value);
    await updateUserPreferences({ importDiscoveryPreference: value });
  };

  /* Store action handlers */
  const handleStoreLogin = async (storeId: StoreId) => {
    if (storeActions[storeId]) return;
    setStoreActions((prev) => ({ ...prev, [storeId]: "logging-in" }));
    try {
      const result = await window.electron.storeLogin(storeId);
      if (result.success) {
        showSuccessToast(t("store_login_success"));
        const statuses = await window.electron.getStoreStatuses();
        setStoreStatuses(statuses);
      } else {
        showErrorToast(t("store_login_failed"), result.error ?? undefined);
      }
    } catch (err: any) {
      showErrorToast(t("store_login_failed"), err?.message);
    } finally {
      setStoreActions((prev) => {
        const next = { ...prev };
        delete next[storeId];
        return next;
      });
    }
  };

  const handleStoreSync = async (storeId: StoreId) => {
    if (storeActions[storeId]) return;
    setStoreActions((prev) => ({ ...prev, [storeId]: "syncing" }));
    try {
      const result = await window.electron.storeSync(storeId);
      const statuses = await window.electron.getStoreStatuses();
      setStoreStatuses(statuses);

      if (result.success && result.gamesSynced > 0) {
        showSuccessToast(
          t("store_sync_success", { count: result.gamesSynced })
        );
      } else if (result.success) {
        showSuccessToast(t("store_sync_no_games"));
      } else {
        showErrorToast(t("store_sync_failed"), result.error ?? undefined);
      }
    } catch (err: any) {
      showErrorToast(t("store_sync_failed"), err?.message);
    } finally {
      setStoreActions((prev) => {
        const next = { ...prev };
        delete next[storeId];
        return next;
      });
    }
  };

  const handleStoreLogout = async (storeId: StoreId) => {
    await window.electron.storeLogout(storeId);
    const statuses = await window.electron.getStoreStatuses();
    setStoreStatuses(statuses);
  };

  /* For auto-detect stores, trigger detection + sync */
  const handleAutoDetectSync = async (storeId: StoreId) => {
    if (storeActions[storeId]) return;
    setStoreActions((prev) => ({ ...prev, [storeId]: "scanning" }));
    try {
      await window.electron.storeLogin(storeId);
      const result = await window.electron.storeSync(storeId);
      const statuses = await window.electron.getStoreStatuses();
      setStoreStatuses(statuses);

      if (result.success && result.gamesSynced > 0) {
        showSuccessToast(
          t("store_sync_success", { count: result.gamesSynced })
        );
      } else if (result.success) {
        showSuccessToast(t("store_sync_no_games"));
      } else {
        showErrorToast(t("store_sync_failed"), result.error ?? undefined);
      }
    } catch (err: any) {
      showErrorToast(t("store_sync_failed"), err?.message);
    } finally {
      setStoreActions((prev) => {
        const next = { ...prev };
        delete next[storeId];
        return next;
      });
    }
  };

  const handleScanNow = async () => {
    setScanningStatus(t("scanning_platforms"));
    try {
      const result = await window.electron.scanPlatforms();

      const platformKeys: Array<keyof typeof result> = [
        "epic",
        "gog",
        "battle-net",
        "amazon",
        "ubisoft",
        "xbox",
        "rockstar",
        "itch-io",
        "humble",
      ];

      const allGames = platformKeys.flatMap((key) => result[key].games);
      const totalGames = allGames.length;

      if (totalGames > 0) {
        if (importPreference === "auto") {
          await window.electron.importPlatformGames(allGames);
          setScanningStatus(
            t("scan_games_complete_description", {
              count: totalGames,
              ns: "notifications",
            })
          );
        } else {
          setDiscoveredGames(allGames);
          setShowDiscoveryModal(true);
        }
      } else {
        setScanningStatus(
          t("scan_games_no_results_description", { ns: "notifications" })
        );
      }
    } catch (_err) {
      setScanningStatus(t("scan_failed"));
    } finally {
      setTimeout(() => setScanningStatus(null), 5000);
    }
  };

  const handleSteamSync = async () => {
    setSyncStatus(t("steam_syncing"));
    steamLogin.setSyncing();
    try {
      const result = await window.electron.steamSync();
      steamLogin.setLastSyncAt(new Date().toISOString());
      steamLogin.setLoggedIn();

      if (result.errors.length > 0) {
        setSyncStatus(
          t("steam_sync_complete_with_errors", {
            imported: result.imported,
            updated: result.updated,
            errors: result.errors.length,
          })
        );
      } else {
        setSyncStatus(
          t("steam_sync_complete", {
            imported: result.imported,
            updated: result.updated,
          })
        );
      }
    } catch {
      steamLogin.setLoggedIn();
      setSyncStatus(t("steam_sync_failed"));
    } finally {
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  const handleDiscoveryImport = async (
    games: PlatformGame[],
    autoImportFuture: boolean
  ) => {
    await window.electron.importPlatformGames(games);

    if (autoImportFuture) {
      await updateUserPreferences({
        importDiscoveryPreference: "auto",
      });
      setImportPreference("auto");
    }
  };

  /**
   * Unified store row — renders the same layout for all store platforms (including Steam).
   * Determines the right buttons and status based on store type and authentication state.
   */
  const renderUnifiedStoreRow = (platform: PlatformInfo) => {
    const isSteam = platform.shop === "steam";
    const storeId = platform.storeId;

    // Steam uses its own state from useSteamLogin
    if (isSteam) {
      const isLoggingIn = steamLogin.status === "logging-in";
      const isSyncing = steamLogin.status === "syncing";
      const isExpired = steamLogin.status === "expired";
      const isConnected = steamLogin.hasCredentials && !isExpired;

      return (
        <div className="settings-platform-import__store-row">
          <span className="settings-platform-import__store-info">
            <span
              className={cn("settings-platform-import__store-dot", {
                "settings-platform-import__store-dot--connected": isConnected,
                "settings-platform-import__store-dot--expired": isExpired,
                "settings-platform-import__store-dot--disconnected":
                  !steamLogin.hasCredentials,
              })}
            />
            <span className="settings-platform-import__store-status-text">
              {isExpired
                ? t("store_expired")
                : isConnected
                  ? t("store_connected")
                  : t("store_not_connected")}
            </span>
            {steamLogin.username && isConnected && (
              <span className="settings-platform-import__store-username">
                {steamLogin.username}
              </span>
            )}
            {steamLogin.lastSyncAt && (
              <span className="settings-platform-import__store-last-sync">
                {t("store_last_synced", {
                  time: formatTimestamp(
                    new Date(steamLogin.lastSyncAt).getTime()
                  ),
                })}
              </span>
            )}
            {!steamLogin.lastSyncAt && isConnected && (
              <span className="settings-platform-import__store-last-sync">
                {t("store_never_synced")}
              </span>
            )}
          </span>

          <span className="settings-platform-import__store-actions">
            {isExpired ? (
              <button
                className="settings-platform-import__store-btn settings-platform-import__store-btn--login"
                onClick={steamLogin.login}
                disabled={isLoggingIn}
              >
                {isLoggingIn ? t("store_logging_in") : t("store_re_login")}
              </button>
            ) : isConnected ? (
              <>
                <button
                  className="settings-platform-import__store-btn settings-platform-import__store-btn--sync"
                  onClick={handleSteamSync}
                  disabled={isSyncing || syncStatus !== null}
                >                    {syncStatus ??
                      (isSyncing ? t("store_syncing") : t("store_sync"))}
                </button>
                <button
                  className="settings-platform-import__store-btn settings-platform-import__store-btn--logout"
                  onClick={steamLogin.logout}
                >
                  {t("store_logout")}
                </button>
              </>
            ) : (
              <button
                className="settings-platform-import__store-btn settings-platform-import__store-btn--login"
                onClick={steamLogin.login}
                disabled={isLoggingIn}
              >
                {isLoggingIn ? t("store_logging_in") : t("store_login")}
              </button>
            )}
          </span>
        </div>
      );
    }

    // Non-Steam stores — use getStoreStatus
    if (!storeId) return null;

    const status = getStoreStatus(storeId);
    const action = storeActions[storeId] ?? "";
    const isBrowserOAuth = BROWSER_OAUTH_STORES.has(storeId);
    const isAutoDetect = AUTODETECT_STORES.has(storeId);

    // Determine button and status for the store row
    const renderButtons = () => {
      if (status) {
        if (status.isExpired) {
          return (
            <button
              className="settings-platform-import__store-btn settings-platform-import__store-btn--login"
              onClick={() => handleStoreLogin(storeId)}
              disabled={action === "logging-in"}
            >
              {action === "logging-in"
                ? t("store_logging_in")
                : t("store_re_login")}
            </button>
          );
        }

        if (status.isAuthenticated) {
          return (
            <>
              <button
                className="settings-platform-import__store-btn settings-platform-import__store-btn--sync"
                onClick={() => handleStoreSync(storeId)}
                disabled={action === "syncing"}
              >
                {action === "syncing" ? t("store_syncing") : t("store_sync")}
              </button>
              <button
                className="settings-platform-import__store-btn settings-platform-import__store-btn--logout"
                onClick={() => handleStoreLogout(storeId)}
              >
                {t("store_logout")}
              </button>
            </>
          );
        }

        // Has status but not authenticated — show login
        if (isBrowserOAuth) {
          return (
            <button
              className="settings-platform-import__store-btn settings-platform-import__store-btn--login"
              onClick={() => handleStoreLogin(storeId)}
              disabled={action === "logging-in"}
            >
              {action === "logging-in"
                ? t("store_logging_in")
                : t("store_login")}
            </button>
          );
        }

        // Auto-detect store that's not authenticated — show Scan
        return (
          <button
            className="settings-platform-import__store-btn settings-platform-import__store-btn--scan"
            onClick={() => handleAutoDetectSync(storeId)}
            disabled={action === "scanning"}
          >
            {action === "scanning"
              ? t("store_scanning")
              : t("store_scan_for_games")}
          </button>
        );
      }

      // No status at all (first load, never tried)
      if (isBrowserOAuth) {
        return (
          <button
            className="settings-platform-import__store-btn settings-platform-import__store-btn--login"
            onClick={() => handleStoreLogin(storeId)}
            disabled={!!action}
          >
            {action ? t("store_logging_in") : t("store_login")}
          </button>
        );
      }

      if (isAutoDetect) {
        return (
          <button
            className="settings-platform-import__store-btn settings-platform-import__store-btn--scan"
            onClick={() => handleAutoDetectSync(storeId)}
            disabled={!!action}
          >
            {action === "scanning"
              ? t("store_scanning")
              : t("store_scan_for_games")}
          </button>
        );
      }

      return null;
    };

    // Status info display
    const renderStatusInfo = () => {
      if (!status) {
        return (
          <span className="settings-platform-import__store-info">
            <span className="settings-platform-import__store-dot settings-platform-import__store-dot--disconnected" />
            <span className="settings-platform-import__store-status-text">
              {t("store_not_connected")}
            </span>
          </span>
        );
      }

      return (
        <span className="settings-platform-import__store-info">
          <span
            className={cn("settings-platform-import__store-dot", {
              "settings-platform-import__store-dot--connected":
                status.isAuthenticated && !status.isExpired,
              "settings-platform-import__store-dot--expired": status.isExpired,
              "settings-platform-import__store-dot--disconnected":
                !status.isAuthenticated && !status.isExpired,
            })}
          />
          <span className="settings-platform-import__store-status-text">
            {status.isExpired
              ? t("store_expired")
              : status.isAuthenticated
                ? t("store_connected")
                : t("store_not_connected")}
          </span>
          {status.gameCount > 0 && (
            <span className="settings-platform-import__store-count">
              {t("store_games_count", { count: status.gameCount })}
            </span>
          )}
          <span className="settings-platform-import__store-last-sync">
            {status.lastSync
              ? t("store_last_synced", {
                  time: formatTimestamp(status.lastSync),
                })
              : t("store_never_synced")}
          </span>
        </span>
      );
    };

    return (
      <div className="settings-platform-import__store-row">
        {renderStatusInfo()}
        <span className="settings-platform-import__store-actions">
          {renderButtons()}
        </span>
      </div>
    );
  };

  if (!userPreferences) return null;

  return (
    <div className="settings-platform-import">
      <div className="settings-context-panel__group">
        <CheckboxField
          label={t("enable_platform_import")}
          checked={enablePlatformImport}
          onChange={handleToggleEnable}
        />
        <p className="settings-platform-import__description">
          {t("platform_import_description")}
        </p>
      </div>

      {enablePlatformImport && (
        <>
          <div className="settings-context-panel__group">
            <h3 className="settings-platform-import__section-title">
              {t("config_per_platform")}
            </h3>

            {IMPORT_PLATFORMS.map((platform) => {
              const Icon = PLATFORM_ICON_MAP[platform.shop];
              const isSteam = platform.shop === "steam";
              const steamExtrasOpen = isSteam && showSteamExtras;

              return (
                <div
                  key={platform.shop}
                  className="settings-platform-import__platform-row"
                >
                  {/* Card header with icon + platform name */}
                  <div className="settings-platform-import__platform-header">
                    {Icon && (
                      <Icon className="settings-platform-import__platform-icon" />
                    )}
                    <span className="settings-platform-import__platform-name">
                      {t(platform.labelKey)}
                    </span>
                  </div>

                  {/* Unified store row — shown for all stores with storeId, plus Steam */}
                  {(platform.storeId || isSteam) &&
                    renderUnifiedStoreRow(platform)}

                  {/* Scan installed checkbox */}
                  <div className="settings-platform-import__platform-options">
                    <CheckboxField
                      label={t("scan_installed_games")}
                      checked={scanInstalled[platform.shop] ?? true}
                      onChange={() => handleToggleScanInstalled(platform.shop)}
                    />
                  </div>

                  {/* Steam-specific collapsible extras */}
                  {isSteam && (
                    <div className="settings-platform-import__steam-extras">
                      <button
                        type="button"
                        className="settings-platform-import__steam-extras-toggle"
                        onClick={() => setShowSteamExtras(!showSteamExtras)}
                      >
                        <span className="settings-platform-import__steam-extras-arrow">
                          {showSteamExtras ? "▾" : "▸"}
                        </span>
                        {t("steam_additional_settings")}
                      </button>

                      {steamExtrasOpen && (
                        <div className="settings-platform-import__steam-extras-content">
                          {/* API key fallback — shown when logged out */}
                          {!steamLogin.hasCredentials && (
                            <>
                              <TextField
                                label={t(
                                  platform.apiKeyLabel ?? "api_key"
                                )}
                                value={steamApiKey}
                                placeholder={t(
                                  platform.apiKeyPlaceholder ??
                                    "api_key_placeholder"
                                )}
                                onChange={(e) =>
                                  handleSteamApiKeyChange(e.target.value)
                                }
                                theme="dark"
                                type="password"
                              />
                              {platform.setupUrl && (
                                <a
                                  href={platform.setupUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="settings-platform-import__setup-link"
                                >
                                  <LinkIcon size={12} />
                                  {t("get_api_key_at", {
                                    url: platform.setupUrl,
                                  })}
                                </a>
                              )}
                            </>
                          )}

                          {/* Family sharing — shown when logged in */}
                          {steamLogin.hasCredentials && (
                            <>
                              <TextField
                                label={t("steam_family_share_ids")}
                                value={steamFamilyShareIds}
                                placeholder={t(
                                  "steam_family_share_ids_placeholder"
                                )}
                                onChange={(e) =>
                                  handleSteamFamilyShareIdsChange(
                                    e.target.value
                                  )
                                }
                                theme="dark"
                              />
                              <span className="settings-platform-import__hint">
                                {t("steam_family_share_ids_hint")}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="settings-context-panel__group">
            <h3 className="settings-platform-import__section-title">
              {t("import_preference")}
            </h3>

            <SelectField
              value={importPreference}
              onChange={(e) =>
                handleImportPreferenceChange(
                  e.target.value as "wizard" | "auto"
                )
              }
              options={[
                {
                  key: "wizard",
                  value: "wizard",
                  label: t("import_preference_wizard"),
                },
                {
                  key: "auto",
                  value: "auto",
                  label: t("import_preference_auto"),
                },
              ]}
            />
          </div>

          <div className="settings-context-panel__group">
            <h3 className="settings-platform-import__section-title">
              {t("scan_actions")}
            </h3>

            <div className="settings-platform-import__actions">
              <Button
                theme="primary"
                onClick={handleScanNow}
                disabled={scanningStatus !== null}
              >
                {scanningStatus ?? t("scan_for_games")}
              </Button>

              {steamLogin.hasCredentials && (
                <Button
                  theme="outline"
                  onClick={handleSteamSync}
                  disabled={scanningStatus !== null || syncStatus !== null}
                >
                  {syncStatus ?? t("steam_sync")}
                </Button>
              )}

              <Button
                theme="outline"
                onClick={async () => {
                  try {
                    const familyResult =
                      await window.electron.scanSteamFamily();
                    if (familyResult.ownGames.length > 0) {
                      await window.electron.importSteamFamilyGames(
                        familyResult.ownGames
                      );
                    }
                    if (familyResult.familyGames.length > 0) {
                      await window.electron.importSteamFamilyGames(
                        familyResult.familyGames
                      );
                    }
                    setScanningStatus(
                      t("steam_family_scan_complete", {
                        ownCount: familyResult.ownGames.length,
                        familyCount: familyResult.familyGames.length,
                      })
                    );
                  } catch {
                    setScanningStatus(t("steam_family_scan_failed"));
                  }
                  setTimeout(() => setScanningStatus(null), 5000);
                }}
                disabled={
                  scanningStatus !== null ||
                  (!steamApiKey && !steamLogin.hasCredentials)
                }
              >
                {t("scan_steam_family")}
              </Button>
            </div>

            {scanningStatus && (
              <p className="settings-platform-import__status">
                {scanningStatus}
              </p>
            )}
            {syncStatus && !scanningStatus && (
              <p className="settings-platform-import__status">{syncStatus}</p>
            )}
          </div>
        </>
      )}

      <DiscoveryWizardModal
        visible={showDiscoveryModal}
        games={discoveredGames}
        onClose={() => setShowDiscoveryModal(false)}
        onImport={handleDiscoveryImport}
      />
    </div>
  );
}

function parseSteamIds(input: string): string[] {
  return input
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^\d{17}$/.test(s));
}

function formatTimestamp(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
