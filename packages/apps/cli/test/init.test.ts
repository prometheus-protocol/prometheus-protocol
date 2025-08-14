import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import prompts from 'prompts';
import yaml from 'js-yaml';
import { Command } from 'commander';
import { registerInitCommand } from '../src/commands/init.js';

// Mock the external dependencies
vi.mock('node:fs');
vi.mock('prompts');

describe('init command', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerInitCommand(program);
    vi.resetAllMocks();
  });

  it('should create prometheus.yml with user-provided input', async () => {
    // Arrange
    const mockUserInput = {
      name: 'My Test App',
      namespace: 'com.test.app',
      frontend_url: 'https://test.app',
    };
    vi.mocked(prompts).mockResolvedValue(mockUserInput);
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await program.parseAsync(['init'], { from: 'user' });

    // Assert
    expect(fs.writeFileSync).toHaveBeenCalledOnce();

    const [filePath, fileContent] = vi.mocked(fs.writeFileSync).mock.calls[0];

    // --- FIX 1: Check the base name of the path, not the full path ---
    expect(path.basename(filePath as string)).toBe('prometheus.yml');

    const parsedYaml = yaml.load(fileContent as string);
    expect(parsedYaml).toEqual(mockUserInput);
  });

  it('should not overwrite an existing prometheus.yml file', async () => {
    // Arrange
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['init'], { from: 'user' });

    // Assert
    expect(fs.writeFileSync).not.toHaveBeenCalled();

    // --- FIX 2: Expect the exact log message from the implementation ---
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '🟡 prometheus.yml already exists in this directory. Skipping.',
    );

    consoleLogSpy.mockRestore();
  });
});
