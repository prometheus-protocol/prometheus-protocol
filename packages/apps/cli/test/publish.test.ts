import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import yaml from 'js-yaml';
import { Command } from 'commander';
import { registerPublishCommand } from '../src/commands/publish.js';
import * as api from '@prometheus-protocol/ic-js';
import * as utils from '../src/utils.js';

// Mock all dependencies
vi.mock('node:fs');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../src/utils.js');

describe('publish command', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerPublishCommand(program);
    vi.clearAllMocks();

    vi.mocked(api.publishVersion).mockResolvedValue(undefined);
    vi.mocked(utils.loadDfxIdentity).mockReturnValue({} as any);

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (path.toString().endsWith('prometheus.yml')) {
        return yaml.dump({
          namespace: 'com.test.app',
          repo_url: 'https://github.com/test/repo',
          wasm_path: './test.wasm',
        });
      }
      if (path.toString().endsWith('test.wasm')) {
        return Buffer.from('mock wasm content');
      }
      return '';
    });
  });

  it('should call the API with the correct version and manifest data', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const cliArgs = ['publish', '--version', '1.2.3'];
    await program.parseAsync(cliArgs, { from: 'user' });

    expect(api.publishVersion).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(api.publishVersion).mock.calls[0][1];
    expect(callArgs.namespace).toBe('com.test.app');
    expect(callArgs.version).toBe('1.2.3');
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Successfully published version 1.2.3'),
    );

    consoleLogSpy.mockRestore();
  });

  it('should write an error and exit if --version option is not provided', async () => {
    const writeErrSpy = vi.fn();
    const processExitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    program.configureOutput({ writeErr: writeErrSpy });

    const cliArgs = ['publish'];
    await program.parseAsync(cliArgs, { from: 'user' });

    expect(writeErrSpy).toHaveBeenCalledOnce();
    expect(writeErrSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "required option '-v, --version <version>' not specified",
      ),
    );

    expect(processExitSpy).toHaveBeenCalledWith(1);

    processExitSpy.mockRestore();
  });
});
