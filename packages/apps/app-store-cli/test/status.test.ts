import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import yaml from 'js-yaml';
import * as api from '@prometheus-protocol/ic-js';
import * as identityApi from '../src/identity.node.js';
import { Principal } from '@icp-sdk/core/principal';
import { Command } from 'commander';
import { registerStatusCommand } from '../src/commands/status.command.js';

// Mock all dependencies
vi.mock('node:fs');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../src/identity.node.js');

describe('status command', () => {
  let program: Command;
  const MOCK_WASM_HASH_HEX =
    '82b1aa7b64662f9bad8eb275436c349167779b7f0a8562be6163a7027e441a47';
  const MOCK_AUDITOR_PRINCIPAL = Principal.fromUint8Array(
    new Uint8Array([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]),
  );
  const MOCK_REPORTER_PRINCIPAL = Principal.fromUint8Array(
    new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
  );

  beforeEach(() => {
    program = new Command();
    registerStatusCommand(program);
    vi.clearAllMocks();
    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue({} as any);
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  it('should display full verification status, including attestations and divergences', async () => {
    // --- THE FIX IS HERE: Ensure the mock data is complete ---
    vi.mocked(api.getVerificationStatus).mockResolvedValue({
      isVerified: false,
      auditRecords: [
        {
          type: 'attestation',
          auditor: MOCK_AUDITOR_PRINCIPAL,
          audit_type: 'build_reproducibility_v1',
        },
        {
          type: 'divergence',
          reporter: MOCK_REPORTER_PRINCIPAL,
          // This 'reason' property is what fixes the "undefined" error.
          report: 'Build failed due to dependency mismatch.',
        },
      ],
      bounties: [{ id: 1n, tokenAmount: 1_000_000n, claimedTimestamp: null }],
      verificationRequest: {
        repo: 'https://github.com/test/repo',
        commit_hash: 'abcdef123',
      },
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
      {
        version: '1.0.0',
        wasm_hash: MOCK_WASM_HASH_HEX,
        description: '',
        date_added: new Date(),
        is_deprecated: false,
      },
    ]);
    vi.mocked(api.getCanisterWasmHash).mockResolvedValue(
      Buffer.from(MOCK_WASM_HASH_HEX, 'hex'),
    );
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['status'], { from: 'user' });

    expect(api.getVerificationStatus).toHaveBeenCalledWith(MOCK_WASM_HASH_HEX);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Verified by DAO: ❌ No'),
    );
    // --- Assert the new, detailed output ---
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Verified by DAO: ❌ No'),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Found 2 audit record(s)'),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `✅ [1] Attestation for 'build_reproducibility_v1' by ${MOCK_AUDITOR_PRINCIPAL.toText()}`,
      ),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `❌ [2] Divergence Reported by ${MOCK_REPORTER_PRINCIPAL.toText()}`,
      ),
    );
    // This assertion will now pass because the mock provides the correct reason.
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Reason: "Build failed due to dependency mismatch."',
      ),
    );

    consoleLogSpy.mockRestore();
  });

  it('should display only verification status when a WASM hash is provided directly', async () => {
    // --- THE FIX: Use `auditRecords` ---
    vi.mocked(api.getVerificationStatus).mockResolvedValue({
      isVerified: true,
      auditRecords: [],
      bounties: [],
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

  it('should display a "not found" status for a hash not in the registry', async () => {
    // --- THE FIX: Mock the API returning null for a non-existent hash ---
    vi.mocked(api.getVerificationStatus).mockResolvedValue(null as any);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['status', 'some-unknown-hash'], { from: 'user' });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Verification Status: ❓ Not Found'),
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
