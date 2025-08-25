import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import * as api from '@prometheus-protocol/ic-js';
import * as identityApi from '../../src/identity.node.js';
import { registerDaoCommands } from '../../src/commands/dao/dao.commands.js';

// Mock all external dependencies
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../../src/identity.node.js'); // Adjust path if needed

describe('dao list command', () => {
  let program: Command;

  // A mock submission object matching the PendingSubmission type from ic-js
  const mockSubmission = {
    wasm_id: 'a1b2c3d4e5f6a1b2c3d4e5f6',
    repo_url: 'https://github.com/test/repo',
    commit_hash: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
    attestation_types: ['security_v1', 'build_reproducibility_v1'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    registerDaoCommands(program);

    // Mock dependencies for a happy path
    vi.mocked(api.listPendingSubmissions).mockResolvedValue([mockSubmission]);
    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue({} as any);
    vi.mocked(identityApi.getCurrentIdentityName).mockReturnValue('test-user');
  });

  it('should fetch submissions and display them in a table', async () => {
    // Arrange
    const consoleTableSpy = vi
      .spyOn(console, 'table')
      .mockImplementation(() => {});

    // Act
    await program.parseAsync(['dao', 'list'], { from: 'user' });

    // Assert
    expect(api.listPendingSubmissions).toHaveBeenCalledOnce();
    expect(consoleTableSpy).toHaveBeenCalledOnce();

    // Check the content passed to the table to ensure it's formatted correctly
    const tableData = consoleTableSpy.mock.calls[0][0];
    expect(tableData[0]).toEqual({
      'WASM ID': 'a1b2c3d4e5f6a1b2c3d4e5f6',
      'Repo URL': 'https://github.com/test/repo',
      'Commit Hash (hex)': 'deadbeef',
      'Completed Audits': 'security_v1, build_reproducibility_v1',
    });

    consoleTableSpy.mockRestore();
  });

  it('should pass pagination options to the API call', async () => {
    // Arrange
    const cliArgs = [
      'dao',
      'list',
      '--limit',
      '50',
      '--prev',
      'prev_wasm_id_123',
    ];

    // Act
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.listPendingSubmissions).toHaveBeenCalledOnce();
    const apiCallArgs = vi.mocked(api.listPendingSubmissions).mock.calls[0][1];

    // Verify pagination options are correctly parsed and passed
    expect(apiCallArgs.take).toBe(50n);
    expect(apiCallArgs.prev).toBe('prev_wasm_id_123');
  });

  it('should display a message if no submissions are found', async () => {
    // Arrange
    vi.mocked(api.listPendingSubmissions).mockResolvedValue([]); // Mock an empty response
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleTableSpy = vi
      .spyOn(console, 'table')
      .mockImplementation(() => {});

    // Act
    await program.parseAsync(['dao', 'list'], { from: 'user' });

    // Assert
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('No submissions are currently awaiting review.'),
    );
    expect(consoleTableSpy).not.toHaveBeenCalled();

    consoleLogSpy.mockRestore();
    consoleTableSpy.mockRestore();
  });

  it('should handle API errors gracefully', async () => {
    // Arrange
    const apiError = new Error('Network connection failed');
    vi.mocked(api.listPendingSubmissions).mockRejectedValue(apiError);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Act
    await program.parseAsync(['dao', 'list'], { from: 'user' });

    // Assert
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '\n❌ Operation failed:',
      apiError,
    );

    consoleErrorSpy.mockRestore();
  });
});
