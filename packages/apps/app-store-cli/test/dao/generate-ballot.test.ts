import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { Command } from 'commander';
// 1. Import the group registration function
import { registerDaoCommands } from '../../src/commands/dao/dao.commands.js';

// Mock the filesystem
vi.mock('node:fs');

describe('dao generate-ballot command', () => {
  let program: Command;
  // This is the real sha256 hash of the string "mock wasm content"
  const CALCULATED_WASM_ID =
    '82b1aa7b64662f9bad8eb275436c349167779b7f0a8562be6163a7027e441a47';

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    // 2. Register the entire 'dao' command group
    registerDaoCommands(program);
  });

  // Test Case 1: Developer/Local Reviewer workflow (using prometheus.yml)
  it('should generate a ballot using the WASM ID from prometheus.yml', async () => {
    // Arrange
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (path.toString().endsWith('prometheus.yml')) {
        return yaml.dump({ submission: { wasm_path: './test.wasm' } });
      }
      return Buffer.from('mock wasm content');
    });

    // Act: Use the new command structure without an explicit ID
    const cliArgs = ['dao', 'generate-ballot'];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(fs.writeFileSync).toHaveBeenCalledOnce();
    const [filePath, fileContent] = vi.mocked(fs.writeFileSync).mock.calls[0];
    expect(path.basename(filePath as string)).toBe('dao_decision_ballot.yml');
    const parsedYaml = yaml.load(fileContent as string) as any;
    expect(parsedYaml.wasm_id).toBe(CALCULATED_WASM_ID);
    expect(parsedYaml.outcome).toBe('Verified | Rejected');
  });

  // Test Case 2: Remote DAO Member workflow (explicit wasm_id)
  it('should generate a ballot using an explicitly provided WASM ID', async () => {
    // Arrange
    const explicitWasmId = 'explicit-wasm-id-abcdef123';

    // Act
    const cliArgs = ['dao', 'generate-ballot', explicitWasmId];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(fs.writeFileSync).toHaveBeenCalledOnce();
    const [_, fileContent] = vi.mocked(fs.writeFileSync).mock.calls[0];
    const parsedYaml = yaml.load(fileContent as string) as any;
    expect(parsedYaml.wasm_id).toBe(explicitWasmId);

    // Crucially, it should NOT have tried to read any files
    expect(fs.existsSync).not.toHaveBeenCalled();
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });

  // Test Case 3: Failure workflow (no context)
  it('should fail gracefully if no WASM ID is provided and prometheus.yml is not found', async () => {
    // Arrange
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Act
    const cliArgs = ['dao', 'generate-ballot'];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'WASM ID not provided and prometheus.yml not found',
      ),
    );
    consoleErrorSpy.mockRestore();
  });
});
