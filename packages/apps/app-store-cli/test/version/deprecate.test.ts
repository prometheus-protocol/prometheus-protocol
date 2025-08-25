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

describe('version deprecate command', () => {
  let program: Command;
  const version = '1.0.0';
  const reason = 'Critical security vulnerability found.';
  const yamlNamespace = 'com.test.from-yaml';

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    // 2. Register the entire 'version' command group
    registerVersionCommands(program);

    // Mock the API call and identity for happy paths
    vi.mocked(api.setDeprecationStatus).mockResolvedValue(undefined);
    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue({} as any);
  });

  // Test Case 1: Admin workflow (explicit namespace)
  it('should deprecate a version using an explicitly provided namespace', async () => {
    // Arrange
    const explicitNamespace = 'com.test.explicit';
    // 3. Use the new positional argument structure
    const cliArgs = [
      'version',
      'deprecate',
      version,
      explicitNamespace,
      '--reason',
      reason,
    ];

    // Act
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.setDeprecationStatus).toHaveBeenCalledOnce();
    expect(api.setDeprecationStatus).toHaveBeenCalledWith(expect.anything(), {
      namespace: explicitNamespace,
      version,
      deprecate: true,
      reason,
    });
    // Crucially, it should NOT have tried to read the config file
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });

  // Test Case 2: Developer workflow (using prometheus.yml)
  it('should deprecate a version using the namespace from prometheus.yml', async () => {
    // Arrange
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      yaml.dump({ namespace: yamlNamespace }),
    );
    const cliArgs = ['version', 'deprecate', version, '--reason', reason];

    // Act
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.setDeprecationStatus).toHaveBeenCalledOnce();
    expect(api.setDeprecationStatus).toHaveBeenCalledWith(expect.anything(), {
      namespace: yamlNamespace,
      version,
      deprecate: true,
      reason,
    });
  });

  // Test Case 3: Undo functionality
  it('should un-deprecate a version when --undo is passed', async () => {
    // Arrange (using the simpler explicit namespace path for this test)
    const explicitNamespace = 'com.test.explicit';
    const cliArgs = [
      'version',
      'deprecate',
      version,
      explicitNamespace,
      '--reason',
      'Mistake',
      '--undo',
    ];

    // Act
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.setDeprecationStatus).toHaveBeenCalledOnce();
    expect(api.setDeprecationStatus).toHaveBeenCalledWith(expect.anything(), {
      namespace: explicitNamespace,
      version,
      deprecate: false, // The key assertion
      reason: 'Mistake',
    });
  });

  // Test Case 4: Failure workflow (no context)
  it('should fail gracefully if no namespace is provided and prometheus.yml is not found', async () => {
    // Arrange
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const cliArgs = ['version', 'deprecate', version, '--reason', reason];

    // Act
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.setDeprecationStatus).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Namespace not provided and prometheus.yml not found',
      ),
    );
    consoleErrorSpy.mockRestore();
  });
});
