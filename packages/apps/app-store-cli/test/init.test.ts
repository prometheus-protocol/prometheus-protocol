import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import prompts from 'prompts';
import yaml from 'js-yaml';
import { Command } from 'commander';
import { registerInitCommand } from '../src/commands/init.command.js';
// 1. Import the API module to ensure its functions are NOT called.
import * as api from '@prometheus-protocol/ic-js';

// Mock all external dependencies
vi.mock('node:fs');
vi.mock('prompts');
vi.mock('@prometheus-protocol/ic-js');

describe('init command', () => {
  let program: Command;

  beforeEach(() => {
    vi.resetAllMocks();
    program = new Command();
    registerInitCommand(program);
  });

  it('should create a manifest with the correct top-level namespace and NOT call the IC', async () => {
    // Arrange: Define the user input, using 'namespace' as the key.
    const mockUserInput = {
      namespace: 'com.test.app',
      name: 'My Test App',
      publisher: 'Test Devs',
      description: 'A test app description.',
      repo_url: 'https://github.com/test/app',
      // ... other fields can be omitted as prompts returns what's answered
    };
    vi.mocked(prompts).mockResolvedValue(mockUserInput);
    vi.mocked(fs.existsSync).mockReturnValue(false);

    // Act: Run the 'init' command
    await program.parseAsync(['init'], { from: 'user' });

    // Assert: Check file system and API calls
    expect(fs.writeFileSync).toHaveBeenCalledOnce();
    // 2. CRITICAL: Assert that no on-chain operations were attempted.
    expect(api.createCanisterType).not.toHaveBeenCalled();

    const [filePath, fileContent] = vi.mocked(fs.writeFileSync).mock.calls[0];
    expect(path.basename(filePath as string)).toBe('prometheus.yml');

    // 3. Parse the YAML and check for the new, standardized structure.
    const parsedYaml = yaml.load(fileContent as string) as any;

    // Check top-level structure
    expect(parsedYaml).not.toHaveProperty('app'); // The old structure is gone
    expect(parsedYaml).toHaveProperty('namespace', 'com.test.app');
    expect(parsedYaml).toHaveProperty('submission');

    // Check 'submission' section for prompted values
    expect(parsedYaml.submission.name).toBe('My Test App');
    expect(parsedYaml.submission.repo_url).toBe('https://github.com/test/app');

    // Check for required placeholder keys
    expect(parsedYaml.submission).toHaveProperty('git_commit', '');
    expect(parsedYaml.submission).toHaveProperty('wasm_path');
  });

  it('should not overwrite an existing prometheus.yml file', async () => {
    // Arrange
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Act
    await program.parseAsync(['init'], { from: 'user' });

    // Assert
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('prometheus.yml already exists'),
    );
    consoleLogSpy.mockRestore();
  });

  it('should exit gracefully if the user cancels the prompts', async () => {
    // Arrange: Simulate cancellation by returning an object missing the required 'namespace'
    const mockCancelledInput = { name: 'My Test App' };
    vi.mocked(prompts).mockResolvedValue(mockCancelledInput);
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Act
    await program.parseAsync(['init'], { from: 'user' });

    // Assert
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Initialization cancelled'),
    );
    consoleLogSpy.mockRestore();
  });
});
