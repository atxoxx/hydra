import { useContext } from "react";
import { gameDetailsContext } from "@renderer/context";
import "./metadata-chips-row.scss";

const GENRE_COLORS = [
  "#16b195",
  "#e74c3c",
  "#3498db",
  "#f39c12",
  "#9b59b6",
  "#1abc9c",
  "#e67e22",
  "#2ecc71",
];

function getGenreColor(index: number): string {
  return GENRE_COLORS[index % GENRE_COLORS.length];
}

export function MetadataChipsRow() {
  const { shopDetails, effectiveShop } = useContext(gameDetailsContext);

  if (!shopDetails) return null;

  // Filter out blank entries so the chips row never renders a coloured ghost
  // chip (e.g. an empty array member used to surface as ", , ," or a coloured
  // border with no text).
  const stripEmpty = (arr: unknown[]): string[] =>
    arr
      .map((v) =>
        typeof v === "string"
          ? v
          : ((v as { name?: string } | null)?.name ?? "")
      )
      .filter((s) => typeof s === "string" && s.trim().length > 0);

  const genres = stripEmpty(shopDetails.genres ?? []);
  const developers = stripEmpty(shopDetails.developers ?? []);
  const publishers = stripEmpty(shopDetails.publishers ?? []);
  const releaseDate = shopDetails.release_date?.date ?? null;
  const releaseYear = releaseDate ? new Date(releaseDate).getFullYear() : null;

  if (
    genres.length === 0 &&
    developers.length === 0 &&
    publishers.length === 0 &&
    !releaseYear
  ) {
    return null;
  }

  return (
    <div className="metadata-chips-row">
      {genres.slice(0, 6).map((genre, i) => (
        <span
          key={genre}
          className="metadata-chip metadata-chip--genre"
          style={{
            borderColor: getGenreColor(i),
            color: getGenreColor(i),
          }}
        >
          {genre}
        </span>
      ))}

      {genres.length > 6 && (
        <span className="metadata-chip metadata-chip--more">
          +{genres.length - 6}
        </span>
      )}

      {developers.length > 0 && (
        <span className="metadata-chip metadata-chip--dev">
          {developers[0]}
          {developers.length > 1 && ` +${developers.length - 1}`}
        </span>
      )}

      {publishers.length > 0 && (
        <span className="metadata-chip metadata-chip--publisher">
          {publishers[0]}
        </span>
      )}

      {releaseYear && (
        <span className="metadata-chip metadata-chip--year">{releaseYear}</span>
      )}

      {effectiveShop && (
        <span className="metadata-chip metadata-chip--shop">
          {effectiveShop}
        </span>
      )}
    </div>
  );
}
