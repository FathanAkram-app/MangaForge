import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getEnv } from "../env";
import type { Storage, StoredImage } from "./types";

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/**
 * Local-disk storage. Zero setup — the default for local dev so the app runs
 * with no cloud accounts. Keys are server-generated (`generations/<uuid>.png`),
 * never user input, so path traversal isn't a concern.
 */
export class DiskStorage implements Storage {
  private readonly root = path.resolve(getEnv().STORAGE_DISK_DIR);

  async put(key: string, bytes: Buffer): Promise<void> {
    const file = path.join(this.root, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
  }

  async get(key: string): Promise<StoredImage | null> {
    try {
      const bytes = await readFile(path.join(this.root, key));
      const contentType = CONTENT_TYPE_BY_EXT[path.extname(key).toLowerCase()] ?? "application/octet-stream";
      return { bytes, contentType };
    } catch {
      return null;
    }
  }
}
