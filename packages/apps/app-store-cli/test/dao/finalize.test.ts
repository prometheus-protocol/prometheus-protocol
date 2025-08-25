import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import yaml from 'js-yaml';
import * as api from '@prometheus-protocol/ic-js';
import { Command } from 'commander';
import { registerDaoCommands } from '../../src/commands/dao/dao.commands.js';
import * as identityApi from '../../src/identity.node.js';

// Mock all external dependencies
vi.mock('node:fs');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../../src/identity.node.js');

describe('dao finalize command', () => {
  let program: Command;
  const MOCK_WASM_ID = 'mock-wasm-id-12345';

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    registerDaoCommands(program);

    // Mock API and identity for happy paths
    vi.mocked(api.finalizeVerification).mockResolvedValue(undefined);
    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue({} as any);
    vi.mocked(api.serializeToIcrc16Map).mockImplementation(
      (obj) => new Map(Object.entries(obj)) as any,
    );
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  it('should submit a "Verify" outcome correctly', async () => {
    // Arrange
    const ballotContent = yaml.dump({
      wasm_id: MOCK_WASM_ID,
      outcome: 'Verified',
      metadata: { summary: 'Looks good' },
    });
    vi.mocked(fs.readFileSync).mockReturnValue(ballotContent);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Act
    const cliArgs = ['dao', 'finalize', './ballot.yml'];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.finalizeVerification).toHaveBeenCalledOnce();
    const [_, callArgs] = vi.mocked(api.finalizeVerification).mock.calls[0];
    expect(callArgs.wasm_id).toBe(MOCK_WASM_ID);
    expect(callArgs.outcome).toEqual({ Verified: null });
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Success!'),
    );
    consoleLogSpy.mockRestore();
  });

  it('should submit a "Rejected" outcome correctly', async () => {
    // Arrange
    const ballotContent = yaml.dump({
      wasm_id: MOCK_WASM_ID,
      outcome: 'Rejected',
      metadata: { summary: 'Found an issue' },
    });
    vi.mocked(fs.readFileSync).mockReturnValue(ballotContent);

    // Act
    const cliArgs = ['dao', 'finalize', './ballot.yml'];
    await program.parseAsync(cliArgs, { from: 'user' });

    // Assert
    expect(api.finalizeVerification).toHaveBeenCalledOnce();
    const [_, callArgs] = vi.mocked(api.finalizeVerification).mock.calls[0];
    expect(callArgs.wasm_id).toBe(MOCK_WASM_ID);
    expect(callArgs.outcome).toEqual({ Rejected: null });
  });

  it('should fail if the ballot file does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const cliArgs = ['dao', 'finalize', './bad.yml'];
    await program.parseAsync(cliArgs, { from: 'user' });

    expect(api.finalizeVerification).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('File not found'),
    );
    consoleErrorSpy.mockRestore();
  });

  it('should fail if the ballot file is malformed', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      yaml.dump({ wasm_id: MOCK_WASM_ID }),
    ); // Missing outcome/metadata
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const cliArgs = ['dao', 'finalize', './bad.yml'];
    await program.parseAsync(cliArgs, { from: 'user' });

    expect(api.finalizeVerification).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Ballot is malformed'),
    );
    consoleErrorSpy.mockRestore();
  });

  it('should fail if the outcome is invalid', async () => {
    const ballotContent = yaml.dump({
      wasm_id: MOCK_WASM_ID,
      outcome: 'Maybe', // Invalid outcome
      metadata: { summary: 'Not sure' },
    });
    vi.mocked(fs.readFileSync).mockReturnValue(ballotContent);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const cliArgs = ['dao', 'finalize', './bad.yml'];
    await program.parseAsync(cliArgs, { from: 'user' });

    expect(api.finalizeVerification).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Invalid 'outcome' in ballot"),
    );
    consoleErrorSpy.mockRestore();
  });
});
