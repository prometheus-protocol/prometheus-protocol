import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Regression test for the bug fixed in PR #92:
 *
 *   `getCanisterWasmHash` was reading `process.env.DFX_NETWORK` directly
 *   instead of using the shared `getHost()` from config.ts. When a CLI or
 *   frontend configured ic-js for mainnet via `configure({ host })` without
 *   also setting the env var, this function silently dialed
 *   http://127.0.0.1:4943 and the BYOC `register` command failed with a
 *   misleading "Could not read module_hash" error.
 *
 * This test verifies the shared host-resolution contract: the host that
 * `configure()` sets is the host `getHost()` returns, for every caller in
 * the package.
 */
describe('ic-js host resolution (regression for PR #92)', () => {
  beforeEach(() => {
    // Each test gets a fresh module graph so `_isConfigured` resets.
    vi.resetModules();
  });

  it('returns the mainnet URL by default before configure() is called', async () => {
    const { getHost } = await import('../src/config.js');
    expect(getHost()).toBe('https://icp-api.io');
  });

  it('returns the host passed to configure()', async () => {
    const { configure, getHost } = await import('../src/config.js');
    configure({
      canisterIds: { MCP_REGISTRY: 'aaaaa-aa' },
      host: 'https://icp-api.io',
    });
    expect(getHost()).toBe('https://icp-api.io');
  });

  it('returns a local host when configured for local replica', async () => {
    const { configure, getHost } = await import('../src/config.js');
    configure({
      canisterIds: { MCP_REGISTRY: 'aaaaa-aa' },
      host: 'http://127.0.0.1:4943',
    });
    expect(getHost()).toBe('http://127.0.0.1:4943');
  });

  it('falls back to mainnet if configure() is called without an explicit host', async () => {
    const { configure, getHost } = await import('../src/config.js');
    configure({ canisterIds: { MCP_REGISTRY: 'aaaaa-aa' } });
    expect(getHost()).toBe('https://icp-api.io');
  });

  it('is-local detection treats only loopback-style hosts as local', async () => {
    // This mirrors the inline check in both `createActor()` and
    // `getCanisterWasmHash()` — if this contract changes, those callers
    // must be updated in lockstep.
    const isLocal = (host: string) =>
      host.includes('localhost') ||
      host.includes('127.0.0.1') ||
      host.includes('host.docker.internal');

    expect(isLocal('http://127.0.0.1:4943')).toBe(true);
    expect(isLocal('http://localhost:4943')).toBe(true);
    expect(isLocal('http://host.docker.internal:4943')).toBe(true);
    expect(isLocal('https://icp-api.io')).toBe(false);
    expect(isLocal('https://ic0.app')).toBe(false);
  });
});
