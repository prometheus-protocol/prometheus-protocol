import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import yaml from 'js-yaml';
import * as api from '@prometheus-protocol/ic-js';
import { Command } from 'commander';
import { registerAttestCommands } from '../../src/commands/attest/attest.commands.js';
import * as identityApi from '../../src/identity.node.js';

// Mock all external dependencies
vi.mock('node:fs');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../../src/identity.node.js');

describe('attest submit command', () => {
  let program: Command;
  const MOCK_WASM_HASH =
    'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
  // --- CHANGE 1: Add a mock bounty ID for testing ---
  const MOCK_BOUNTY_ID = 123n;

  const MOCK_ATTESTATION_FILE_CONTENT = yaml.dump({
    wasm_hash: MOCK_WASM_HASH,
    metadata: {
      audit_type: 'data_safety_v1',
      report_url: 'https://example.com/report.pdf',
      score: 95,
      summary: 'The canister is well-written and secure.',
      issues_found: [],
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    registerAttestCommands(program);

    // Mock API and filesystem
    vi.mocked(api.fileAttestation).mockResolvedValue(undefined);
    vi.mocked(identityApi.getCurrentIdentityName).mockReturnValue('default');
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(MOCK_ATTESTATION_FILE_CONTENT);
  });

  it('should read, serialize, and submit a valid attestation file with a bounty ID', async () => {
    // --- CHANGE 2: Add the required --bounty-id flag to the CLI arguments ---
    const cliArgs = [
      'attest',
      'submit',
      './data_safety_v1_attestation.yml',
      '--bounty-id',
      MOCK_BOUNTY_ID.toString(), // CLI args are strings
    ];

    await program.parseAsync(cliArgs, { from: 'user' });

    expect(api.fileAttestation).toHaveBeenCalledOnce();
    const [_, callArgs] = vi.mocked(api.fileAttestation).mock.calls[0];

    // --- CHANGE 3: Add an assertion to verify the bounty_id was passed correctly ---
    expect(callArgs.bounty_id).toBe(MOCK_BOUNTY_ID);

    // Existing assertions are still valid and important
    expect(callArgs.wasm_id).toBe(MOCK_WASM_HASH);
    expect(callArgs.attestationData).toEqual({
      audit_type: 'data_safety_v1',
      report_url: 'https://example.com/report.pdf',
      score: 95,
      summary: 'The canister is well-written and secure.',
      issues_found: [],
    });
  });

  it('should fail if the specified file does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    // Also provide the required flag here so the command can run
    const cliArgs = [
      'attest',
      'submit',
      './bad.yml',
      '--bounty-id',
      MOCK_BOUNTY_ID.toString(),
    ];

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
    // Also provide the required flag here
    const cliArgs = [
      'attest',
      'submit',
      './bad.yml',
      '--bounty-id',
      MOCK_BOUNTY_ID.toString(),
    ];

    await program.parseAsync(cliArgs, { from: 'user' });

    expect(api.fileAttestation).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Manifest is malformed'),
    );
    consoleErrorSpy.mockRestore();
  });
});
