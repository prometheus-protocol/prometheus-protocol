import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import yaml from 'js-yaml';
import { Command } from 'commander';
// 1. Import the group registration function
import { registerCanisterCommands } from '../../src/commands/canister/canister.commands.js';
import * as api from '@prometheus-protocol/ic-js';
import * as identityApi from '../../src/identity.node.js';

// Mock all external dependencies
vi.mock('node:fs');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../../src/identity.node.js'); // Adjust path if needed

describe('canister upgrade command', () => {
  let program: Command;
  const mockWasmHash = new Uint8Array([1, 2, 3, 4]);
  const canisterId = 'rrkah-fqaaa-aaaaa-aaaaq-cai';
  const version = '1.2.3';
  const yamlNamespace = 'com.test.from-yaml';

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    // 2. Register the entire 'canister' command group
    registerCanisterCommands(program);

    // Mock the API calls and identity for happy paths
    vi.mocked(api.getWasmHashForVersion).mockResolvedValue(mockWasmHash);
    vi.mocked(api.requestUpgrade).mockResolvedValue(undefined);
    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue({} as any);
  });

  // Test Case 1: Operator workflow (explicit namespace)
  it('should upgrade using an explicitly provided namespace', async () => {
    // Arrange
    const explicitNamespace = 'com.test.explicit';
    // 3. Use the new positional argument structure
    const cliArgs = [
      'canister',
      'upgrade',
      canisterId,
      version,
      explicitNamespace,
    ];

    // Act
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.getWasmHashForVersion).toHaveBeenCalledOnce();
    expect(vi.mocked(api.getWasmHashForVersion).mock.calls[0][1]).toEqual({
      namespace: explicitNamespace,
      version,
    });
    expect(api.requestUpgrade).toHaveBeenCalledOnce();
    expect(vi.mocked(api.requestUpgrade).mock.calls[0][1]).toEqual(
      expect.objectContaining({
        canister_id: canisterId,
        wasm_hash: mockWasmHash,
      }),
    );
    // Crucially, it should NOT have tried to read the config file
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });

  // Test Case 2: Developer workflow (using prometheus.yml)
  it('should upgrade using the namespace from prometheus.yml', async () => {
    // Arrange
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      yaml.dump({ namespace: yamlNamespace }),
    );
    const cliArgs = ['canister', 'upgrade', canisterId, version];

    // Act
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.getWasmHashForVersion).toHaveBeenCalledOnce();
    expect(vi.mocked(api.getWasmHashForVersion).mock.calls[0][1]).toEqual({
      namespace: yamlNamespace,
      version,
    });
    expect(api.requestUpgrade).toHaveBeenCalledOnce();
  });

  // Test Case 3: Failure workflow (no context)
  it('should fail gracefully if no namespace is provided and prometheus.yml is not found', async () => {
    // Arrange
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const cliArgs = ['canister', 'upgrade', canisterId, version];

    // Act
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.getWasmHashForVersion).not.toHaveBeenCalled();
    expect(api.requestUpgrade).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Namespace not provided and prometheus.yml not found',
      ),
    );
    consoleErrorSpy.mockRestore();
  });

  // Test Case 4: Verifying options are passed correctly
  it('should pass optional arguments like --arg to the API call', async () => {
    // Arrange
    const hexArg = 'deadbeef';
    const cliArgs = [
      'canister',
      'upgrade',
      canisterId,
      version,
      yamlNamespace,
      '--arg',
      hexArg,
      '--mode',
      'reinstall',
    ];

    // Act
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.requestUpgrade).toHaveBeenCalledOnce();
    expect(vi.mocked(api.requestUpgrade).mock.calls[0][1]).toEqual(
      expect.objectContaining({
        arg: Buffer.from(hexArg, 'hex'),
        mode: 'reinstall',
      }),
    );
  });
});
