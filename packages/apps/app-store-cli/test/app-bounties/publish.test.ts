import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import yaml from 'js-yaml';
import * as api from '@prometheus-protocol/ic-js';
import { Command } from 'commander';
import { registerAppBountiesCommand } from '../../src/commands/app-bounties/app-bounties.commands.js';
import * as identityApi from '../../src/identity.node.js';

// Mock all external dependencies
vi.mock('node:fs');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../../src/identity.node.js');

describe('app bounties publish command', () => {
  let program: Command;
  const MOCK_BOUNTY_DATA = {
    title: 'Test Bounty',
    short_description: 'A test',
    reward_amount: 1.0,
    reward_token: 'ICP',
    status: 'Open',
    details_markdown: '# Test',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    registerAppBountiesCommand(program);

    // Mock API and identity for happy paths
    vi.mocked(api.createAppBounty).mockResolvedValue(1n);
    vi.mocked(api.updateAppBounty).mockResolvedValue(undefined);
    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue({} as any);
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  it('should call createAppBounty when the YAML file has no ID', async () => {
    // Arrange
    const bountyContent = yaml.dump(MOCK_BOUNTY_DATA);
    vi.mocked(fs.readFileSync).mockReturnValue(bountyContent);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Act
    const cliArgs = ['app-bounties', 'publish', './new-bounty.yml'];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.createAppBounty).toHaveBeenCalledOnce();
    expect(api.updateAppBounty).not.toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledOnce(); // Should write the ID back
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Success! New bounty created with ID: 1'),
    );
    consoleLogSpy.mockRestore();
  });

  it('should call updateBounty when the YAML file has an ID', async () => {
    // Arrange
    const bountyWithId = { ...MOCK_BOUNTY_DATA, id: 1 };
    const bountyContent = yaml.dump(bountyWithId);
    vi.mocked(fs.readFileSync).mockReturnValue(bountyContent);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Act
    const cliArgs = ['app-bounties', 'publish', './existing-bounty.yml'];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.updateAppBounty).toHaveBeenCalledOnce();
    const [_, callArgs] = vi.mocked(api.updateAppBounty).mock.calls[0];
    expect(callArgs.id).toBe(1n);
    expect(api.createAppBounty).not.toHaveBeenCalled();
    expect(fs.writeFileSync).not.toHaveBeenCalled(); // Should NOT write back
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Success! The bounty has been updated'),
    );
    consoleLogSpy.mockRestore();
  });

  it('should fail if the bounty file does not exist', async () => {
    // Arrange
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Act
    const cliArgs = ['app-bounties', 'publish', './bad.yml'];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.createAppBounty).not.toHaveBeenCalled();
    expect(api.updateAppBounty).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('File not found'),
    );
    consoleErrorSpy.mockRestore();
  });
});
