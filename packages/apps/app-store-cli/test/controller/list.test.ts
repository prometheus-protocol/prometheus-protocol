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

describe('controller list command', () => {
  let program: Command;
  const mockControllers = [
    'aaaaa-aaaaa-aaaaa-aaaaa-aaa',
    'bbbbb-bbbbb-bbbbb-bbbbb-bbb',
  ];
  const yamlNamespace = 'com.test.from-yaml';

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create a fresh commander instance for each test
    program = new Command();
    registerControllerCommands(program);

    // Mock the identity loading for all tests
    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue({} as any);
  });

  // Test Case 1: Admin workflow (explicit namespace)
  it('should list controllers using an explicitly provided namespace', async () => {
    // Arrange
    vi.mocked(api.getControllers).mockResolvedValue(mockControllers);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const explicitNamespace = 'com.test.explicit';

    // Act
    const cliArgs = ['controller', 'list', explicitNamespace];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.getControllers).toHaveBeenCalledOnce();
    expect(api.getControllers).toHaveBeenCalledWith(
      expect.anything(),
      explicitNamespace,
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(mockControllers[0]),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(mockControllers[1]),
    );

    consoleLogSpy.mockRestore();
  });

  // Test Case 2: Developer workflow (using prometheus.yml)
  it('should list controllers using the namespace from prometheus.yml', async () => {
    // Arrange
    vi.mocked(api.getControllers).mockResolvedValue(mockControllers);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      yaml.dump({ namespace: yamlNamespace }),
    );
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Act: No namespace is provided in the arguments
    const cliArgs = ['controller', 'list'];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(fs.readFileSync).toHaveBeenCalledOnce();
    expect(api.getControllers).toHaveBeenCalledOnce();
    expect(api.getControllers).toHaveBeenCalledWith(
      expect.anything(),
      yamlNamespace,
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(mockControllers[0]),
    );

    consoleLogSpy.mockRestore();
  });

  // Test Case 3: Empty list workflow
  it('should display a message when no controllers are found', async () => {
    // Arrange: Mock the API to return an empty array
    vi.mocked(api.getControllers).mockResolvedValue([]);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const explicitNamespace = 'com.test.empty';

    // Act
    const cliArgs = ['controller', 'list', explicitNamespace];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.getControllers).toHaveBeenCalledOnce();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('No controllers found'),
    );

    consoleLogSpy.mockRestore();
  });

  // Test Case 4: Failure workflow (no context)
  it('should fail gracefully if no namespace is provided and prometheus.yml is not found', async () => {
    // Arrange
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Act
    const cliArgs = ['controller', 'list'];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.getControllers).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Namespace not provided and prometheus.yml not found',
      ),
    );

    consoleErrorSpy.mockRestore();
  });
});
