import { rm } from 'node:fs/promises';

export default async function globalTeardown() {
  const embedded = globalThis.__EMBEDDED_PG__;
  if (!embedded) return;
  await embedded.pg.stop();
  // No Windows o processo do PostgreSQL pode segurar os arquivos por alguns instantes.
  await rm(embedded.databaseDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
