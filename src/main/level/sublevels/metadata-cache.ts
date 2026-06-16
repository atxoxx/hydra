import { db } from "@main/level";
import { levelKeys } from "./keys";

export interface MetadataCacheEntry {
  shop: string;
  objectId: string;
  metadata: any;
  updatedAt: string;
  sources: string[];
}

const METADATA_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function getMetadataCache(
  shop: string,
  objectId: string
): Promise<MetadataCacheEntry | null> {
  const key = `:${shop}:${objectId}`;
  try {
    const entry = await db.get<string, MetadataCacheEntry>(
      `${levelKeys.metadataCache}${key}`,
      { valueEncoding: "json" }
    );
    if (!entry) return null;

    const age = Date.now() - new Date(entry.updatedAt).getTime();
    if (age > METADATA_CACHE_TTL_MS) {
      return null;
    }

    return entry;
  } catch {
    return null;
  }
}

export async function setMetadataCache(
  shop: string,
  objectId: string,
  metadata: any,
  sources: string[]
): Promise<void> {
  const key = `:${shop}:${objectId}`;
  const entry: MetadataCacheEntry = {
    shop,
    objectId,
    metadata,
    updatedAt: new Date().toISOString(),
    sources,
  };

  await db.put<string, MetadataCacheEntry>(
    `${levelKeys.metadataCache}${key}`,
    entry,
    { valueEncoding: "json" }
  );
}
