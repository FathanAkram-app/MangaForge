import { z } from "zod";

/**
 * Validated environment configuration.
 *
 * Parsed lazily (never at module load) so `next build` doesn't require secrets,
 * and so a misconfigured deploy fails fast with a readable message on the first
 * request instead of a cryptic runtime error deep in a query.
 */
const EnvSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // AI image provider
  IMAGE_PROVIDER: z.enum(["pollinations", "cloudflare"]).default("pollinations"),
  POLLINATIONS_BASE_URL: z.string().min(1).default("https://image.pollinations.ai"),
  POLLINATIONS_TOKEN: z.string().optional(),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_API_TOKEN: z.string().optional(),

  // Image storage. Leave STORAGE_DRIVER unset to auto-detect: S3-compatible
  // object storage is used when a full credential set is present, else disk.
  STORAGE_DRIVER: z.enum(["disk", "r2", "s3"]).optional(),
  STORAGE_DISK_DIR: z.string().default("./.data/images"),

  // S3-compatible object storage (Cloudflare R2, etc.). Credentials are read
  // from either the R2_-prefixed names OR the plain names many providers inject.
  R2_ENDPOINT: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_REGION: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  ENDPOINT: z.string().optional(),
  BUCKET: z.string().optional(),
  REGION: z.string().optional(),
  ACCESS_KEY_ID: z.string().optional(),
  SECRET_ACCESS_KEY: z.string().optional(),

  // App
  SESSION_SECRET: z.string().min(1, "SESSION_SECRET is required"),
  GENERATION_TIMEOUT_MS: z.coerce.number().int().positive().default(35000),
  MAX_CONCURRENT_GENERATIONS: z.coerce.number().int().positive().default(4),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
