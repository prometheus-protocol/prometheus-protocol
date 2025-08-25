import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import yaml from 'js-yaml';
import { Command } from 'commander';
// We now import the "group" registration function to mimic the real CLI structure
import { registerControllerCommands } from '../../src/commands/controller/controller.commands.js';
import * as api from '@prometheus-protocol/ic-js';
import * as identityApi from '../../src/identity.node.js';

// Mock the modules
vi.mock('node:fs');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../../src/identity.node.js'); // Adjusted path based on file location

describe('controller add command', () => {
  let program: Command;
  const operatorPrincipal = 'bkyz2-fmaaa-aaaaa-qaaaq-cai';
  const yamlNamespace = 'com.test.app';

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create a fresh commander instance for each test
    program = new Command();
    // Register the entire 'controller' command group to accurately test subcommands
    registerControllerCommands(program);

    // Mock the successful API call and identity loading
    vi.mocked(api.addController).mockResolvedValue(undefined);
    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue({} as any);
  });

  // Test Case 1: Developer workflow (using prometheus.yml)
  it('should add a controller using the namespace from prometheus.yml', async () => {
    // Arrange: Mock the file system to find the config file
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      yaml.dump({ namespace: yamlNamespace }),
    );
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Act: Parse the new command structure
    const cliArgs = ['controller', 'add', operatorPrincipal];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert: Check that the API was called with the correct data
    expect(api.addController).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(api.addController).mock.calls[0][1];
    expect(callArgs.namespace).toBe(yamlNamespace);
    expect(callArgs.controller).toBe(operatorPrincipal);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Successfully added controller'),
    );

    consoleLogSpy.mockRestore();
  });

  // Test Case 2: Admin workflow (providing namespace explicitly)
  it('should add a controller using an explicitly provided namespace', async () => {
    // Arrange
    const explicitNamespace = 'com.test.app';
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Act: Parse the command with the optional namespace argument
    const cliArgs = ['controller', 'add', operatorPrincipal, explicitNamespace];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.addController).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(api.addController).mock.calls[0][1];
    expect(callArgs.namespace).toBe(explicitNamespace); // Should use the explicit namespace
    expect(callArgs.controller).toBe(operatorPrincipal);

    // Crucially, it should NOT have tried to read the config file
    expect(fs.readFileSync).not.toHaveBeenCalled();

    consoleLogSpy.mockRestore();
  });

  // Test Case 3: Failure workflow (no context)
  it('should fail gracefully if no namespace is provided and prometheus.yml is not found', async () => {
    // Arrange: Mock the file system to NOT find the config file
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Act: Parse the command without the optional namespace
    const cliArgs = ['controller', 'add', operatorPrincipal];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert: The API should never be called
    expect(api.addController).not.toHaveBeenCalled();

    // It should have logged a helpful error message
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Namespace not provided and prometheus.yml not found',
      ),
    );

    consoleErrorSpy.mockRestore();
  });
});
