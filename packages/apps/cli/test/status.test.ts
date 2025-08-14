import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import yaml from 'js-yaml';
import * as api from '@prometheus-protocol/ic-js';
import * as utils from '../src/utils.js';
import { Principal } from '@dfinity/principal';
import { Command } from 'commander';
import { registerStatusCommand } from '../src/commands/status.js';

// Mock all dependencies
vi.mock('node:fs');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../src/utils.js');

describe('submission status command', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerStatusCommand(program);
    vi.clearAllMocks();

    // Mock the API response for a typical "in-progress" verification
    vi.mocked(api.getVerificationStatus).mockResolvedValue({
      isVerified: false,
      attestations: [
        {
          auditor: { toText: () => 'repro-auditor-principal' } as Principal,
          audit_type: 'build',
          metadata: [],
          timestamp: 0n,
        },
      ],
    });
    vi.mocked(utils.loadDfxIdentity).mockReturnValue({} as any);

    // Mock filesystem to provide the manifest and wasm
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (path.toString().endsWith('prometheus.yml')) {
        return yaml.dump({
          repo_url: 'https://github.com/test/repo',
          wasm_path: './test.wasm',
        });
      }
      if (path.toString().endsWith('test.wasm')) {
        return Buffer.from('mock wasm content');
      }
      return '';
    });
  });

  it('should call the API and display the verification status', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['status'], { from: 'user' });

    // Assert that our high-level API function was called
    expect(api.getVerificationStatus).toHaveBeenCalledOnce();

    // Assert that the output is formatted correctly
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Verified by DAO: ❌ No'),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Found 1 attestation(s)'),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Auditor: repro-auditor-principal'),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Type: build'),
    );

    consoleLogSpy.mockRestore();
  });
});
