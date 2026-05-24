# CLAUDE.md — Developer Notes for AI Agents

## Local Development

- Local dev server: `npm run dev` → `http://localhost:8787`
- Local D1 is initialized and contains a clone of production data — `npm run dev` serves real events
- Local dev never connects to the remote (production) D1
- If `.wrangler/state/v3/d1/` is wiped, events will be empty — see README for setup/migration steps

## Testing

Tests use an in-memory D1 — no local or remote database needed:
```bash
npm test                                   # Runs all unit tests (sequential spec runs are recommended)
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
- **Tooling**: wrangler CLI, vitest + `@cloudflare/vitest-pool-workers`
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
- `public/index.html` — Static landing page calendar (plain HTML + inline JS, fetches `/api/events`)
- `public/generate.cjs` — CommonJS static-reproducer tool for venue parsing
- `wrangler.jsonc` — Deployment config (custom domain `calendar.ntuas.com`, D1 binding, assets binding)
- `test/index.spec.ts` — Full test suite using in-memory D1
- `test/templates.spec.ts` — HTML byte-snapshot regression tests for admin & login pages
- `e2e/screenshot.spec.ts` — Playwright pixel-diff visual regression for admin & login pages
- `playwright.config.ts` — Playwright configuration
- `scripts/read-dev-vars.mjs` — Parses `.dev.vars` for E2E tests
- `schema.sql`, `seed.sql`, `remote_backup.sql` — Database schema, seed data, production backup

### Routing
All routing is dispatched in `src/index.ts` fetch handler to separate route handlers in `src/routes/`:

| Route | Method | Description |
|-------|--------|-------------|
| `/api/events` | GET | JSON array of all events |
| `/admin` | GET | Admin dashboard (server-rendered HTML) |
| `/admin` | POST | Event CRUD (action=add/update/delete), CSRF-protected |
| `/admin/login` | POST | Password authentication |
| `/admin/logout` | POST | Session termination |
| `/subscribe`, `/calendar.ics` | GET/POST | RFC 5545 ICS feed |
| `/*` | — | Served by ASSETS binding (`public/`) |

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
Key tables (full schema in `schema.sql`):

| Table | Purpose |
|-------|---------|
| `events` | Core VEVENT data (uid PK, calendar_id FK, dtstart, dtend, summary, etc.) |
| `calendars` | VCALENDAR wrapper metadata |
| `event_alarms` | VALARM entries linked to events |
| `event_attachments` | File/URI attachments linked to events |
| `admin_sessions` | Active session tokens and CSRF tokens |
| `login_attempts` | Rate limiting — tracks failed logins by IP |
| `timezone_rules` | VTIMEZONE definitions (present in schema, unused at runtime) |

Indexes: `(calendar_id, dtstart)`, `(dtstart DESC)` on events; `(ip, attempted_at)` on login_attempts.

### ICS Feed
- RFC 5545 compliant: line folding at 75 octets, proper VALARM/ATTACH, VALUE=DATE for all-day events
- ICS values are escaped (newlines → `\n`, backslashes, semicolons, commas)
- Both `/subscribe` and `/calendar.ics` serve the identical feed

### Deployment
```bash
npm run deploy   # wrangler deploy → calendar.ntuas.com
```
Bindings in `wrangler.jsonc`: `DB` (D1 `calendar_db`), `ASSETS` (`./public`), observability enabled.
