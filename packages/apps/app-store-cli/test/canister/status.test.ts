import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
// 1. Import the group registration function
import { registerCanisterCommands } from '../../src/commands/canister/canister.commands.js';
import * as api from '@prometheus-protocol/ic-js';
import * as identityApi from '../../src/identity.node.js';

// Mock all external dependencies
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../../src/identity.node.js'); // Adjust path if needed

describe('canister status command', () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers(); // Use fake timers to control setTimeout

    program = new Command();
    // 2. Register the entire 'canister' command group
    registerCanisterCommands(program);

    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue({} as any);
  });

  afterEach(() => {
    vi.useRealTimers(); // Restore real timers to avoid test interference
  });

  // 3. Define the new command arguments
  const cliArgs = ['canister', 'status'];

  it('should poll until status is Success', async () => {
    // Arrange
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    // Mock the API to return InProgress twice, then Success
    vi.mocked(api.getUpgradeStatus)
      .mockResolvedValueOnce({ InProgress: 0n })
      .mockResolvedValueOnce({ InProgress: 0n })
      .mockResolvedValueOnce({ Success: 12345n });

    // Act
    const promise = program.parseAsync(cliArgs, { from: 'user' });
    await vi.runAllTimersAsync(); // Fast-forward through all setTimeout calls
    await promise;

    // Assert
    expect(api.getUpgradeStatus).toHaveBeenCalledTimes(3);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('🎉 Success! Upgrade completed'),
    );

    consoleLogSpy.mockRestore();
  });

  it('should stop polling and log an error on Failed status', async () => {
    // Arrange
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const failureReason = 'WASM hash not found in registry.';
    vi.mocked(api.getUpgradeStatus)
      .mockResolvedValueOnce({ InProgress: 0n })
      .mockResolvedValueOnce({ Failed: [98765n, failureReason] });

    // Act
    const promise = program.parseAsync(cliArgs, { from: 'user' });
    await vi.runAllTimersAsync();
    await promise;

    // Assert
    expect(api.getUpgradeStatus).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('❌ Failure! Upgrade failed'),
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(failureReason),
    );

    consoleErrorSpy.mockRestore();
  });

  it('should time out after max retries if status is always InProgress', async () => {
    // Arrange
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    // Mock the API to always return InProgress
    vi.mocked(api.getUpgradeStatus).mockResolvedValue({ InProgress: 0n });
    const maxRetries = 20; // This must match the value in the command file

    // Act
    const promise = program.parseAsync(cliArgs, { from: 'user' });
    await vi.runAllTimersAsync();
    await promise;

    // Assert
    expect(api.getUpgradeStatus).toHaveBeenCalledTimes(maxRetries);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Polling timed out'),
    );

    consoleLogSpy.mockRestore();
  });
});
