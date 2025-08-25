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

describe('canister register command', () => {
  let program: Command;
  const canisterId = 'rrkah-fqaaa-aaaaa-aaaaq-cai';
  const yamlNamespace = 'com.test.from-yaml';

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    // 2. Register the entire 'canister' command group
    registerCanisterCommands(program);

    // Mock the API call and identity for happy paths
    vi.mocked(api.registerCanister).mockResolvedValue(undefined);
    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue({} as any);
  });

  // Test Case 1: Operator workflow (explicit namespace)
  it('should register a canister using an explicitly provided namespace', async () => {
    // Arrange
    const explicitNamespace = 'com.test.explicit';
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    // 3. Use the new positional argument structure
    const cliArgs = ['canister', 'register', canisterId, explicitNamespace];

    // Act
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.registerCanister).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(api.registerCanister).mock.calls[0][1];
    expect(callArgs.canister_id).toBe(canisterId);
    expect(callArgs.namespace).toBe(explicitNamespace);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Success!'),
    );
    // Crucially, it should NOT have tried to read the config file
    expect(fs.readFileSync).not.toHaveBeenCalled();

    consoleLogSpy.mockRestore();
  });

  // Test Case 2: Developer workflow (using prometheus.yml)
  it('should register a canister using the namespace from prometheus.yml', async () => {
    // Arrange
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      yaml.dump({ namespace: yamlNamespace }),
    );
    const cliArgs = ['canister', 'register', canisterId];

    // Act
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.registerCanister).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(api.registerCanister).mock.calls[0][1];
    expect(callArgs.canister_id).toBe(canisterId);
    expect(callArgs.namespace).toBe(yamlNamespace);
  });

  // Test Case 3: Failure workflow (no context)
  it('should fail gracefully if no namespace is provided and prometheus.yml is not found', async () => {
    // Arrange
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const cliArgs = ['canister', 'register', canisterId];

    // Act
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.registerCanister).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Namespace not provided and prometheus.yml not found',
      ),
    );
    consoleErrorSpy.mockRestore();
  });
});
