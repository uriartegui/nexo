/**
 * Testes E2E contra PostgreSQL real.
 * Com TEST_DATABASE_URL usa esse banco (ex.: CI ou docker compose);
 * sem ela, sobe um PostgreSQL embutido temporário.
 */
module.exports = {
  rootDir: '..',
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testEnvironment: 'node',
  globalSetup: '<rootDir>/test/global-setup.mjs',
  globalTeardown: '<rootDir>/test/global-teardown.mjs',
  testTimeout: 30000,
};
