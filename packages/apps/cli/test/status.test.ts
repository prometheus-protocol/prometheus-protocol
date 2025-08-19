import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import yaml from 'js-yaml';
import * as api from '@prometheus-protocol/ic-js';
import * as utils from '../src/utils.js';
import { Principal } from '@dfinity/principal';
import { Command } from 'commander';
import { registerStatusCommand } from '../src/commands/status.js';

// Mock all dependencies
vi.mock('node:fs');
vi.mock('node:child_process');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../src/utils.js');

describe('status command', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerStatusCommand(program);
    vi.clearAllMocks();

    // --- THIS MOCK IS NOW UPDATED ---
    // The API response now reflects the real canister structure.
    // The audit type is inside the `metadata` map.
    vi.mocked(api.getVerificationStatus).mockResolvedValue({
      isVerified: false,
      attestations: [
        {
          auditor: Principal.fromText(
            'feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
          ),
          audit_type: 'build_reproducibility_v1',
          metadata: [
            ['126:audit_type', { Text: 'build_reproducibility_v1' }],
            ['status', { Text: 'success' }],
          ],
          timestamp: 0n,
        },
      ],
      bounties: [
        {
          bounty_id: 1n,
          token_amount: 1_000_000n,
          token_canister_id: Principal.fromText('mxzaz-hqaaa-aaaar-qaada-cai'),
          challenge_parameters: {
            Map: [['audit_type', { Text: 'security_audit' }]],
          },
          claimed: [],
          claims: [],
        } as any,
      ],
    });

    vi.mocked(utils.loadDfxIdentity).mockReturnValue({} as any);
    vi.mocked(execSync).mockReturnValue(Buffer.from('test-user'));
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (path.toString().endsWith('prometheus.yml')) {
        return yaml.dump({ submission: { wasm_path: './test.wasm' } });
      }
      return Buffer.from('mock wasm content');
    });
  });

  it('should display the full status, parsing metadata for audit type', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['status'], { from: 'user' });

    // --- Assert Attestation Output ---
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Found 1 attestation(s)'),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Auditor: feh5k-2fozc-ujrsf-otek5-pcla7-rmdtc-gwhmo-r2kct-iwtqr-xxzei-cae',
      ),
    );
    // --- THIS ASSERTION IS UPDATED ---
    // It now checks that the command correctly parsed the metadata.
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Type: build_reproducibility_v1'),
    );

    consoleLogSpy.mockRestore();
  });

  it('should display a "Not Found" message if the API returns null', async () => {
    // Arrange
    vi.mocked(api.getVerificationStatus).mockResolvedValue(null as any);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Act
    await program.parseAsync(['status'], { from: 'user' });

    // Assert
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Status: ❓ Not Found'),
    );
    consoleLogSpy.mockRestore();
  });

  // The other failure tests (missing file, malformed manifest) remain unchanged and valid.
  it('should fail if prometheus.yml is not found', async () => {
    // Arrange
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Act
    await program.parseAsync(['status'], { from: 'user' });

    // Assert
    expect(api.getVerificationStatus).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('`prometheus.yml` not found'),
    );
    consoleErrorSpy.mockRestore();
  });

  it('should fail if the manifest is missing the wasm_path', async () => {
    // Arrange
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (path.toString().endsWith('prometheus.yml')) {
        return yaml.dump({
          app: { id: 'com.test.app' },
          submission: {
            /* wasm_path is missing */
          },
        });
      }
      return Buffer.from('mock wasm content');
    });
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Act
    await program.parseAsync(['status'], { from: 'user' });

    // Assert
    expect(api.getVerificationStatus).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Manifest is incomplete'),
    );
    consoleErrorSpy.mockRestore();
  });
});
