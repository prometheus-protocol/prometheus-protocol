import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import yaml from 'js-yaml';
import * as api from '@prometheus-protocol/ic-js';
import { Command } from 'commander';
// 1. Import the group registration function
import { registerAttestCommands } from '../../src/commands/attest/attest.commands.js';
import * as identityApi from '../../src/identity.node.js';

// Mock all external dependencies
vi.mock('node:fs');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../../src/identity.node.js'); // Adjust path if needed

describe('attest submit command', () => {
  let program: Command;
  const MOCK_WASM_HASH =
    'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

  const MOCK_ATTESTATION_FILE_CONTENT = yaml.dump({
    wasm_hash: MOCK_WASM_HASH,
    metadata: {
      audit_type: 'security_v1',
      report_url: 'https://example.com/report.pdf',
      score: 95,
      summary: 'The canister is well-written and secure.',
      issues_found: [],
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    // 2. Register the entire 'attest' command group
    registerAttestCommands(program);

    // Mock API and filesystem
    vi.mocked(api.fileAttestation).mockResolvedValue('Success' as any);
    vi.mocked(identityApi.getCurrentIdentityName).mockReturnValue('default');
    vi.mocked(api.serializeToIcrc16Map).mockImplementation((obj) => {
      const map = new Map<string, any>();
      for (const [key, value] of Object.entries(obj)) {
        if (Array.isArray(value)) {
          map.set(key, { Array: value.map((v) => ({ Text: v })) });
        } else if (typeof value === 'number') {
          map.set(key, { Nat: value });
        } else {
          map.set(key, { Text: value });
        }
      }
      return map as any;
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(MOCK_ATTESTATION_FILE_CONTENT);
  });

  it('should read, serialize, and submit a valid attestation file', async () => {
    // 3. Use the new positional argument structure
    const cliArgs = ['attest', 'submit', './security_v1_attestation.yml'];

    await program.parseAsync(cliArgs, { from: 'user' });

    // Assertions remain the same (they are excellent)
    expect(api.fileAttestation).toHaveBeenCalledOnce();
    const [_, callArgs] = vi.mocked(api.fileAttestation).mock.calls[0];
    expect(callArgs.wasm_hash).toBe(MOCK_WASM_HASH);
    const metadataMap = new Map(callArgs.metadata);
    expect(metadataMap.get('audit_type')).toEqual({ Text: 'security_v1' });
    expect(metadataMap.get('score')).toEqual({ Nat: 95 });
  });

  it('should fail if the specified file does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    // 3. Use the new positional argument structure
    const cliArgs = ['attest', 'submit', './bad.yml'];

    await program.parseAsync(cliArgs, { from: 'user' });

    expect(api.fileAttestation).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('File not found'),
    );
    consoleErrorSpy.mockRestore();
  });

  it('should fail if the manifest file is malformed', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      yaml.dump({ wasm_hash: MOCK_WASM_HASH }), // Missing 'metadata' key
    );
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    // 3. Use the new positional argument structure
    const cliArgs = ['attest', 'submit', './bad.yml'];

    await program.parseAsync(cliArgs, { from: 'user' });

    expect(api.fileAttestation).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Manifest is malformed'),
    );
    consoleErrorSpy.mockRestore();
  });
});
