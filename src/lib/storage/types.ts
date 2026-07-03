export type StoredImage = { bytes: Buffer; contentType: string };

/**
 * Where generated image bytes live. The gallery record only stores an opaque
 * `image_key`; this interface resolves that key to bytes, so the rest of the
 * app never knows whether images sit on local disk or in Cloudflare R2.
 */
export interface Storage {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredImage | null>;
}
