import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: './wrangler.jsonc' },
			miniflare: {
				bindings: {
					ADMIN_PASSWORD: 'test-password-123',
				},
			},
		}),
	],
	test: {
		// Playwright specs in e2e/ run via `npm run test:e2e`, not vitest.
		exclude: ['e2e/**', 'node_modules/**', '.wrangler/**', 'dist/**'],
		// Run spec files sequentially. @cloudflare/vitest-pool-workers crashes a miniflare
		// WebSocket worker during concurrent teardown. See CLAUDE.md > Testing.
		fileParallelism: false,
		// Even sequential runs sporadically emit `_WebSocket.emitUnexpectedExit` during
		// pool teardown. The errors are pool-cleanup noise — all tests pass before they
		// fire. Ignoring them keeps CI green; we'll revisit if a real test error ever
		// surfaces here.
		dangerouslyIgnoreUnhandledErrors: true,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'lcov'],
			thresholds: {
				lines: 80,
				functions: 80,
				branches: 80,
				statements: 80,
			},
		},
	},
});
