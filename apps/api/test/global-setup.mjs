import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const EMBEDDED_PORT = 54329;

export default async function globalSetup() {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET ??= 'test-only-secret-with-at-least-32-characters';
  process.env.LOGIN_RATE_LIMIT ??= '10000';

  let url = process.env.TEST_DATABASE_URL;
  if (!url) {
    const { default: EmbeddedPostgres } = await import('embedded-postgres');
    const databaseDir = mkdtempSync(join(tmpdir(), 'market-pg-'));
    const pg = new EmbeddedPostgres({
      databaseDir,
      user: 'market',
      password: 'market',
      port: EMBEDDED_PORT,
      persistent: true,
      onLog: () => {},
    });
    await pg.initialise();
    await pg.start();
    await pg.createDatabase('market_test');
    globalThis.__EMBEDDED_PG__ = { pg, databaseDir };
    url = `postgresql://market:market@localhost:${EMBEDDED_PORT}/market_test`;
  }

  process.env.DATABASE_URL = url;
  execSync('pnpm exec prisma migrate deploy', { cwd: apiRoot, env: process.env, stdio: 'pipe' });
}
