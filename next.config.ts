import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deployed as a normal long-running Node server: Railway/Railpack builds the
  // full app and runs `next start` (which serves public/ + static and lets our
  // prestart migration run). We deliberately do NOT set `output: "standalone"` —
  // Next 16 rejects `next start` with standalone, and standalone omits public/.
  // `pg` is already auto-externalized by Next; listed explicitly for intent.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
