/**
 * Jest setup file — runs before each test file.
 *
 * Polyfills crypto.randomUUID() for jsdom, which does not provide it.
 * Uses Node's built-in `crypto` module so no external package is needed.
 */
const { randomUUID } = require('crypto');

if (!globalThis.crypto) {
  globalThis.crypto = {};
}
if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = randomUUID;
}
