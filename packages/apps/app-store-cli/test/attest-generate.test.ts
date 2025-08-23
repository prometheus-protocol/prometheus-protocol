import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import yaml from 'js-yaml';
import { Command } from 'commander';
import { registerAttestGenerateCommand } from '../src/commands/attest-generate.js';

// Mock the filesystem
vi.mock('node:fs');

describe('attest:generate command', () => {
  let program: Command;
  // This is the real sha256 hash of the string "mock wasm content"
  const EXPECTED_WASM_HASH =
    '82b1aa7b64662f9bad8eb275436c349167779b7f0a8562be6163a7027e441a47';

  beforeEach(() => {
    program = new Command();
    registerAttestGenerateCommand(program);
    vi.clearAllMocks();

    // Mock the filesystem for the "happy path"
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      if (filePath.toString().endsWith('prometheus.yml')) {
        return yaml.dump({
          submission: { wasm_path: './test.wasm' },
        });
      }
      if (filePath.toString().endsWith('test.wasm')) {
        return Buffer.from('mock wasm content');
      }
      throw new Error(`Unexpected readFileSync call: ${filePath}`);
    });
  });

  it('should read manifest, hash WASM, and generate a correct template', async () => {
    const commandArgs = [
      'node',
      'cli',
      'attest:generate',
      '--type',
      'security_v1',
    ];

    await program.parseAsync(commandArgs);

    // 1. Assert that the file was written
    expect(fs.writeFileSync).toHaveBeenCalledOnce();

    // 2. Inspect the content of the written file
    const [_, fileContent] = vi.mocked(fs.writeFileSync).mock.calls[0];

    // Check for the instructional header comments with the CORRECT, calculated hash
    expect(fileContent).toContain(
      '# Prometheus Attestation Manifest for Audit Type: security_v1',
    );
    expect(fileContent).toContain(`# Target WASM Hash: ${EXPECTED_WASM_HASH}`);

    // 3. Parse the YAML and check its structure
    const parsedYaml = yaml.load(fileContent as string) as any;
    expect(parsedYaml.wasm_hash).toBe(EXPECTED_WASM_HASH);
    expect(parsedYaml.metadata['126:audit_type']).toBe('security_v1');
  });

  it('should log an error for an unknown audit type', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const commandArgs = [
      'node',
      'cli',
      'attest:generate',
      '--type',
      'non_existent_type_v1',
    ];

    await program.parseAsync(commandArgs);

    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown audit type "non_existent_type_v1"'),
    );
    consoleErrorSpy.mockRestore();
  });

  it('should fail if prometheus.yml is not found', async () => {
    // Arrange: Override the mock for this specific test
    vi.mocked(fs.existsSync).mockImplementation(
      (p) => !p.toString().endsWith('prometheus.yml'),
    );
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'cli',
      'attest:generate',
      '--type',
      'security_v1',
    ]);

    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('`prometheus.yml` not found'),
    );
    consoleErrorSpy.mockRestore();
  });

  it('should fail if the WASM file specified in the manifest is not found', async () => {
    // Arrange: Override the mock for this specific test
    vi.mocked(fs.existsSync).mockImplementation(
      (p) => !p.toString().endsWith('test.wasm'),
    );
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'cli',
      'attest:generate',
      '--type',
      'security_v1',
    ]);

    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('WASM file not found at path:'),
    );
    consoleErrorSpy.mockRestore();
  });
});
