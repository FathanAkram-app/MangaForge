# MangaForge

An AI image-generation web app for **manga**. Describe a scene, pick a style (genre, format, colour, screentone), and generate manga panels, covers, and character art. Every result is saved to a personal gallery that survives refreshes, and any result can be remixed (tweak the prompt and regenerate) or saved as a reusable character.

- **Live URL:** _add after deploy_
- **Demo video:** _add Loom link_

---

## What it does

- **Niche-shaped composer** — not a bare prompt box. You pick genre (shōnen / shōjo / seinen), format (single panel / cover / character sheet), colour (B&W / colour) and screentone; the backend assembles a proper manga prompt from those.
- **Personal gallery** — generations and their prompts are stored server-side (Postgres + object storage) and scoped to your browser via a signed session cookie. They persist across refreshes; no login required.
- **Re-generation** — “Remix” loads any saved result back into the composer so you can tweak the prompt and generate a new panel without losing the original.
- **Consistent character (best-effort)** — save a result as a named character; reusing it seeds new generations with the same seed for a more consistent look. This is genuinely best-effort on free models (see [Known limitations](#known-limitations)).
- **Meaningful loading + real failure handling** — a 10–30s wait is shown live, and the three required failure states (timeout, invalid prompt, broken response) each render a distinct, actionable card.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 (App Router, TypeScript)** run as a long-running Node server | One codebase, shared types front-to-back, a real place to run background work |
| AI image API | **Pollinations.ai** (default), **Cloudflare Workers AI** fallback | Pollinations is keyless; provider is swappable via `IMAGE_PROVIDER` |
| Database | **PostgreSQL** (local for dev, Neon for prod) | The generation row is the single source of truth |
| Image storage | **Local disk** (dev) / **Cloudflare R2** (prod) | One `Storage` interface; `STORAGE_DRIVER` picks the driver |
| Validation | **zod** | Request + provider-response validation |

See `../plan.md` for the full design write-up (request journey, decisions, and what was deliberately left out).

## How a request flows

1. Browser POSTs the prompt + options to `/api/generations`.
2. The backend validates it, inserts a `queued` row, schedules the AI job with Next's `after()`, and immediately returns **202 `{ id }`**.
3. A semaphore-bounded worker calls the AI API (with a timeout), validates the response is a real image, stores the bytes, and flips the row to `succeeded` / `failed`.
4. The browser polls `GET /api/generations/:id` (~1.5s) until the status is terminal, then renders the image from `GET /api/images/:id`.

Because the **DB row is the source of truth**, a refresh mid-generation just resumes polling, concurrent users stay isolated, and failures are first-class.

---

## Quick start (local, < 15 minutes)

### Fastest path — Docker (one command)

With Docker installed, from `manga-forge/`:

```bash
docker compose up --build
```

This starts Postgres **and** the app together, **auto-applies the database schema** (via the prestart migration), and uses the keyless Pollinations provider. Open **http://localhost:3000** — no local Node or Postgres install needed. Generated images persist in a Docker volume.

Prefer to run it directly with Node? Continue below.

### Prerequisites
- **Node.js ≥ 20.9** and npm
- **PostgreSQL** running locally (any recent version) — or a free [Neon](https://neon.com) connection string
- That's it. The default config uses the **keyless** Pollinations API and **local-disk** storage, so no cloud accounts are needed to run it.

### Steps

```bash
# 1. Install
cd manga-forge
npm install

# 2. Create the database and apply the schema
#    (adjust the connection string to your Postgres; this uses a local default)
psql "postgres://postgres:postgres@localhost:5432/postgres" -c "CREATE DATABASE manga_forge"
psql "postgres://postgres:postgres@localhost:5432/manga_forge" -f db/schema.sql

# 3. Configure environment
cp .env.example .env.local
#    Edit .env.local: set DATABASE_URL to your database and SESSION_SECRET to any long random string.

# 4. Run
npm run dev
```

Open **http://localhost:3000** for the landing page, then click **Open studio** (or go to `/create`), type a scene, and hit **Forge panel**.

---

## Environment variables

All are documented in [`.env.example`](.env.example). The essentials:

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | Postgres connection string |
| `SESSION_SECRET` | ✅ | — | Long random string; signs the session cookie |
| `IMAGE_PROVIDER` | | `pollinations` | `pollinations` \| `cloudflare` |
| `POLLINATIONS_BASE_URL` | | `https://image.pollinations.ai` | Point elsewhere to demo the broken-response state |
| `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` | | — | Needed only if `IMAGE_PROVIDER=cloudflare` |
| `STORAGE_DRIVER` | | `disk` | `disk` \| `r2` |
| `STORAGE_DISK_DIR` | | `./.data/images` | Where disk storage writes |
| `R2_ENDPOINT` / `R2_BUCKET` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | | — | Needed only if `STORAGE_DRIVER=r2` |
| `GENERATION_TIMEOUT_MS` | | `35000` | AI call is aborted after this → timeout failure |
| `MAX_CONCURRENT_GENERATIONS` | | `4` | Semaphore bounding simultaneous AI calls |

---

## Demonstrating the three failure states

Each renders a distinct card with a specific action.

1. **Invalid prompt** — enter a scene shorter than 3 characters (e.g. `no`) or one containing a blocked word. Rejected before any API call (HTTP 422). _Verified automatically._
2. **Timeout** — set `GENERATION_TIMEOUT_MS=1` in `.env.local`, restart, and generate. The AI call is aborted immediately → `timeout` card with **Retry**.
3. **Broken response** — set `POLLINATIONS_BASE_URL=https://example.com` in `.env.local`, restart, and generate. The service replies with non-image content → `bad_response` card with **Retry**.

(Restore the values afterwards.)

---

## Deploying (Railway + Neon + R2)

The app is built for a self-hosted Node server (`output: "standalone"`).

1. **Database:** create a free Neon project; copy its connection string into `DATABASE_URL`.
2. **Storage:** create an S3-compatible bucket (Cloudflare R2 recommended). Provide its credentials as either the `R2_ENDPOINT`/`R2_BUCKET`/`R2_REGION`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` names **or** the plain `ENDPOINT`/`BUCKET`/`REGION`/`ACCESS_KEY_ID`/`SECRET_ACCESS_KEY` names most providers inject — object storage turns on automatically once a full set is present (no `STORAGE_DRIVER` needed).
3. **Host:** create a Railway service from this repo, set all env vars, and deploy. Set Railway's start command to `npm run start` (after `npm run build`), and give the service a stop grace period of ≥ 30s so in-flight generations drain on redeploy.

---

## Project structure

```
manga-forge/
  db/schema.sql                 # the single `generations` table
  src/lib/
    env.ts                      # zod-validated, lazily-parsed config
    db.ts                       # pooled Postgres access
    session.ts                  # signed httpOnly session cookie
    manga.ts                    # niche: presets + prompt builder + prompt validation
    storage/                    # Storage interface + disk and R2 drivers
    providers/                  # ImageProvider interface + pollinations & cloudflare + typed errors
    generations/               # types, repo (SQL), and the background worker
    client.ts                   # typed browser API helpers
  src/app/
    api/generations/route.ts       # POST (create) + GET (gallery)
    api/generations/[id]/route.ts  # GET (poll) + PATCH (save character)
    api/images/[id]/route.ts       # serve stored bytes
    page.tsx                       # landing page
    create/page.tsx                # the studio (composer + polling gallery + failure cards)
    _components/HeroPrompt.tsx     # landing hero → studio funnel
```

## Known limitations

- **Character consistency is best-effort.** Free models (Pollinations/FLUX) have no character-lock; we reuse the seed, which nudges but doesn't guarantee the same character across scenes.
- **Free-tier moderation is coarse.** The "invalid prompt" filter is a small server-side blocklist plus length checks, not a full moderation service.
- **Single-instance concurrency.** The semaphore bounds concurrency per Node process; horizontal scaling would need a shared queue (deliberately out of scope — see `../plan.md` §12).

## AI assistance

Built with the help of an AI coding assistant, as permitted by the brief. Every part is understood and can be walked through.
