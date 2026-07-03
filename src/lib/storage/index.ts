import { getEnv, type Env } from "../env";
import { DiskStorage } from "./disk";
import { R2Storage, type S3Config } from "./r2";
import type { Storage } from "./types";

export type { Storage, StoredImage } from "./types";

let cached: Storage | null = null;

/**
 * Resolves S3-compatible credentials from either the R2_-prefixed names or the
 * plain names an S3 provider typically injects (ENDPOINT / BUCKET / REGION /
 * ACCESS_KEY_ID / SECRET_ACCESS_KEY). Returns null if the set is incomplete.
 */
function resolveS3Config(env: Env): S3Config | null {
  const endpoint = env.R2_ENDPOINT ?? env.ENDPOINT;
  const bucket = env.R2_BUCKET ?? env.BUCKET;
  const accessKeyId = env.R2_ACCESS_KEY_ID ?? env.ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY ?? env.SECRET_ACCESS_KEY;
  const region = env.R2_REGION ?? env.REGION ?? "auto";

  if (endpoint && bucket && accessKeyId && secretAccessKey) {
    return { endpoint, bucket, region, accessKeyId, secretAccessKey };
  }
  return null;
}

/**
 * Selects the storage backend. Honors STORAGE_DRIVER when set; otherwise uses
 * object storage automatically if a complete credential set is present, and
 * falls back to local disk.
 */
export function getStorage(): Storage {
  if (cached) return cached;
  const env = getEnv();
  const s3 = resolveS3Config(env);
  const driver = env.STORAGE_DRIVER ?? (s3 ? "r2" : "disk");

  if (driver === "r2" || driver === "s3") {
    if (!s3) {
      throw new Error(
        "Object storage selected but credentials are incomplete — need endpoint, bucket, access key id, and secret " +
          "(R2_ENDPOINT/R2_BUCKET/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY or ENDPOINT/BUCKET/ACCESS_KEY_ID/SECRET_ACCESS_KEY).",
      );
    }
    cached = new R2Storage(s3);
  } else {
    cached = new DiskStorage();
  }
  return cached;
}
