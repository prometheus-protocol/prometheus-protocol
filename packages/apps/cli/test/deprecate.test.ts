import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerDeprecateCommand } from '../src/commands/deprecate.js';
import * as api from '@prometheus-protocol/ic-js';
import * as utils from '../src/utils.js';

vi.mock('@prometheus-protocol/ic-js');
vi.mock('../src/utils.js');

describe('deprecate command', () => {
  let program: Command;
  const namespace = 'com.test.app';
  const version = '1.0.0';
  const reason = 'Critical security vulnerability found.';

  beforeEach(() => {
    program = new Command();
    registerDeprecateCommand(program);
    vi.clearAllMocks();

    // Mock the API call, we don't need to test the internal hash lookup here
    vi.mocked(api.setDeprecationStatus).mockResolvedValue(undefined);
    vi.mocked(utils.loadDfxIdentity).mockReturnValue({} as any);
  });

  it('should call the API to deprecate a version with a reason', async () => {
    const cliArgs = [
      'deprecate',
      '--namespace',
      namespace,
      '--version',
      version,
      '--reason',
      reason,
    ];
    await program.parseAsync(cliArgs, { from: 'user' });

    expect(api.setDeprecationStatus).toHaveBeenCalledOnce();
    expect(api.setDeprecationStatus).toHaveBeenCalledWith(expect.anything(), {
      namespace,
      version,
      deprecate: true,
      reason,
    });
  });

  it('should call the API to un-deprecate a version when --undo is passed', async () => {
    const cliArgs = [
      'deprecate',
      '--namespace',
      namespace,
      '--version',
      version,
      '--reason',
      'Mistake',
      '--undo',
    ];
    await program.parseAsync(cliArgs, { from: 'user' });

    expect(api.setDeprecationStatus).toHaveBeenCalledOnce();
    expect(api.setDeprecationStatus).toHaveBeenCalledWith(expect.anything(), {
      namespace,
      version,
      deprecate: false,
      reason: 'Mistake',
    });
  });
});
