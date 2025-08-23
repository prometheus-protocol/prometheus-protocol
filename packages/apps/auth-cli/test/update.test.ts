import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import prompts from 'prompts';

// --- 1. Import the command and the mocked library ---
import { registerUpdateCommand } from '../src/commands/update.js';
import * as api from '@prometheus-protocol/ic-js';

// --- 2. Mock the external dependencies ---
vi.mock('prompts');
vi.mock('@prometheus-protocol/ic-js');

describe('update command', () => {
  let program: Command;

  // --- 3. Prepare mock data ---
  const mockIdentity = {} as any;
  const mockServers = [
    {
      name: 'Old Canister Name',
      resource_server_id: 'alpha-server-id',
      uris: ['https://old-url.icp0.io'],
      logo_uri: 'https://old-logo.url/logo.png',
      scopes: [['openid', '...']], // Does not charge initially
      accepted_payment_canisters: [],
    },
  ];

  beforeEach(() => {
    program = new Command();
    registerUpdateCommand(program);
    vi.clearAllMocks();

    // --- 4. Set up default mock implementations ---
    vi.mocked(api.getCurrentIdentityName).mockReturnValue('default');
    vi.mocked(api.loadDfxIdentity).mockReturnValue(mockIdentity);
    vi.mocked(api.listMyResourceServers).mockResolvedValue(mockServers as any);
    vi.mocked(api.updateResourceServer).mockResolvedValue('Updated');
  });

  it('should prompt with existing data and update the canister on confirmation', async () => {
    // ARRANGE: Simulate the user selecting the canister and providing new details
    vi.mocked(prompts)
      // First prompt: select which server to update
      .mockResolvedValueOnce({ serverToManageId: 'alpha-server-id' })
      // Second prompt: provide the new details
      .mockResolvedValueOnce({
        name: 'New Canister Name',
        url: 'https://new-url.icp0.io',
        logo: 'https://new-logo.url/logo.png',
        willCharge: true, // Enable charging
        tokens: 'cngnf-vqaaa-aaaar-qag4q-cai',
      });

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // ACT
    await program.parseAsync(['update'], { from: 'user' });

    // ASSERT
    expect(api.listMyResourceServers).toHaveBeenCalledOnce();
    expect(prompts).toHaveBeenCalledTimes(2);
    expect(api.updateResourceServer).toHaveBeenCalledOnce();

    // Verify the payload sent to the update function is correct
    const [identity, args] = vi.mocked(api.updateResourceServer).mock.calls[0];
    expect(identity).toBe(mockIdentity);
    expect(args.resource_server_id).toBe('alpha-server-id');
    expect(args.name?.[0]).toBe('New Canister Name');
    expect(args.uris?.[0]?.[0]).toBe('https://new-url.icp0.io');
    expect(args.scopes?.[0]?.map((s) => s[0])).toContain('prometheus:charge');
    expect(args.accepted_payment_canisters?.[0]).toHaveLength(1);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Success! Canister 'New Canister Name' has been updated.",
      ),
    );

    consoleLogSpy.mockRestore();
  });

  it('should not call the update API if the user cancels the selection', async () => {
    // ARRANGE: Simulate the user cancelling the first prompt
    vi.mocked(prompts).mockResolvedValueOnce({ serverToManageId: undefined });

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // ACT
    await program.parseAsync(['update'], { from: 'user' });

    // ASSERT
    expect(api.listMyResourceServers).toHaveBeenCalledOnce();
    expect(prompts).toHaveBeenCalledOnce(); // Only the selection prompt was shown
    expect(api.updateResourceServer).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Update cancelled. Exiting.'),
    );

    consoleLogSpy.mockRestore();
  });

  it('should inform the user and exit if no canisters are registered', async () => {
    // ARRANGE: Override the default mock to return an empty array
    vi.mocked(api.listMyResourceServers).mockResolvedValue([]);

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // ACT
    await program.parseAsync(['update'], { from: 'user' });

    // ASSERT
    expect(api.listMyResourceServers).toHaveBeenCalledOnce();
    expect(prompts).not.toHaveBeenCalled();
    expect(api.updateResourceServer).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'You have no canisters registered to update.',
    );

    consoleLogSpy.mockRestore();
  });
});
