import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import yaml from 'js-yaml';
import * as api from '@prometheus-protocol/ic-js';
import { Command } from 'commander';
import { registerAttestSubmitCommand } from '../src/commands/attest-submit.js';
import * as identityApi from '../src/identity.node.js';

// Mock all external dependencies
vi.mock('node:fs');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../src/identity.node.js');

describe('attest:submit command', () => {
  let program: Command;
  const MOCK_WASM_HASH =
    'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

  // A complete, filled-out attestation manifest
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

  beforeEach(async () => {
    program = new Command();
    registerAttestSubmitCommand(program);
    vi.clearAllMocks();

    // Mock API and filesystem
    vi.mocked(api.fileAttestation).mockResolvedValue('Success' as any);
    vi.mocked(identityApi.getCurrentIdentityName).mockReturnValue('default');
    vi.mocked(api.serializeToIcrc16Map).mockImplementation((obj) => {
      // Simple mock that converts an object to a Map with ICRC-16-like values
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
    const commandArgs = [
      'attest:submit',
      '--file',
      './security_v1_attestation.yml',
    ];

    await program.parseAsync(commandArgs, { from: 'user' });

    // 1. Assert the on-chain API was called
    expect(api.fileAttestation).toHaveBeenCalledOnce();

    // 2. Inspect the arguments passed to the API
    const [_, callArgs] = vi.mocked(api.fileAttestation).mock.calls[0];

    // Check the wasm_hash
    expect(callArgs.wasm_hash).toBe(MOCK_WASM_HASH);

    // Check the serialized metadata
    const metadataMap = new Map(callArgs.metadata);
    expect(metadataMap.get('audit_type')).toEqual({ Text: 'security_v1' });
    expect(metadataMap.get('report_url')).toEqual({
      Text: 'https://example.com/report.pdf',
    });
    expect(metadataMap.get('score')).toEqual({ Nat: 95 });
    expect(metadataMap.get('issues_found')).toEqual({ Array: [] });
  });

  it('should fail if the specified file does not exist', async () => {
    // Arrange
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const commandArgs = ['node', 'cli', 'attest:submit', '--file', './bad.yml'];

    // Act
    await program.parseAsync(commandArgs);

    // Assert
    expect(api.fileAttestation).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('File not found'),
    );
    consoleErrorSpy.mockRestore();
  });

  it('should fail if the manifest file is malformed', async () => {
    // Arrange: Provide a file missing the required 'metadata' key
    vi.mocked(fs.readFileSync).mockReturnValue(
      yaml.dump({ wasm_hash: MOCK_WASM_HASH }),
    );
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const commandArgs = ['node', 'cli', 'attest:submit', '--file', './bad.yml'];

    // Act
    await program.parseAsync(commandArgs);

    // Assert
    expect(api.fileAttestation).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Manifest is malformed'),
    );
    consoleErrorSpy.mockRestore();
  });
});
