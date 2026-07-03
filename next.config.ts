import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deploy as a self-hosted long-running Node server (Railway). `standalone`
  // emits `.next/standalone/server.js` so background work via after() keeps
  // running post-response — see plan.md §2.4 / §4.
  output: "standalone",
  // `pg` is already auto-externalized by Next; listed here to make the intent
  // explicit (these run via native require, not the bundler).
  serverExternalPackages: ["pg"],
};

export default nextConfig;
