import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import yaml from 'js-yaml';
import * as api from '@prometheus-protocol/ic-js';
import * as identityApi from '../src/identity.node.js';
import { Principal } from '@dfinity/principal';
import { Command } from 'commander';
import { registerStatusCommand } from '../src/commands/status.command.js';

// Mock all dependencies
vi.mock('node:fs');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../src/identity.node.js'); // Adjust path if needed

describe('status command', () => {
  let program: Command;
  const MOCK_WASM_HASH_HEX =
    '82b1aa7b64662f9bad8eb275436c349167779b7f0a8562be6163a7027e441a47';

  beforeEach(() => {
    program = new Command();
    registerStatusCommand(program);
    vi.clearAllMocks();
    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue({} as any);
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  it('should display full verification and live status when run from a project directory', async () => {
    vi.mocked(api.getVerificationStatus).mockResolvedValue({
      isVerified: true,
      attestations: [
        { auditor: Principal.fromText('aaaaa-aa'), audit_type: 'test_v1' },
      ],
      bounties: [{ id: 1n, tokenAmount: 1_000_000n, claimedTimestamp: null }],
    } as any);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (path.toString().endsWith('prometheus.yml')) {
        return yaml.dump({
          namespace: 'com.test.app',
          submission: {
            wasm_path: './test.wasm',
            canister_id: 'rrkah-fqaaa-aaaaa-aaaaq-cai',
          },
        });
      }
      return Buffer.from('mock wasm content');
    });
    vi.mocked(api.getVersions).mockResolvedValue([
      { version: '1.0.0', wasm_hash: MOCK_WASM_HASH_HEX },
    ]);
    vi.mocked(api.getCanisterWasmHash).mockResolvedValue(
      Buffer.from(MOCK_WASM_HASH_HEX, 'hex'),
    );
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['status'], { from: 'user' });

    expect(api.getVerificationStatus).toHaveBeenCalledWith(MOCK_WASM_HASH_HEX);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Verified by DAO: ✅ Yes'),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Live Canister Status'),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '✅ Status: Verified. Matches published version 1.0.0.',
      ),
    );
    consoleLogSpy.mockRestore();
  });

  it('should display only verification status when a WASM hash is provided directly', async () => {
    vi.mocked(api.getVerificationStatus).mockResolvedValue({
      isVerified: true,
    } as any);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['status', MOCK_WASM_HASH_HEX], { from: 'user' });

    expect(api.getVerificationStatus).toHaveBeenCalledWith(MOCK_WASM_HASH_HEX);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Verified by DAO: ✅ Yes'),
    );
    expect(fs.readFileSync).not.toHaveBeenCalled();
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Live Canister Status'),
    );
    consoleLogSpy.mockRestore();
  });

  // --- THIS TEST IS REWRITTEN ---
  it('should display an "unverified" status for a hash not in the registry', async () => {
    // Arrange: Mock the API returning the new "empty" status object.
    vi.mocked(api.getVerificationStatus).mockResolvedValue({
      isVerified: false,
      bounties: [],
      attestations: [],
    });
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Act
    await program.parseAsync(['status', 'some-unknown-hash'], { from: 'user' });

    // Assert: Check for the correct output for an unverified, empty status.
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Verified by DAO: ❌ No'),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Found 0 tokenized bounty(s)'),
    );
    consoleLogSpy.mockRestore();
  });

  it('should fail if no hash is provided and prometheus.yml is not found', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await program.parseAsync(['status'], { from: 'user' });

    expect(api.getVerificationStatus).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('prometheus.yml not found'),
    );
    consoleErrorSpy.mockRestore();
  });
});
