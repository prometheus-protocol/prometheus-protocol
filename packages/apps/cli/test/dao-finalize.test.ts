import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import prompts from 'prompts';
import yaml from 'js-yaml';
import { execSync } from 'node:child_process';
import { Command } from 'commander';
import { registerInitCommand } from '../src/commands/init.js';
// --- Add new imports for mocked modules ---
import * as api from '@prometheus-protocol/ic-js';
import * as utils from '../src/utils.js';
import { Principal } from '@dfinity/principal';

// --- Mock all external dependencies ---
vi.mock('node:fs');
vi.mock('prompts');
vi.mock('node:child_process');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../src/utils.js');

describe('init command', () => {
  let program: Command;

  // Define the mock user input once for reuse
  const MOCK_USER_INPUT = {
    id: 'com.test.app',
    name: 'My Test App',
    description: 'A test app description.',
    repo_url: 'https://github.com/test/app',
    publisher: 'Test Devs',
    category: 'Utilities',
    canister_id: 'aaaaa-aa',
    why_this_app: 'This app solves a specific problem.',
    key_features: 'Feature A, Feature B',
    tags: 'test, app',
    icon_url: 'https://test.app/icon.png',
    banner_url: 'https://test.app/banner.png',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    program = new Command();
    registerInitCommand(program);

    // Set up default "happy path" mocks for all dependencies
    vi.mocked(prompts).mockResolvedValue(MOCK_USER_INPUT);
    vi.mocked(fs.existsSync).mockReturnValue(false); // Assume file doesn't exist
    vi.mocked(api.createCanisterType).mockResolvedValue('created'); // Default to 'created' status
    vi.mocked(utils.loadDfxIdentity).mockReturnValue({
      getPrincipal: () => Principal.fromText('aaaaa-aa'),
    } as any);
    vi.mocked(execSync).mockReturnValue(Buffer.from('test-user'));
  });

  it('should create a complete manifest and register a new canister type', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['init'], { from: 'user' });

    // --- Assert File Creation (using your original detailed assertions) ---
    expect(fs.writeFileSync).toHaveBeenCalledOnce();
    const [_, fileContent] = vi.mocked(fs.writeFileSync).mock.calls[0];
    const parsedYaml = yaml.load(fileContent as string) as any;
    expect(parsedYaml.app.id).toBe('com.test.app');
    expect(parsedYaml.submission.name).toBe('My Test App');
    expect(parsedYaml.submission.publisher).toBe('Test Devs');
    expect(parsedYaml.submission).toHaveProperty('git_commit');

    // --- Assert On-Chain API Call ---
    expect(api.createCanisterType).toHaveBeenCalledOnce();
    const [__, callArgs] = vi.mocked(api.createCanisterType).mock.calls[0];
    expect(callArgs.namespace).toBe('com.test.app');
    expect(callArgs.name).toBe('My Test App');
    expect(callArgs.repo_url).toBe('https://github.com/test/app');

    // --- Assert User Feedback ---
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('`prometheus.yml` has been created'),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Your canister type has been registered'),
    );

    consoleLogSpy.mockRestore();
  });

  it('should notify the user if the canister type already exists', async () => {
    // Arrange: Mock the API to return 'existed'
    vi.mocked(api.createCanisterType).mockResolvedValue('existed');
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['init'], { from: 'user' });

    // Assert: The API was still called, but the message is different
    expect(api.createCanisterType).toHaveBeenCalledOnce();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('This canister type already exists on-chain'),
    );

    consoleLogSpy.mockRestore();
  });

  it('should log an error if the on-chain registration fails', async () => {
    // Arrange: Mock the API to reject with a real error
    const apiError = new Error('Registry is offline');
    vi.mocked(api.createCanisterType).mockRejectedValue(apiError);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await program.parseAsync(['init'], { from: 'user' });

    // Assert: The file is still created, but an error is logged
    expect(fs.writeFileSync).toHaveBeenCalledOnce();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '\n❌ On-chain registration failed:',
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(apiError);

    consoleErrorSpy.mockRestore();
  });

  // --- Your original tests for file existence and cancellation remain valid ---
  it('should not overwrite an existing prometheus.yml file', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['init'], { from: 'user' });

    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(api.createCanisterType).not.toHaveBeenCalled(); // Should not attempt on-chain call
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('prometheus.yml already exists'),
    );

    consoleLogSpy.mockRestore();
  });

  it('should exit gracefully if the user cancels the prompts', async () => {
    vi.mocked(prompts).mockResolvedValue({ id: null }); // Simulate cancellation
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['init'], { from: 'user' });

    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(api.createCanisterType).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Initialization cancelled'),
    );

    consoleLogSpy.mockRestore();
  });
});
