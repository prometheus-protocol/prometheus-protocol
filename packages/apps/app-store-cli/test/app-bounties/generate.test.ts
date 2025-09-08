import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { Command } from 'commander';
import { registerAppBountiesCommand } from '../../src/commands/app-bounties/app-bounties.commands.js';

// Mock the filesystem
vi.mock('node:fs');

describe('app bounties generate command', () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    registerAppBountiesCommand(program);
  });

  it('should generate a new bounty file from the blank template', async () => {
    // Arrange
    vi.mocked(fs.existsSync).mockReturnValue(false); // File does not exist yet
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Act
    const cliArgs = ['app-bounties', 'generate', 'my-new-bounty'];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(fs.writeFileSync).toHaveBeenCalledOnce();
    const [filePath, fileContent] = vi.mocked(fs.writeFileSync).mock.calls[0];
    expect(path.basename(filePath as string)).toBe('bounty_my-new-bounty.yml');

    const parsedYaml = yaml.load(fileContent as string) as any;
    expect(parsedYaml.title).toBe('My New Bounty');
    expect(parsedYaml.status).toBe('Open');
    expect(parsedYaml.details_markdown).toContain('# Bounty Details');

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Success!'),
    );
    consoleLogSpy.mockRestore();
  });

  it('should fail if the file already exists', async () => {
    // Arrange
    vi.mocked(fs.existsSync).mockReturnValue(true); // File already exists
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Act
    const cliArgs = ['app-bounties', 'generate', 'existing-bounty'];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('already exists in this directory'),
    );
    consoleErrorSpy.mockRestore();
  });
});
