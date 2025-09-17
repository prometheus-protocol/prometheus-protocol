import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

// --- 1. Import the command and the mocked library ---
import { registerListCommand } from '../src/commands/list.js';
import * as api from '@prometheus-protocol/ic-js';
import * as identityApi from '../src/identity.node.js';

// --- 2. Mock the external dependencies ---
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../src/identity.node.js');

describe('list command', () => {
  let program: Command;

  // --- 3. Prepare mock data ---
  const mockIdentity = {} as any; // A placeholder identity object
  const mockServers = [
    {
      name: 'Test Server Alpha',
      resource_server_id: 'alpha-server-id',
      uris: ['https://alpha.icp0.io'],
      scopes: [
        ['openid', '...'],
        ['prometheus:charge', '...'],
      ],
    },
    {
      name: 'Test Server Bravo',
      resource_server_id: 'bravo-server-id',
      uris: ['http://127.0.0.1:4943/?canisterId=bravo'],
      scopes: [['openid', '...']],
      frontend_host: ['https://bravo-frontend.example.com'],
    },
  ];

  beforeEach(() => {
    // Reset and set up the commander instance for each test
    program = new Command();
    registerListCommand(program);
    // Ensure mocks are clean before each run
    vi.clearAllMocks();

    // --- 4. Set up default mock implementations ---
    vi.mocked(identityApi.getCurrentIdentityName).mockReturnValue('default');
    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue(mockIdentity);
    vi.mocked(api.listMyResourceServers).mockResolvedValue(mockServers as any);
  });

  it('should list servers in a table when servers are found', async () => {
    // ARRANGE
    const consoleTableSpy = vi
      .spyOn(console, 'table')
      .mockImplementation(() => {});

    // ACT: Run the command
    await program.parseAsync(['list'], { from: 'user' });

    // ASSERT
    expect(api.listMyResourceServers).toHaveBeenCalledOnce();
    expect(api.listMyResourceServers).toHaveBeenCalledWith(mockIdentity);
    expect(consoleTableSpy).toHaveBeenCalledOnce();

    // Verify the data passed to console.table is correctly formatted
    const tableData = consoleTableSpy.mock.calls[0][0];
    expect(tableData).toEqual([
      {
        FrontendHost: 'N/A',
        Name: 'Test Server Alpha',
        'Resource Server ID': 'alpha-server-id',
        URL: 'https://alpha.icp0.io',
        Scopes: 'openid, prometheus:charge',
      },
      {
        Name: 'Test Server Bravo',
        'Resource Server ID': 'bravo-server-id',
        URL: 'http://127.0.0.1:4943/?canisterId=bravo',
        FrontendHost: 'https://bravo-frontend.example.com',
        Scopes: 'openid',
      },
    ]);

    consoleTableSpy.mockRestore();
  });

  it('should display a message when no servers are registered', async () => {
    // ARRANGE: Override the default mock to return an empty array
    vi.mocked(api.listMyResourceServers).mockResolvedValue([]);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleTableSpy = vi
      .spyOn(console, 'table')
      .mockImplementation(() => {});

    // ACT
    await program.parseAsync(['list'], { from: 'user' });

    // ASSERT
    expect(api.listMyResourceServers).toHaveBeenCalledOnce();
    expect(consoleTableSpy).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'You have no resource servers registered.',
    );

    consoleLogSpy.mockRestore();
    consoleTableSpy.mockRestore();
  });

  it('should display an error message if the API call fails', async () => {
    // ARRANGE: Override the default mock to simulate a failure
    const errorMessage = 'Failed to fetch from the IC';
    vi.mocked(api.listMyResourceServers).mockRejectedValue(
      new Error(errorMessage),
    );
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // ACT
    await program.parseAsync(['list'], { from: 'user' });

    // ASSERT
    expect(api.listMyResourceServers).toHaveBeenCalledOnce();
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(errorMessage),
    );

    consoleErrorSpy.mockRestore();
  });
});
