import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerListControllersCommand } from '../src/commands/list-controllers.js';
import * as api from '@prometheus-protocol/ic-js';
import * as identityApi from '../src/identity.node.js';

vi.mock('@prometheus-protocol/ic-js');
vi.mock('../src/identity.node.js');

describe('list-controllers command', () => {
  let program: Command;
  const namespace = 'com.test.app';
  const mockControllers = [
    'aaaaa-aaaaa-aaaaa-aaaaa-aaa',
    'bbbbb-bbbbb-bbbbb-bbbbb-bbb',
  ];

  beforeEach(() => {
    program = new Command();
    registerListControllersCommand(program);
    vi.clearAllMocks();

    vi.mocked(api.getControllers).mockResolvedValue(mockControllers);
    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue({} as any);
  });

  it('should call the API and display the list of controllers', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const cliArgs = ['list-controllers', '--namespace', namespace];
    await program.parseAsync(cliArgs, { from: 'user' });

    expect(api.getControllers).toHaveBeenCalledOnce();
    expect(api.getControllers).toHaveBeenCalledWith(
      expect.anything(),
      namespace,
    );

    // Check that each controller was printed
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(mockControllers[0]),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(mockControllers[1]),
    );

    consoleLogSpy.mockRestore();
  });
});
