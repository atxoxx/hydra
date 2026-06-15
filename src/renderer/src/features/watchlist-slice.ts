import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { WatchlistEntry } from "@types";

export interface WatchlistState {
  entries: WatchlistEntry[];
  isLoading: boolean;
  hasLoaded: boolean;
}

const initialState: WatchlistState = {
  entries: [],
  isLoading: false,
  hasLoaded: false,
};

const sortByDateAdded = (entries: WatchlistEntry[]) => {
  entries.sort(
    (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
  );
};

export const watchlistSlice = createSlice({
  name: "watchlist",
  initialState,
  reducers: {
    setWatchlist: (state, action: PayloadAction<WatchlistEntry[]>) => {
      state.entries = [...action.payload];
      sortByDateAdded(state.entries);
      state.hasLoaded = true;
      state.isLoading = false;
    },
    setWatchlistLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    addWatchlistEntry: (state, action: PayloadAction<WatchlistEntry>) => {
      const existingIndex = state.entries.findIndex(
        (e) =>
          e.shop === action.payload.shop &&
          e.objectId === action.payload.objectId
      );

      if (existingIndex !== -1) {
        state.entries[existingIndex] = action.payload;
      } else {
        state.entries.push(action.payload);
      }

      sortByDateAdded(state.entries);
    },
    removeWatchlistEntry: (
      state,
      action: PayloadAction<{ shop: string; objectId: string }>
    ) => {
      state.entries = state.entries.filter(
        (e) =>
          !(e.shop === action.payload.shop &&
            e.objectId === action.payload.objectId)
      );
    },
    clearWatchlist: (state) => {
      state.entries = [];
      state.isLoading = false;
      state.hasLoaded = false;
    },
  },
});

export const {
  setWatchlist,
  setWatchlistLoading,
  addWatchlistEntry,
  removeWatchlistEntry,
  clearWatchlist,
} = watchlistSlice.actions;
