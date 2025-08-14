import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerUpgradeStatusCommand } from '../src/commands/upgrade-status.js';
import * as api from '@prometheus-protocol/ic-js';
import * as utils from '../src/utils.js';

vi.mock('@prometheus-protocol/ic-js');
vi.mock('../src/utils.js');

describe('upgrade-status command', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerUpgradeStatusCommand(program);
    vi.clearAllMocks();
    vi.useFakeTimers(); // Use fake timers to control setTimeout

    vi.mocked(utils.loadDfxIdentity).mockReturnValue({} as any);
  });

  afterEach(() => {
    vi.useRealTimers(); // Restore real timers
  });

  it('should poll until status is Success', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Mock the API to return InProgress twice, then Success
    vi.mocked(api.getUpgradeStatus)
      .mockResolvedValueOnce({ InProgress: 0n })
      .mockResolvedValueOnce({ InProgress: 5000n })
      .mockResolvedValueOnce({ Success: 12345n });

    const promise = program.parseAsync(['upgrade-status'], { from: 'user' });
    await vi.runAllTimersAsync(); // Fast-forward through all setTimeout calls
    await promise;

    expect(api.getUpgradeStatus).toHaveBeenCalledTimes(3);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('🎉 Success!'),
    );

    consoleLogSpy.mockRestore();
  });
});
