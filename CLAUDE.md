# CLAUDE.md — Developer Notes for AI Agents

## Local Development

- Local dev server: `npm run dev` → `http://localhost:8787`
- Local D1 is initialized and contains a clone of production data — `npm run dev` serves real events
- Local dev never connects to the remote (production) D1
- If `.wrangler/state/v3/d1/` is wiped, events will be empty — see README for setup/migration steps
- After editing `client/src/**`, run `npm run build:client` (or keep `npm run dev:client` running in watch mode) — `wrangler dev` serves `public/dist/` as-is, so otherwise you are testing a stale bundle

## Schema Changes

The schema is managed by wrangler migrations in `migrations/`. To change the schema:

1. `npx wrangler d1 migrations create calendar_db <descriptive_name>` — creates the next numbered file.
2. Write idempotent SQL inside the new migration file.
3. `npx wrangler d1 migrations apply calendar_db --local` — applies locally.
4. `npm test` — confirm nothing broke.
5. Push to main — CI applies to production automatically.

See [`migrations/README.md`](../migrations/README.md) for conventions and recovery steps.

The canonical schema source is `migrations/0001_initial.sql` plus any later migrations. The legacy root-level `schema.sql` was removed in `33c43e7` — do not reintroduce it.

## Adding Secrets

Secrets (anything set via `wrangler secret put`) must be registered in `wrangler.jsonc → secrets.required`. This is the single source of truth — `wrangler types` reads it, `wrangler dev` warns when it's missing, and `wrangler deploy` fails if it isn't configured on the Worker.

To add a new secret `MY_NEW_SECRET`:

1. Add it to `.dev.vars` for local dev (gitignored): `MY_NEW_SECRET=dev_value`.
2. Add the name to `wrangler.jsonc → secrets.required`:
   ```jsonc
   "secrets": { "required": ["ADMIN_PASSWORD", "MY_NEW_SECRET"] }
   ```
3. `npm run cf-typegen` — regenerates `worker-configuration.d.ts` so `env.MY_NEW_SECRET` typechecks.
4. Use it in code as `env.MY_NEW_SECRET` (typed `string`).
5. Set it in production before next deploy: `npx wrangler secret put MY_NEW_SECRET`.

Do NOT hand-write an ambient `Env` augmentation in `src/**/*.d.ts` — wrangler does this automatically from `secrets.required`. If you see a CI typecheck failure like `Property 'X' does not exist on type 'Env'`, the missing entry is almost always in `wrangler.jsonc → secrets.required`.

## Testing

Tests use an in-memory D1 — no local or remote database needed:

```bash
npm test                                   # Runs all unit tests
npm test -- --run test/templates.spec.ts   # Runs HTML byte-snapshot regression tests
```

### Visual Regression

UI changes to `src/templates/*` or any code affecting `/admin` or `/admin/login` must keep the visual regression gates green:

```bash
npm run test:e2e                           # Playwright pixel-diff (Chromium 1280x800)
```

If you intentionally change the UI, update the baselines:

```bash
npm test -- --run test/templates.spec.ts -u   # Update HTML byte snapshots
npm run test:e2e -- --update-snapshots         # Update Playwright screenshots
```

Verify the new screenshots look correct before committing them.

## Architecture

### Tech Stack

- **Runtime**: Cloudflare Workers (edge serverless, TypeScript)
- **Database**: Cloudflare D1 (SQLite-compatible, bound as `DB`)
- **Static assets**: `public/` served via Cloudflare Workers Assets binding (`ASSETS`)
- **Tooling**: wrangler CLI, vitest + `@cloudflare/vitest-pool-workers`, `tsc` for the client bundle
- **Compat flags**: `nodejs_compat`, `global_fetch_strictly_public`

### Project Structure

