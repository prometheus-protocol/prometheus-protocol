import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { Principal } from '@icp-sdk/core/principal';
// 1. Import the group registration function for the command under test
import { registerLeaderboardCommands } from '../../src/commands/leaderboard/leaderboard.commands.js';
import * as api from '@prometheus-protocol/ic-js';

// --- Mock external dependencies ---

// Mock the API layer
vi.mock('@prometheus-protocol/ic-js');

// Mock the console-table-printer library to spy on its methods
const mockPrintTable = vi.fn();
vi.mock('console-table-printer', () => ({
  // This mock simulates `new Table()` returning an object with a `printTable` method
  Table: vi.fn().mockImplementation(() => ({
    addRows: vi.fn(),
    printTable: mockPrintTable,
  })),
}));

describe('leaderboard list command', () => {
  let program: Command;

  // --- Mock Data ---
  const mockUserLeaderboard = [
    {
      rank: 1n,
      user: Principal.fromUint8Array(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])),
      total_invocations: 12345n,
    },
    {
      rank: 2n,
      user: Principal.fromUint8Array(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 9])),
      total_invocations: 9876n,
    },
  ];

  const mockServerLeaderboard = [
    {
      rank: 1n,
      server: Principal.fromUint8Array(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])),
      total_invocations: 54321n,
    },
  ];

  beforeEach(() => {
    // Reset all mocks before each test to ensure isolation
    vi.clearAllMocks();
    program = new Command();
    // 2. Register the 'leaderboard' command group
    registerLeaderboardCommands(program);
  });

  // Test Case 1: Success - Listing Users
  it('should fetch and display the user leaderboard when type is "users"', async () => {
    // Arrange
    vi.mocked(api.getUserLeaderboard).mockResolvedValue(mockUserLeaderboard);

    // Act: Simulate running `leaderboard list users`
    const cliArgs = ['leaderboard', 'list', 'users'];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.getUserLeaderboard).toHaveBeenCalledOnce();
    expect(api.getServerLeaderboard).not.toHaveBeenCalled();
    expect(mockPrintTable).toHaveBeenCalledOnce();
  });

  // Test Case 2: Success - Listing Servers
  it('should fetch and display the server leaderboard when type is "servers"', async () => {
    // Arrange
    vi.mocked(api.getServerLeaderboard).mockResolvedValue(
      mockServerLeaderboard,
    );

    // Act: Simulate running `leaderboard list servers`
    const cliArgs = ['leaderboard', 'list', 'servers'];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.getServerLeaderboard).toHaveBeenCalledOnce();
    expect(api.getUserLeaderboard).not.toHaveBeenCalled();
    expect(mockPrintTable).toHaveBeenCalledOnce();
  });

  // Test Case 3: Failure - Invalid Type
  it('should display an error message for an invalid type', async () => {
    // Arrange
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Act: Simulate running with a bad argument
    const cliArgs = ['leaderboard', 'list', 'invalid-type'];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.getUserLeaderboard).not.toHaveBeenCalled();
    expect(api.getServerLeaderboard).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid type specified'),
    );

    consoleErrorSpy.mockRestore();
  });

  // Test Case 4: Empty List Workflow
  it('should display a message when the user leaderboard is empty', async () => {
    // Arrange: Mock the API to return an empty array
    vi.mocked(api.getUserLeaderboard).mockResolvedValue([]);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Act
    const cliArgs = ['leaderboard', 'list', 'users'];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.getUserLeaderboard).toHaveBeenCalledOnce();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('is currently empty'),
    );
    // Ensure the table is not printed for empty results
    expect(mockPrintTable).not.toHaveBeenCalled();

    consoleLogSpy.mockRestore();
  });
});
