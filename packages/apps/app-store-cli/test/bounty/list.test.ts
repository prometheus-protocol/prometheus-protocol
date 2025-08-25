import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { Principal } from '@dfinity/principal';
import * as api from '@prometheus-protocol/ic-js';
import * as identityApi from '../../src/identity.node.js';
import { registerBountyCommands } from '../../src/commands/bounty/bounty.commands.js';

// Mock all external dependencies
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../../src/identity.node.js'); // Adjust path if needed

describe('bounty list command', () => {
  let program: Command;

  // A mock bounty object matching the ProcessedBounty type from ic-js
  const mockBounty = {
    id: 123n,
    tokenAmount: 1_000_000n,
    metadata: {},
    claimedTimestamp: undefined, // This makes it 'Open'
    creator: Principal.fromText('aaaaa-aa'), // mock principal
    created: new Date(),
    tokenCanisterId: Principal.fromText('aaaaa-aa'),
    challengeParameters: {
      audit_type: 'security_v1',
      wasm_hash: 'a1b2c3d4e5f6',
    },
    challengePeriod: 0n,
    claimedBy: null,
    payoutTransactionId: null,
    payoutTimestamp: null,
    // Add missing ProcessedBounty fields
    validationCanisterId: Principal.fromText('aaaaa-aa'),
    validationCallTimeout: 0n,
    payoutFee: 0n,
    claims: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    registerBountyCommands(program);

    // Mock dependencies for a happy path
    vi.mocked(api.listBounties).mockResolvedValue([mockBounty]);
    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue({} as any);
    vi.mocked(identityApi.getCurrentIdentityName).mockReturnValue('test-user');
  });

  it('should fetch bounties and display them in a table', async () => {
    // Arrange
    const consoleTableSpy = vi
      .spyOn(console, 'table')
      .mockImplementation(() => {});

    // Act
    await program.parseAsync(['bounty', 'list'], { from: 'user' });

    // Assert
    expect(api.listBounties).toHaveBeenCalledOnce();
    expect(consoleTableSpy).toHaveBeenCalledOnce();

    // Check the content passed to the table to ensure it's formatted correctly
    const tableData = consoleTableSpy.mock.calls[0][0];
    expect(tableData[0]).toEqual(
      expect.objectContaining({
        'Bounty ID': 123n,
        Status: '🟢 Open',
        'Audit Type': 'security_v1',
      }),
    );

    consoleTableSpy.mockRestore();
  });

  it('should pass all filter and pagination options to the API call', async () => {
    // Arrange
    const creatorPrincipal = 'rrkah-fqaaa-aaaaa-aaaaq-cai';
    const cliArgs = [
      'bounty',
      'list',
      '--status',
      'Claimed',
      '--audit-type',
      'build_reproducibility_v1',
      '--creator',
      creatorPrincipal,
      '--limit',
      '50',
      '--prev',
      '99',
    ];

    // Act
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.listBounties).toHaveBeenCalledOnce();
    const apiCallArgs = vi.mocked(api.listBounties).mock.calls[0][1];

    // Verify pagination
    expect(apiCallArgs.take).toBe(50n);
    expect(apiCallArgs.prev).toBe(99n);

    // Verify filters are correctly transformed
    expect(apiCallArgs.filter).toEqual(
      expect.arrayContaining([
        { status: 'Claimed' },
        { audit_type: 'build_reproducibility_v1' },
        { creator: Principal.fromText(creatorPrincipal) },
      ]),
    );
  });

  it('should display a message if no bounties are found', async () => {
    // Arrange
    vi.mocked(api.listBounties).mockResolvedValue([]); // Mock an empty response
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleTableSpy = vi
      .spyOn(console, 'table')
      .mockImplementation(() => {});

    // Act
    await program.parseAsync(['bounty', 'list'], { from: 'user' });

    // Assert
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'No bounties found matching the specified criteria.',
      ),
    );
    expect(consoleTableSpy).not.toHaveBeenCalled();

    consoleLogSpy.mockRestore();
    consoleTableSpy.mockRestore();
  });
});