- `src/index.ts` — Thin entry point (~25 lines): fetch handler dispatches to route modules
- `src/constants.ts` — `Env` interface, numeric/string constants, and `SECURITY_HEADERS`
- `src/types.ts` — All shared DB row interfaces
- `src/lib/auth.ts` — Session, cookie, CSRF, and password-compare helpers
- `src/lib/ics.ts` — RFC 5545 helpers (fold, date formatters, value escaping)
- `src/routes/health.ts` — `/health` route handler
- `src/routes/events.ts` — `/api/events` route handler
- `src/routes/admin.ts` — `/admin`, `/admin/login`, `/admin/logout` route handlers
- `src/routes/ics.ts` — `/subscribe`, `/calendar.ics` route handlers
- `src/templates/admin.html.ts` — `ADMIN_HTML(csrfToken)` template literal
- `src/templates/login.html.ts` — `LOGIN_HTML(error)` template literal
- `shared/contract.d.ts` — Shared API contract types between Worker and client
- `client/src/*.ts` — Landing-page client source (strict TS, ES modules): `index.ts` entry plus `api`, `state`, `dates`,
  `categories`, `search`, `miniCal`, `weekGrid`, `eventDetail`, `ui`, `api-types` (re-exports `ApiEvent` from
  `shared/contract.d.ts`), and `admin` (the `/admin` dashboard script)
- `tsconfig.client.json` — Client build config (`rootDir: client/src` → `outDir: public/dist`)
- `public/index.html` — Landing page shell; loads the compiled bundle via `<script type="module" src="/dist/index.js">`, which fetches `/api/events`
- `public/dist/` — Compiled client bundle. **Gitignored build output** — produced by `npm run build:client`, never committed
- `wrangler.jsonc` — Deployment config (custom domain `calendar.ntuas.com`, D1 binding, assets binding)
- `test/*.spec.ts` — Test suite using in-memory D1
- `test/templates.spec.ts` — HTML byte-snapshot regression tests for admin & login pages
- `e2e/screenshot.spec.ts` — Playwright pixel-diff visual regression for admin & login pages
- `playwright.config.ts` — Playwright configuration
- `scripts/read-dev-vars.mjs` — Parses `.dev.vars` for E2E tests
- `scripts/generate-venues.mjs` — Venue list generator for NTU facilities
- `migrations/`, `seed.sql`, `remote_backup.sql` — Database migrations, seed data, production backup

### Client Bundle

The landing page is **not** inline JS — `public/index.html` is a shell that loads an ES module graph from `public/dist/`.
The server-rendered `/admin` dashboard depends on the same build: `src/templates/admin.html.ts` loads `/dist/admin.js`.
So a missing bundle takes down both the public calendar and the admin UI.

```bash
npm run build:client   # tsc -p tsconfig.client.json — client/src/*.ts → public/dist/*.js
npm run dev:client     # same, in --watch mode
```

