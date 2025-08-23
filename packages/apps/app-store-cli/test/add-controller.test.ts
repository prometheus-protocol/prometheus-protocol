import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import yaml from 'js-yaml';
import { Command } from 'commander';
import { registerAddControllerCommand } from '../src/commands/add-controller.js';
import * as api from '@prometheus-protocol/ic-js';
import * as identityApi from '../src/identity.node.js';

vi.mock('node:fs');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../src/identity.node.js');

describe('add-controller command', () => {
  let program: Command;
  const operatorPrincipal = 'bkyz2-fmaaa-aaaaa-qaaaq-cai';

  beforeEach(() => {
    program = new Command();
    registerAddControllerCommand(program);
    vi.clearAllMocks();

    vi.mocked(api.addController).mockResolvedValue(undefined);
    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue({} as any);

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      yaml.dump({ namespace: 'com.test.app' }),
    );
  });

  it('should call the API with the correct namespace and principal', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const cliArgs = ['add-controller', '--principal', operatorPrincipal];
    await program.parseAsync(cliArgs, { from: 'user' });

    expect(api.addController).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(api.addController).mock.calls[0][1];
    expect(callArgs.namespace).toBe('com.test.app');
    expect(callArgs.controller).toBe(operatorPrincipal);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Successfully added controller'),
    );

    consoleLogSpy.mockRestore();
  });
});
