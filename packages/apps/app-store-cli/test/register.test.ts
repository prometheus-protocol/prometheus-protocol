import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerRegisterCommand } from '../src/commands/register.js';
import * as api from '@prometheus-protocol/ic-js';

vi.mock('@prometheus-protocol/ic-js');

describe('register command', () => {
  let program: Command;
  const canisterId = 'rrkah-fqaaa-aaaaa-aaaaq-cai';
  const namespace = 'com.test.app';

  beforeEach(() => {
    program = new Command();
    registerRegisterCommand(program);
    vi.clearAllMocks();

    vi.mocked(api.registerCanister).mockResolvedValue(undefined);
    vi.mocked(api.loadDfxIdentity).mockReturnValue({} as any);
  });

  it('should call the API with the correct canister ID and namespace', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const cliArgs = [
      'register',
      '--canister',
      canisterId,
      '--namespace',
      namespace,
    ];
    await program.parseAsync(cliArgs, { from: 'user' });

    expect(api.registerCanister).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(api.registerCanister).mock.calls[0][1];
    expect(callArgs.canister_id).toBe(canisterId);
    expect(callArgs.namespace).toBe(namespace);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Success! Canister'),
    );

    consoleLogSpy.mockRestore();
  });
});
