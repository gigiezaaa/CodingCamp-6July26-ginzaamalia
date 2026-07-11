/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  testMatch: ['**/tests/**/*.test.js'],
  // jsdom does not ship crypto.randomUUID; polyfill it
  setupFiles: ['./tests/setup.js'],
};
