import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import yaml from 'js-yaml';
import { Command } from 'commander';
// 1. Import the group registration function
import { registerVersionCommands } from '../../src/commands/version/version.commands.js';
import * as api from '@prometheus-protocol/ic-js';
import * as identityApi from '../../src/identity.node.js';

// Mock all external dependencies
vi.mock('node:fs');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../../src/identity.node.js'); // Adjust path if needed

describe('version list command', () => {
  let program: Command;
  const mockVersions = [
    {
      version: '1.0.0',
      wasm_hash: 'abcd1234',
      description: 'Initial release',
      date_added: new Date('2023-01-01'),
      is_deprecated: false,
    },
    {
      version: '1.1.0',
      wasm_hash: 'efgh5678',
      description: 'Minor improvements and bug fixes',
      date_added: new Date('2023-02-01'),
      is_deprecated: false,
    },
  ];
  const yamlNamespace = 'com.test.from-yaml';

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    // 2. Register the entire 'version' command group
    registerVersionCommands(program);

    // Mock identity for all tests
    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue({} as any);
  });

  // Test Case 1: Admin workflow (explicit namespace)
  it('should list versions using an explicitly provided namespace', async () => {
    // Arrange
    vi.mocked(api.getVersions).mockResolvedValue(mockVersions);
    const consoleTableSpy = vi
      .spyOn(console, 'table')
      .mockImplementation(() => {});
    const explicitNamespace = 'com.test.explicit';

    // Act: Use the new positional argument structure
    const cliArgs = ['version', 'list', explicitNamespace];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.getVersions).toHaveBeenCalledOnce();
    expect(api.getVersions).toHaveBeenCalledWith(
      expect.anything(),
      explicitNamespace,
    );
    expect(consoleTableSpy).toHaveBeenCalledOnce();
    expect(consoleTableSpy).toHaveBeenCalledWith(mockVersions);

    consoleTableSpy.mockRestore();
  });

  // Test Case 2: Developer workflow (using prometheus.yml)
  it('should list versions using the namespace from prometheus.yml', async () => {
    // Arrange
    vi.mocked(api.getVersions).mockResolvedValue(mockVersions);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      yaml.dump({ namespace: yamlNamespace }),
    );
    const consoleTableSpy = vi
      .spyOn(console, 'table')
      .mockImplementation(() => {});

    // Act: No namespace is provided in the arguments
    const cliArgs = ['version', 'list'];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.getVersions).toHaveBeenCalledOnce();
    expect(api.getVersions).toHaveBeenCalledWith(
      expect.anything(),
      yamlNamespace,
    );
    expect(consoleTableSpy).toHaveBeenCalledWith(mockVersions);

    consoleTableSpy.mockRestore();
  });

  // Test Case 3: Empty list workflow
  it('should display a message when no versions are found', async () => {
    // Arrange: Mock the API to return an empty array
    vi.mocked(api.getVersions).mockResolvedValue([]);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleTableSpy = vi
      .spyOn(console, 'table')
      .mockImplementation(() => {});
    const explicitNamespace = 'com.test.empty';

    // Act
    const cliArgs = ['version', 'list', explicitNamespace];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.getVersions).toHaveBeenCalledOnce();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('No versions found'),
    );
    expect(consoleTableSpy).not.toHaveBeenCalled(); // Ensure table is not printed for empty results

    consoleLogSpy.mockRestore();
    consoleTableSpy.mockRestore();
  });

  // Test Case 4: Failure workflow (no context)
  it('should fail gracefully if no namespace is provided and prometheus.yml is not found', async () => {
    // Arrange
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Act
    const cliArgs = ['version', 'list'];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.getVersions).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Namespace not provided and prometheus.yml not found',
      ),
    );

    consoleErrorSpy.mockRestore();
  });
});
