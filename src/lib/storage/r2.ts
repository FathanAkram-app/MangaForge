import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Storage, StoredImage } from "./types";

export type S3Config = {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
};

/**
 * S3-compatible object storage (Cloudflare R2, etc.) for production — durable,
 * cheap, and decoupled from the app instance. Credentials are resolved in
 * storage/index.ts (from R2_* or plain injected names) and passed in.
 */
export class R2Storage implements Storage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: S3Config) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // Path-style addressing works across S3-compatible providers (R2, MinIO…).
      forcePathStyle: true,
    });
  }

  async put(key: string, bytes: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: bytes, ContentType: contentType }),
    );
  }

  async get(key: string): Promise<StoredImage | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!res.Body) return null;
      const bytes = Buffer.from(await res.Body.transformToByteArray());
      return { bytes, contentType: res.ContentType ?? "application/octet-stream" };
    } catch {
      return null;
    }
  }
}
