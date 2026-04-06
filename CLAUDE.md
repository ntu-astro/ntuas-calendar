# CLAUDE.md — Developer Notes for AI Agents

## Local Development

- Local dev server: `npm run dev` → `http://localhost:8787`
- Local D1 is initialized and contains a clone of production data — `npm run dev` serves real events
- Local dev never connects to the remote (production) D1
- If `.wrangler/state/v3/d1/` is wiped, events will be empty — see README for setup/migration steps

## Testing

Tests use an in-memory D1 — no local or remote database needed:
```bash
npm test
```
