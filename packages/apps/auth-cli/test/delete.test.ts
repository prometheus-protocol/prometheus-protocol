import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import prompts from 'prompts';

// --- 1. Import the command and the mocked library ---
import { registerDeleteCommand } from '../src/commands/delete.js';
import * as api from '@prometheus-protocol/ic-js';

// --- 2. Mock the external dependencies ---
// Mock the prompts library to prevent it from actually asking for user input.
vi.mock('prompts');
// Mock our entire service layer.
vi.mock('@prometheus-protocol/ic-js');

describe('delete command', () => {
  let program: Command;

  // --- 3. Prepare mock data ---
  const mockIdentity = {} as any; // A placeholder identity object
  const mockServers = [
    {
      name: 'Test Server Alpha',
      resource_server_id: 'alpha-server-id',
      // Add other properties as needed by the type
    },
    {
      name: 'Test Server Bravo',
      resource_server_id: 'bravo-server-id',
    },
  ];

  beforeEach(() => {
    // Reset and set up the commander instance for each test
    program = new Command();
    registerDeleteCommand(program);
    // Ensure mocks are clean before each run
    vi.clearAllMocks();

    // --- 4. Set up default mock implementations ---
    vi.mocked(api.loadDfxIdentity).mockReturnValue(mockIdentity);
    vi.mocked(api.listMyResourceServers).mockResolvedValue(mockServers as any);
    vi.mocked(api.deleteResourceServer).mockResolvedValue({ ok: 'Deleted' });
  });

  it('should list servers, prompt the user, and delete the selected server on confirmation', async () => {
    // ARRANGE: Simulate the user selecting the first server and confirming 'yes'
    vi.mocked(prompts)
      .mockResolvedValueOnce({ serverToManageId: 'alpha-server-id' }) // First prompt
      .mockResolvedValueOnce({ confirmDelete: true }); // Second prompt

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // ACT: Run the command
    await program.parseAsync(['delete'], { from: 'user' });

    // ASSERT
    expect(api.listMyResourceServers).toHaveBeenCalledOnce();
    expect(prompts).toHaveBeenCalledTimes(2); // Was asked to select AND confirm
    expect(api.deleteResourceServer).toHaveBeenCalledOnce();
    expect(api.deleteResourceServer).toHaveBeenCalledWith(
      mockIdentity,
      'alpha-server-id',
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Server successfully deleted'),
    );

    consoleLogSpy.mockRestore();
  });

  it('should NOT delete the server if the user cancels the confirmation', async () => {
    // ARRANGE: Simulate the user selecting a server but then confirming 'no'
    vi.mocked(prompts)
      .mockResolvedValueOnce({ serverToManageId: 'bravo-server-id' })
      .mockResolvedValueOnce({ confirmDelete: false }); // User cancels

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // ACT
    await program.parseAsync(['delete'], { from: 'user' });

    // ASSERT
    expect(api.listMyResourceServers).toHaveBeenCalledOnce();
    expect(prompts).toHaveBeenCalledTimes(2);
    // The most important assertion: the delete function was never called
    expect(api.deleteResourceServer).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Delete operation cancelled'),
    );

    consoleLogSpy.mockRestore();
  });

  it('should inform the user and exit if no servers are registered', async () => {
    // ARRANGE: Override the default mock to return an empty array
    vi.mocked(api.listMyResourceServers).mockResolvedValue([]);

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // ACT
    await program.parseAsync(['delete'], { from: 'user' });

    // ASSERT
    expect(api.listMyResourceServers).toHaveBeenCalledOnce();
    // The most important assertion: the user was never prompted
    expect(prompts).not.toHaveBeenCalled();
    expect(api.deleteResourceServer).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'You have no resource servers to delete.',
    );

    consoleLogSpy.mockRestore();
  });
});
