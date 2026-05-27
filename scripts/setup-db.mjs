import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';

console.log('🚀 Starting NTUAS Calendar local setup...\n');

try {
  // 1. Wipe local D1 state to guarantee clean setup
  const statePath = join(process.cwd(), '.wrangler/state');
  if (existsSync(statePath)) {
    console.log('🧹 Wiping stale wrangler local state...');
    rmSync(statePath, { recursive: true, force: true });
  }

  // 2. Apply all migrations locally
  console.log('⚡ Applying local D1 migrations...');
  execSync('npx wrangler d1 migrations apply calendar_db --local', { stdio: 'inherit' });

  // 3. Execute seed data
  console.log('\n🌱 Seeding database events...');
  execSync('npx wrangler d1 execute calendar_db --local --file=./seed.sql', { stdio: 'inherit' });

  // 4. Generate Cloudflare runtime types
  console.log('\n⚙️ Generating Cloudflare bindings types...');
  execSync('npm run cf-typegen', { stdio: 'inherit' });

  console.log('\n🎉 Local setup complete! Run "npm run dev" to start coding.');
} catch (error) {
  console.error('\n❌ Local setup failed:', error.message);
  process.exit(1);
}
