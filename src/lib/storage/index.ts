import { getEnv } from "../env";
import { DiskStorage } from "./disk";
import { R2Storage } from "./r2";
import type { Storage } from "./types";

export type { Storage, StoredImage } from "./types";

let cached: Storage | null = null;

/** Picks the storage driver from STORAGE_DRIVER (disk for local, r2 for prod). */
export function getStorage(): Storage {
  if (!cached) {
    cached = getEnv().STORAGE_DRIVER === "r2" ? new R2Storage() : new DiskStorage();
  }
  return cached;
}
