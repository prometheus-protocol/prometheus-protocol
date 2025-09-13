import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import yaml from 'js-yaml';
import { Command } from 'commander';
// 1. Import the group registration function
import { registerAttestCommands } from '../../src/commands/attest/attest.commands.js';

// Mock the filesystem
vi.mock('node:fs');

describe('attest generate command', () => {
  let program: Command;
  // This is the real sha256 hash of the string "mock wasm content"
  const CALCULATED_WASM_HASH =
    '82b1aa7b64662f9bad8eb275436c349167779b7f0a8562be6163a7027e441a47';

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    // 2. Register the entire 'attest' command group
    registerAttestCommands(program);
  });

  // Test Case 1: Developer workflow (using prometheus.yml)
  it('should generate a template using the WASM hash from prometheus.yml', async () => {
    // Arrange
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (path.toString().endsWith('prometheus.yml')) {
        return yaml.dump({ submission: { wasm_path: './test.wasm' } });
      }
      return Buffer.from('mock wasm content');
    });

    // Act: Use the new positional argument structure
    const cliArgs = ['attest', 'generate', 'app_info_v1'];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(fs.writeFileSync).toHaveBeenCalledOnce();
    const [_, fileContent] = vi.mocked(fs.writeFileSync).mock.calls[0];
    expect(fileContent).toContain(
      `# Target WASM Hash: ${CALCULATED_WASM_HASH}`,
    );
    const parsedYaml = yaml.load(fileContent as string) as any;
    expect(parsedYaml.wasm_hash).toBe(CALCULATED_WASM_HASH);
    expect(parsedYaml.metadata['126:audit_type']).toBe('app_info_v1');
  });

  // Test Case 2: Auditor workflow (explicit wasm_hash)
  it('should generate a template using an explicitly provided WASM hash', async () => {
    // Arrange
    const explicitWasmHash = 'explicit-hash-abcdef123';

    // Act
    const cliArgs = ['attest', 'generate', 'app_info_v1', explicitWasmHash];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(fs.writeFileSync).toHaveBeenCalledOnce();
    const [_, fileContent] = vi.mocked(fs.writeFileSync).mock.calls[0];
    expect(fileContent).toContain(`# Target WASM Hash: ${explicitWasmHash}`);
    const parsedYaml = yaml.load(fileContent as string) as any;
    expect(parsedYaml.wasm_hash).toBe(explicitWasmHash);

    // Crucially, it should NOT have tried to read any files
    expect(fs.existsSync).not.toHaveBeenCalled();
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });

  // Test Case 3: Failure (no context)
  it('should fail gracefully if no WASM hash is provided and prometheus.yml is not found', async () => {
    // Arrange
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Act
    const cliArgs = ['attest', 'generate', 'app_info_v1'];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'WASM hash not provided and prometheus.yml not found',
      ),
    );
    consoleErrorSpy.mockRestore();
  });

  // Test Case 4: Unknown audit type
  it('should log an error for an unknown audit type', async () => {
    // Arrange
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Act
    const cliArgs = ['attest', 'generate', 'non_existent_type_v1', 'some-hash'];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown audit type "non_existent_type_v1"'),
    );
    consoleErrorSpy.mockRestore();
  });
});
