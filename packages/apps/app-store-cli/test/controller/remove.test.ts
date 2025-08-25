import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import yaml from 'js-yaml';
import { Command } from 'commander';
import * as api from '@prometheus-protocol/ic-js';
import * as identityApi from '../../src/identity.node.js';
import { registerControllerCommands } from '../../src/commands/controller/controller.commands.js';

// Mock the modules
vi.mock('node:fs');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../../src/identity.node.js'); // Adjust path if needed

describe('controller remove command', () => {
  let program: Command;
  const operatorPrincipal = 'bkyz2-fmaaa-aaaaa-qaaaq-cai';
  const yamlNamespace = 'com.test.from-yaml';

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create a fresh commander instance for each test
    program = new Command();
    registerControllerCommands(program);

    // Mock the successful API call and identity loading for success paths
    vi.mocked(api.removeController).mockResolvedValue(undefined);
    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue({} as any);
  });

  // Test Case 1: Developer workflow (using prometheus.yml)
  it('should remove a controller using the namespace from prometheus.yml', async () => {
    // Arrange
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      yaml.dump({ namespace: yamlNamespace }),
    );
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Act: Use the new positional argument structure
    const cliArgs = ['controller', 'remove', operatorPrincipal];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.removeController).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(api.removeController).mock.calls[0][1];
    expect(callArgs.namespace).toBe(yamlNamespace);
    expect(callArgs.controller).toBe(operatorPrincipal);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Successfully removed controller'),
    );

    consoleLogSpy.mockRestore();
  });

  // Test Case 2: Admin workflow (explicit namespace)
  it('should remove a controller using an explicitly provided namespace', async () => {
    // Arrange
    const explicitNamespace = 'com.test.explicit';
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Act
    const cliArgs = [
      'controller',
      'remove',
      operatorPrincipal,
      explicitNamespace,
    ];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.removeController).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(api.removeController).mock.calls[0][1];
    expect(callArgs.namespace).toBe(explicitNamespace);
    expect(callArgs.controller).toBe(operatorPrincipal);

    // Crucially, it should NOT have tried to read the config file
    expect(fs.readFileSync).not.toHaveBeenCalled();

    consoleLogSpy.mockRestore();
  });

  // Test Case 3: Failure workflow (no context)
  it('should fail gracefully if no namespace is provided and prometheus.yml is not found', async () => {
    // Arrange
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Act
    const cliArgs = ['controller', 'remove', operatorPrincipal];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.removeController).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Namespace not provided and prometheus.yml not found',
      ),
    );

    consoleErrorSpy.mockRestore();
  });
});
