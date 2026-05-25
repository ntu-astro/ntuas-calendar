// Augment the wrangler-generated `Env` interface with secrets that
// `wrangler types` can't infer from wrangler.jsonc.
//
// `ADMIN_PASSWORD` is set via `wrangler secret put` in production and
// via `.dev.vars` locally. `.dev.vars` is gitignored, so in CI (and any
// clean checkout) `worker-configuration.d.ts` does not include it.
//
// Bindings declared in wrangler.jsonc (DB, ASSETS) are inferred
// automatically — only secrets need to be redeclared here.
interface Env {
	ADMIN_PASSWORD: string;
}

declare namespace Cloudflare {
	interface Env {
		ADMIN_PASSWORD: string;
	}
}
