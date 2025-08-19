import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import yaml from 'js-yaml';
import * as api from '@prometheus-protocol/ic-js';
import * as utils from '../src/utils.js';
import { Command } from 'commander';
import { registerAttestSubmitCommand } from '../src/commands/attest-submit.js';

// Mock all external dependencies
vi.mock('node:fs');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../src/utils.js');

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

    // Use the real implementation for the serializer, but mock other utils
    const actualUtils = await vi.importActual<typeof utils>('../src/utils.js');
    vi.mocked(utils.serializeToIcrc16Map).mockImplementation(
      actualUtils.serializeToIcrc16Map,
    );
    vi.mocked(utils.loadDfxIdentity).mockReturnValue({} as any);

    // Mock API and filesystem
    vi.mocked(api.fileAttestation).mockResolvedValue(undefined);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(MOCK_ATTESTATION_FILE_CONTENT);
  });

  it('should read, serialize, and submit a valid attestation file', async () => {
    const commandArgs = [
      'node',
      'cli',
      'attest:submit',
      '--file',
      './security_v1_attestation.yml',
    ];

    await program.parseAsync(commandArgs);

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
    expect(metadataMap.get('score')).toEqual({ Nat: 95n });
    expect(metadataMap.get('issues_found')).toEqual({ Text: '[]' }); // Arrays are stringified
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
