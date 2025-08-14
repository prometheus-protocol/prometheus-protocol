import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerListVersionsCommand } from '../src/commands/list-versions.js';
import * as api from '@prometheus-protocol/ic-js';
import * as utils from '../src/utils.js';

vi.mock('@prometheus-protocol/ic-js');
vi.mock('../src/utils.js');

describe('list-versions command', () => {
  let program: Command;
  const namespace = 'com.test.app';
  const mockVersions = [
    {
      version: '1.0.1',
      description: 'Bug fixes',
      dateAdded: new Date(),
      isDeprecated: false,
    },
    {
      version: '1.0.0',
      description: 'Initial release',
      dateAdded: new Date(),
      isDeprecated: true,
    },
  ];

  beforeEach(() => {
    program = new Command();
    registerListVersionsCommand(program);
    vi.clearAllMocks();

    vi.mocked(api.getVersions).mockResolvedValue(mockVersions);
    vi.mocked(utils.loadDfxIdentity).mockReturnValue({} as any);
  });

  it('should call the API and display the results in a table', async () => {
    const consoleTableSpy = vi
      .spyOn(console, 'table')
      .mockImplementation(() => {});
    const cliArgs = ['list-versions', '--namespace', namespace];
    await program.parseAsync(cliArgs, { from: 'user' });

    expect(api.getVersions).toHaveBeenCalledOnce();
    expect(api.getVersions).toHaveBeenCalledWith(expect.anything(), namespace);
    expect(consoleTableSpy).toHaveBeenCalledOnce();
    expect(consoleTableSpy).toHaveBeenCalledWith(mockVersions);

    consoleTableSpy.mockRestore();
  });
});
