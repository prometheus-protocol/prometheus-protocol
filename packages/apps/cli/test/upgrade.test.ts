import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import yaml from 'js-yaml';
import { Command } from 'commander';
import { registerUpgradeCommand } from '../src/commands/upgrade.js';
import * as api from '@prometheus-protocol/ic-js';
import * as utils from '../src/utils.js';

vi.mock('node:fs');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../src/utils.js');

describe('upgrade command', () => {
  let program: Command;
  const mockWasmHash = new Uint8Array([1, 2, 3, 4]);

  beforeEach(() => {
    program = new Command();
    registerUpgradeCommand(program);
    vi.clearAllMocks();

    vi.mocked(api.getWasmHashForVersion).mockResolvedValue(mockWasmHash);
    vi.mocked(api.requestUpgrade).mockResolvedValue(undefined);
    vi.mocked(utils.loadDfxIdentity).mockReturnValue({} as any);

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      yaml.dump({ app: { id: 'com.test.app' } }),
    );
  });

  it('should resolve version to hash, then request upgrade', async () => {
    const cliArgs = [
      'upgrade',
      '--canister',
      'rrkah-fqaaa-aaaaa-aaaaq-cai',
      '--version',
      '1.2.3',
    ];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Verify step 1: resolving the version
    expect(api.getWasmHashForVersion).toHaveBeenCalledOnce();
    expect(vi.mocked(api.getWasmHashForVersion).mock.calls[0][1]).toEqual({
      namespace: 'com.test.app',
      version: '1.2.3',
    });

    // Verify step 2: requesting the upgrade with the resolved hash
    expect(api.requestUpgrade).toHaveBeenCalledOnce();
    expect(vi.mocked(api.requestUpgrade).mock.calls[0][1]).toEqual(
      expect.objectContaining({
        canister_id: 'rrkah-fqaaa-aaaaa-aaaaq-cai',
        wasm_hash: mockWasmHash,
      }),
    );
  });
});
