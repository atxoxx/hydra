import axios from "axios";
import { networkLogger as logger } from "./logger";
import type { AssetSearchResult } from "./duckduckgo-image-search";

export interface SteamGridDBImage {
  id: number;
  score: number;
  style: string;
  width: number;
  height: number;
  nsfw: boolean;
  humor: boolean;
  epilepsy: boolean;
  notes: string | null;
  mime: string;
  language: string;
  url: string;
  thumb: string;
  lock: boolean;
}

export interface SteamGridDBSearchResponse {
  success: boolean;
  data: SteamGridDBImage[];
  errors?: string[];
}

const BASE_URL = "https://www.steamgriddb.com/api/v2";

export class SteamGridDBApi {
  private static apiKey: string | null = null;

  static setApiKey(key: string) {
    this.apiKey = key;
  }

  static getApiKey(): string | null {
    return this.apiKey;
  }

  static isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private static getHeaders() {
    if (!this.apiKey) {
      throw new Error("SteamGridDB API key not configured");
    }
    return {
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  static async searchGame(
    gameName: string
  ): Promise<{ id: number; name: string } | null> {
    try {
      const response = await axios.get(
        `${BASE_URL}/search/autocomplete/${encodeURIComponent(gameName)}`,
        {
          headers: this.getHeaders(),
        }
      );

      if (response.data?.success && response.data?.data?.length > 0) {
        return response.data.data[0];
      }
      return null;
    } catch (error) {
      logger.error("SteamGridDB search game failed:", error);
      return null;
    }
  }

  static async getGrids(
    gameIdOrName: number | string
  ): Promise<SteamGridDBSearchResponse | null> {
    return this.fetchImageType("grids", gameIdOrName);
  }

  static async getHeroes(
    gameIdOrName: number | string
  ): Promise<SteamGridDBSearchResponse | null> {
    return this.fetchImageType("heroes", gameIdOrName);
  }

  static async getLogos(
    gameIdOrName: number | string
  ): Promise<SteamGridDBSearchResponse | null> {
    return this.fetchImageType("logos", gameIdOrName);
  }

  static async getIcons(
    gameIdOrName: number | string
  ): Promise<SteamGridDBSearchResponse | null> {
    return this.fetchImageType("icons", gameIdOrName);
  }

  private static async fetchImageType(
    type: "grids" | "heroes" | "logos" | "icons",
    gameIdOrName: number | string
  ): Promise<SteamGridDBSearchResponse | null> {
    try {
      let gameId: number;

      if (typeof gameIdOrName === "number") {
        gameId = gameIdOrName;
      } else {
        const game = await this.searchGame(gameIdOrName);
        if (!game) return null;
        gameId = game.id;
      }

      const response = await axios.get(`${BASE_URL}/${type}/game/${gameId}`, {
        headers: this.getHeaders(),
      });

      return response.data as SteamGridDBSearchResponse;
    } catch (error) {
      logger.error(`SteamGridDB fetch ${type} failed:`, error);
      return null;
    }
  }

  static async getAllImages(gameName: string): Promise<{
    grids: SteamGridDBImage[];
    heroes: SteamGridDBImage[];
    logos: SteamGridDBImage[];
    icons: SteamGridDBImage[];
  }> {
    const game = await this.searchGame(gameName);
    if (!game) {
      return { grids: [], heroes: [], logos: [], icons: [] };
    }

    const gameId = game.id;

    const [gridsRes, heroesRes, logosRes, iconsRes] = await Promise.all([
      this.getGrids(gameId),
      this.getHeroes(gameId),
      this.getLogos(gameId),
      this.getIcons(gameId),
    ]);

    return {
      grids: gridsRes?.data ?? [],
      heroes: heroesRes?.data ?? [],
      logos: logosRes?.data ?? [],
      icons: iconsRes?.data ?? [],
    };
  }

  /**
   * Search for game images by type, returning standardized AssetSearchResult[].
   * @param gameName The game title to search for
   * @param assetType Which image type to fetch (icon, logo, hero, grid)
   */
  static async searchImages(
    gameName: string,
    assetType: "icon" | "logo" | "hero" | "grid" | "banner"
  ): Promise<AssetSearchResult[]> {
    if (!this.isConfigured()) {
      logger.warn("SteamGridDB searchImages called but API key not configured");
      return [];
    }

    try {
      const game = await this.searchGame(gameName);
      if (!game) return [];

      let response: SteamGridDBSearchResponse | null = null;

      switch (assetType) {
        case "icon":
          response = await this.getIcons(game.id);
          break;
        case "logo":
          response = await this.getLogos(game.id);
          break;
        case "hero":
          response = await this.getHeroes(game.id);
          break;
        case "grid":
        case "banner":
          response = await this.getGrids(game.id);
          break;
      }

      if (!response?.data) return [];

      return response.data.map((img) => ({
        id: `sgdb-${img.id}`,
        thumbnailUrl: img.thumb,
        fullImageUrl: img.url,
        sourceUrl: img.url,
        sourceName: "SteamGridDB",
        width: img.width,
        height: img.height,
      }));
    } catch (error) {
      logger.error("SteamGridDB searchImages failed:", error);
      return [];
    }
  }
}
