import { useCallback, useRef } from "react";
import type {
  GameShop,
  WatchlistEntry,
  WatchlistPriority,
} from "@types";
import { useAppDispatch, useAppSelector } from "./redux";
import {
  addWatchlistEntry,
  removeWatchlistEntry,
  setWatchlist,
  setWatchlistLoading,
} from "@renderer/features";

export function useWatchlist() {
  const dispatch = useAppDispatch();
  const loadWatchlistRequestRef = useRef<Promise<WatchlistEntry[]> | null>(
    null
  );

  const entries = useAppSelector((state) => state.watchlist.entries);
  const isLoading = useAppSelector((state) => state.watchlist.isLoading);
  const hasLoaded = useAppSelector((state) => state.watchlist.hasLoaded);

  const loadWatchlist = useCallback(async () => {
    if (loadWatchlistRequestRef.current) {
      return loadWatchlistRequestRef.current;
    }

    const request = (async () => {
      dispatch(setWatchlistLoading(true));

      try {
        const response = await window.electron.getWatchlist();
        dispatch(setWatchlist(response));
        return response;
      } catch (error) {
        void error;
        return [];
      } finally {
        dispatch(setWatchlistLoading(false));
        loadWatchlistRequestRef.current = null;
      }
    })();

    loadWatchlistRequestRef.current = request;

    return request;
  }, [dispatch]);

  const addToWatchlist = useCallback(
    async (data: {
      shop: GameShop;
      objectId: string;
      title: string;
      priority: WatchlistPriority;
      notes: string;
      initialDownloadSources?: string[];
      libraryImageUrl?: string | null;
    }) => {
      await window.electron.addToWatchlist(data);

      // Preserve original fields if the entry already exists
      const existingEntry = entries.find(
        (e) => e.shop === data.shop && e.objectId === data.objectId
      );

      const localEntry: WatchlistEntry = {
        shop: data.shop,
        objectId: data.objectId,
        title: data.title,
        addedAt: existingEntry?.addedAt ?? new Date().toISOString(),
        priority: data.priority,
        notes: data.notes,
        initialDownloadSources:
          existingEntry?.initialDownloadSources ??
          data.initialDownloadSources ??
          [],
        libraryImageUrl:
          existingEntry?.libraryImageUrl ??
          data.libraryImageUrl ??
          null,
      };

      dispatch(addWatchlistEntry(localEntry));
    },
    [dispatch, entries]
  );

  const removeFromWatchlist = useCallback(
    async (shop: GameShop, objectId: string) => {
      await window.electron.removeFromWatchlist(shop, objectId);
      dispatch(removeWatchlistEntry({ shop, objectId }));
    },
    [dispatch]
  );

  const isGameWatchlisted = useCallback(
    (shop: string, objectId: string): boolean => {
      return entries.some(
        (e) => e.shop === shop && e.objectId === objectId
      );
    },
    [entries]
  );

  const getWatchlistEntry = useCallback(
    (shop: string, objectId: string): WatchlistEntry | undefined => {
      return entries.find(
        (e) => e.shop === shop && e.objectId === objectId
      );
    },
    [entries]
  );

  return {
    entries,
    isLoading,
    hasLoaded,
    loadWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    isGameWatchlisted,
    getWatchlistEntry,
  };
}
