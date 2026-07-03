# Multi-stage build for MangaForge (Next.js 16, runs `next start`).

FROM node:22-slim AS base
WORKDIR /app

# --- Dependencies (includes dev deps needed to build) ---
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- Build ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- Runtime ---
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/db ./db
COPY --from=build /app/scripts ./scripts
EXPOSE 3000
# `npm run start` runs the idempotent prestart migration, then `next start`.
CMD ["npm", "run", "start"]
