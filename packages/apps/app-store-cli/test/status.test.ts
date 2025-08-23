import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import yaml from 'js-yaml';
import * as api from '@prometheus-protocol/ic-js';
import * as identityApi from '../src/identity.node.js';
import { Principal } from '@dfinity/principal';
import { Command } from 'commander';
import { registerStatusCommand } from '../src/commands/status.js';

// Mock all dependencies
vi.mock('node:fs');
vi.mock('node:child_process');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../src/identity.node.js');

describe('status command', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerStatusCommand(program);
    vi.clearAllMocks();

    // --- MOCK IS FULLY UPDATED ---
    // The mock now returns the clean, processed objects that the CLI expects.
    // No more raw ICRC-16 maps or snake_case properties.
    vi.mocked(api.getVerificationStatus).mockResolvedValue({
      isVerified: false,
      attestations: [
        {
          auditor: Principal.fromText(
            'feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
          ),
          audit_type: 'build_reproducibility_v1',
          payload: { status: 'success' }, // Clean payload object
          timestamp: 1672531200000000000n,
        },
      ],
      bounties: [
        {
          id: 1n,
          tokenAmount: 1_000_000n,
          tokenCanisterId: Principal.fromText('mxzaz-hqaaa-aaaar-qaada-cai'),
          metadata: { audit_type: 'security_v1' }, // Clean metadata object
          claims: [],
          // Add other required fields to satisfy the ProcessedBounty type
          creator: Principal.fromText('aaaaa-aa'),
          created: new Date(),
          challengeParameters: {},
          validationCanisterId: Principal.fromText('aaaaa-aa'),
          validationCallTimeout: 0n,
          payoutFee: 0n,
        },
      ],
    });

    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue({} as any);
    vi.mocked(identityApi.getCurrentIdentityName).mockReturnValue('test-user');
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (path.toString().endsWith('prometheus.yml')) {
        return yaml.dump({ submission: { wasm_path: './test.wasm' } });
      }
      return Buffer.from('mock wasm content');
    });
  });

  it('should display the full status using the processed API response', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['status'], { from: 'user' });

    // --- Assert Bounty Output ---
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Found 1 tokenized bounty(s)'),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Bounty ID: 1'),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Reward: 1,000,000 tokens'),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('For Audit Type: security_v1'),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Status: 🟢 Open'),
    );

    // --- Assert Attestation Output ---
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Found 1 attestation(s)'),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Auditor: feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
      ),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Type: build_reproducibility_v1'),
    );

    consoleLogSpy.mockRestore();
  });

  // --- THIS TEST IS REMOVED ---
  // The API no longer returns `null`, so this case is impossible.
  // The `if (!status)` block in the command is now dead code.

  // The other failure tests remain unchanged and valid.
  it('should fail if prometheus.yml is not found', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await program.parseAsync(['status'], { from: 'user' });

    expect(api.getVerificationStatus).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('`prometheus.yml` not found'),
    );
    consoleErrorSpy.mockRestore();
  });

  it('should fail if the manifest is missing the wasm_path', async () => {
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (path.toString().endsWith('prometheus.yml')) {
        return yaml.dump({ submission: {} });
      }
      return Buffer.from('mock wasm content');
    });
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await program.parseAsync(['status'], { from: 'user' });

    expect(api.getVerificationStatus).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Manifest is incomplete'),
    );
    consoleErrorSpy.mockRestore();
  });
});