`public/dist/` is gitignored and exists only after a build. If it is missing, the page renders its shell and hangs
on "Loading..." forever, with a 404 on `/dist/index.js` — the Worker and `/api/events` stay healthy, so nothing else
signals the failure. See [Deployment](#deployment) for the deploy-time version of this trap.

### Routing

All routing is dispatched in `src/index.ts` fetch handler to separate route handlers in `src/routes/`:

| Route                         | Method   | Description                                           |
| ----------------------------- | -------- | ----------------------------------------------------- |
| `/api/events`                 | GET      | JSON array of all events                              |
| `/admin`                      | GET      | Admin dashboard (server-rendered HTML)                |
| `/admin`                      | POST     | Event CRUD (action=add/update/delete), CSRF-protected |
| `/admin/login`                | POST     | Password authentication                               |
| `/admin/logout`               | POST     | Session termination                                   |
| `/subscribe`, `/calendar.ics` | GET/POST | RFC 5545 ICS feed                                     |
| `/*`                          | —        | Served by ASSETS binding (`public/`)                  |

### Admin Authentication

- **Password**: Validated with `crypto.subtle.timingSafeEqual` to prevent timing attacks
- **Sessions**: 24-hour HttpOnly/Secure/SameSite=Strict cookie; stored in `admin_sessions` table
- **CSRF**: Per-session token (two UUIDs concatenated) validated on every POST
- **Rate limiting**: 5 failed login attempts per IP per 10 minutes → HTTP 429; tracked in `login_attempts` table

### Caching Strategy

- **`/api/events`**: `Cache-Control: public, max-age=10, s-maxage=30` (10s browser, 30s CDN edge)
- **`/subscribe`, `/calendar.ics`**: `Cache-Control: public, max-age=3600`
- **After mutations** (add/update/delete): `caches.default.delete()` purges all three endpoints from CDN
- **Admin `loadEvents()`**: Uses `?_t=<timestamp>` cache-busting param to always bypass caches

### Database Schema

Key tables (full schema in `migrations/`):

| Table               | Purpose                                                                  |
| ------------------- | ------------------------------------------------------------------------ |
| `events`            | Core VEVENT data (uid PK, calendar_id FK, dtstart, dtend, summary, etc.) |
| `calendars`         | VCALENDAR wrapper metadata                                               |
| `event_alarms`      | VALARM entries linked to events                                          |
| `event_attachments` | File/URI attachments linked to events                                    |
| `admin_sessions`    | Active session tokens and CSRF tokens                                    |
| `login_attempts`    | Rate limiting — tracks failed logins by IP                               |

Indexes: `(calendar_id, dtstart)`, `(dtstart DESC)` on events; `(ip, attempted_at)` on login_attempts.

### ICS Feed

- RFC 5545 compliant: line folding at 75 octets, proper VALARM/ATTACH, VALUE=DATE for all-day events
- ICS values are escaped (newlines → `\n`, backslashes, semicolons, commas)
- Both `/subscribe` and `/calendar.ics` serve the identical feed

### Deployment

```bash
npm run deploy   # predeploy → build:client, then wrangler deploy → calendar.ntuas.com
```

Bindings in `wrangler.jsonc`: `DB` (D1 `calendar_db`), `ASSETS` (`./public`), observability enabled.

> [!IMPORTANT]
> **Always deploy via `npm run deploy` — never a bare `wrangler deploy`.**
> The client bundle is built by the `predeploy` npm hook. `npx wrangler deploy` invoked directly does not run npm
> lifecycle hooks, so it uploads `public/` *without* `public/dist/` — 10 assets instead of 36. The Worker deploys
> successfully and the API stays healthy, so this fails silently: the site just hangs on "Loading...".
>
> This is exactly how production broke on 2026-09-03. **Cloudflare Workers Builds** defaults its deploy command to
> `npx wrangler deploy`, so its dashboard **Build command** (Settings → Build) must run `npm run build:client`.
> Workers Builds does not honor wrangler's Custom Builds config, so this cannot be fixed from `wrangler.jsonc`.

Two pipelines deploy every push to `main` and race — whichever finishes last wins:

| Pipeline                                    | Runs                                  | Applies D1 migrations |
| ------------------------------------------- | ------------------------------------- | --------------------- |
| `.github/workflows/deploy.yml`              | `npm run deploy`                      | Yes, before deploying |
| Cloudflare Workers Builds (git integration) | Dashboard build + deploy commands     | No                    |

Only GitHub Actions applies migrations, so a push containing one can have Workers Builds deploy the new code before
the migration lands. Keep this in mind when shipping a schema change.

## Updating Venues

The NTU venue list is in `public/data/venues.json` (served as a static asset).

To add or remove venues:

1. Edit `public/data/venues.json` directly, OR
2. Edit `scripts/generate-venues.mjs` (the canonical source for additions that follow a pattern, e.g., "TR+1 through TR+99") and run:
   ```bash
   node scripts/generate-venues.mjs
   ```
3. Verify by opening the admin page locally (`npm run dev`, then http://localhost:8787/admin) and confirming the location autocomplete reflects the change.
4. Commit and push — the static asset deploys with the next worker deploy.

The COORDS map at the top of `venues.json` is a small set of pre-defined campus regions; new regions need a new key + lat;lng pair.
