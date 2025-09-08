import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import * as api from '@prometheus-protocol/ic-js';
import { registerAppBountiesCommand } from '../../src/commands/app-bounties/app-bounties.commands.js';

// Mock all external dependencies
vi.mock('@prometheus-protocol/ic-js');

describe('app bounties list command', () => {
  let program: Command;

  const mockBounty = {
    id: 1n,
    title: 'Test Bounty',
    status: 'Open',
    reward_amount: 1.5,
    reward_token: 'preMCPT',
    short_description: '',
    details_markdown: '',
    created_at: 0n,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    registerAppBountiesCommand(program);
  });

  it('should fetch bounties and display them in a table', async () => {
    // Arrange
    vi.mocked(api.getAllAppBounties).mockResolvedValue([mockBounty]);
    const consoleTableSpy = vi
      .spyOn(console, 'table')
      .mockImplementation(() => {});

    // Act
    await program.parseAsync(['app-bounties', 'list'], { from: 'user' });

    // Assert
    expect(api.getAllAppBounties).toHaveBeenCalledOnce();
    expect(consoleTableSpy).toHaveBeenCalledOnce();

    const tableData = consoleTableSpy.mock.calls[0][0];
    expect(tableData[0]).toEqual({
      ID: 1,
      Title: 'Test Bounty',
      Status: 'Open',
      Reward: '1.5 preMCPT',
    });

    consoleTableSpy.mockRestore();
  });

  it('should display a message if no bounties are found', async () => {
    // Arrange
    vi.mocked(api.getAllAppBounties).mockResolvedValue([]);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleTableSpy = vi
      .spyOn(console, 'table')
      .mockImplementation(() => {});

    // Act
    await program.parseAsync(['app-bounties', 'list'], { from: 'user' });

    // Assert
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('No bounties found on the canister.'),
    );
    expect(consoleTableSpy).not.toHaveBeenCalled();

    consoleLogSpy.mockRestore();
    consoleTableSpy.mockRestore();
  });
});
