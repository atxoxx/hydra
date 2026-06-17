import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "./use-toast";

type SteamLoginStatus =
  | "logged-out"
  | "logging-in"
  | "logged-in"
  | "expired"
  | "syncing";

export interface SteamLoginState {
  status: SteamLoginStatus;
  steamId64: string | null;
  username: string | null;
  lastSyncAt: string | null;
}

export function useSteamLogin() {
  const [state, setState] = useState<SteamLoginState>({
    status: "logged-out",
    steamId64: null,
    username: null,
    lastSyncAt: null,
  });

  const { t } = useTranslation("settings");
  const { showSuccessToast, showErrorToast } = useToast();

  // Load initial login status on mount
  useEffect(() => {
    window.electron
      .steamGetLoginStatus()
      .then((status) => {
        const mappedStatus: SteamLoginStatus =
          status.status === "expired" ? "expired" : status.status;

        setState({
          status: mappedStatus,
          steamId64: status.steamId64,
          username: status.username,
          lastSyncAt: status.lastSyncAt,
        });
      })
      .catch(() => {
        // If status check fails, assume logged out
      });
  }, []);

  const login = useCallback(async () => {
    setState((prev) => ({ ...prev, status: "logging-in" }));

    try {
      const result = await window.electron.steamLogin();
      const displayName =
        result.username || `Steam User ${result.steamId64.slice(-4)}`;

      setState({
        status: "logged-in",
        steamId64: result.steamId64,
        username: displayName,
        lastSyncAt: null,
      });

      showSuccessToast(t("steam_logged_in_as", { username: displayName }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      setState((prev) => ({
        ...prev,
        status: "logged-out",
      }));

      // "Login window was closed by the user" is not really an error
      if (message.includes("closed by the user")) {
        return;
      }

      showErrorToast(
        t("steam_login_failed"),
        t("steam_login_failed_message")
      );
    }
  }, [showSuccessToast, showErrorToast]);

  const logout = useCallback(async () => {
    await window.electron.steamLogout();

    setState({
      status: "logged-out",
      steamId64: null,
      username: null,
      lastSyncAt: null,
    });

    showSuccessToast(t("steam_logged_out"));
  }, [showSuccessToast]);

  /** Whether the user has a stored credential (including expired) */
  const hasCredentials =
    state.status === "logged-in" ||
    state.status === "syncing" ||
    state.status === "expired";

  return {
    ...state,
    hasCredentials,
    login,
    logout,
    setSyncing: () =>
      setState((prev) => ({ ...prev, status: "syncing" as const })),
    setLoggedIn: () =>
      setState((prev) => ({ ...prev, status: "logged-in" as const })),
    setLastSyncAt: (timestamp: string) =>
      setState((prev) => ({ ...prev, lastSyncAt: timestamp })),
  };
}
