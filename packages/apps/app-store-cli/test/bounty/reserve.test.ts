// packages/cli/test/commands/bounty/reserve.command.test.ts

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  MockInstance,
} from 'vitest';
import { Command } from 'commander';
import prompts from 'prompts';
import * as api from '@prometheus-protocol/ic-js';
import { registerBountyCommands } from '../../src/commands/bounty/bounty.commands.js';
import * as identityApi from '../../src/identity.node.js';

// Mock all external dependencies
vi.mock('prompts');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../../src/identity.node.js');

describe('bounty reserve command', () => {
  let program: Command;
  const MOCK_BOUNTY_ID = 123n;
  const MOCK_AUDIT_TYPE = 'security_v1';
  const MOCK_STAKE_AMOUNT = 100n;

  let consoleLogSpy: MockInstance;
  let consoleErrorSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    registerBountyCommands(program);

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(identityApi.getCurrentIdentityName).mockReturnValue('default');
    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue({} as any);

    vi.mocked(api.getBounty).mockResolvedValue({
      bountyId: MOCK_BOUNTY_ID,
      challengeParameters: {
        Map: [['audit_type', { Text: MOCK_AUDIT_TYPE }]],
      },
    } as any);

    vi.mocked(api.getStakeRequirement).mockResolvedValue(MOCK_STAKE_AMOUNT);
    vi.mocked(api.reserveBounty).mockResolvedValue(undefined);
    vi.mocked(prompts).mockResolvedValue({ confirm: true }); // <-- CHANGE: Mock prompts
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  const cliArgs = ['bounty', 'reserve', MOCK_BOUNTY_ID.toString()];

  it('should successfully reserve a bounty when the user confirms', async () => {
    await program.parseAsync(cliArgs, { from: 'user' });

    expect(api.getBounty).toHaveBeenCalledWith(MOCK_BOUNTY_ID);
    expect(api.getStakeRequirement).toHaveBeenCalledWith(MOCK_AUDIT_TYPE);
    expect(prompts).toHaveBeenCalledOnce();
    expect(api.reserveBounty).toHaveBeenCalledOnce();
    const [_, callArgs] = vi.mocked(api.reserveBounty).mock.calls[0];
    expect(callArgs.bounty_id).toBe(MOCK_BOUNTY_ID);
    expect(callArgs.token_id).toBe(MOCK_AUDIT_TYPE);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Success!'),
    );
  });

  it('should NOT reserve the bounty if the user cancels the prompt', async () => {
    vi.mocked(prompts).mockResolvedValue({ confirm: false }); // <-- CHANGE: Mock prompts
    await program.parseAsync(cliArgs, { from: 'user' });

    expect(api.getBounty).toHaveBeenCalledOnce();
    expect(api.getStakeRequirement).toHaveBeenCalledOnce();
    expect(api.reserveBounty).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Operation cancelled by user'),
    );
  });

  it('should fail gracefully if the bounty is not found', async () => {
    vi.mocked(api.getBounty).mockResolvedValue(undefined);
    await program.parseAsync(cliArgs, { from: 'user' });

    expect(api.reserveBounty).not.toHaveBeenCalled();

    // --- FIX: Assert the two separate console.error calls ---
    expect(consoleErrorSpy.mock.calls[0][0]).toContain('Operation failed');
    expect(consoleErrorSpy.mock.calls[1][0].message).toContain('not found');
  });

  it('should fail if no stake requirement is configured for the audit type', async () => {
    vi.mocked(api.getStakeRequirement).mockResolvedValue(undefined);
    await program.parseAsync(cliArgs, { from: 'user' });

    expect(api.reserveBounty).not.toHaveBeenCalled();

    // --- FIX: Assert the two separate console.error calls ---
    expect(consoleErrorSpy.mock.calls[0][0]).toContain('Operation failed');
    expect(consoleErrorSpy.mock.calls[1][0].message).toContain(
      'No stake requirement is configured',
    );
  });
});
