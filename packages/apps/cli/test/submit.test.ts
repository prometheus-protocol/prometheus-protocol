import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import yaml from 'js-yaml';
import * as api from '@prometheus-protocol/ic-js';
import * as utils from '../src/utils.js';
import { Command } from 'commander';
import { registerSubmitCommand } from '../src/commands/submit.js';

// --- THE FIX: Explicitly mock the modules you depend on ---
vi.mock('node:child_process');
vi.mock('node:fs');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../src/utils.js');
// ---------------------------------------------------------

describe('submit command', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerSubmitCommand(program);

    // Reset all mocks to a clean state
    vi.clearAllMocks();

    // Provide default successful implementations for all mocks
    // This will now work because the modules are properly mocked.
    vi.mocked(api.submitVerificationRequest).mockResolvedValue(123n);
    vi.mocked(utils.loadDfxIdentity).mockReturnValue({} as any);

    vi.mocked(execSync).mockImplementation((command: string) => {
      if (command === 'dfx identity whoami')
        return Buffer.from('test-developer');
      if (command === 'git rev-parse HEAD')
        return Buffer.from('mock-commit-hash');
      throw new Error(`Unknown command: ${command}`);
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (path.toString().endsWith('prometheus.yml')) {
        return yaml.dump({
          repo_url: 'https://github.com/test/repo',
          wasm_path: './test.wasm',
        });
      }
      if (path.toString().endsWith('test.wasm')) {
        return Buffer.from('mock wasm content');
      }
      throw new Error(`fs.readFileSync: unhandled path ${path}`);
    });
  });

  it('should read the manifest and call the API with correct arguments', async () => {
    const cliArgs = ['node', 'cli', 'submit'];
    await program.parseAsync(cliArgs);

    // Assert that our high-level API function was called
    expect(api.submitVerificationRequest).toHaveBeenCalledOnce();

    // Assert the arguments passed to the API function are correct
    const callArgs = vi.mocked(api.submitVerificationRequest).mock.calls[0][1];
    expect(callArgs.repo).toBe('https://github.com/test/repo');
    expect(Buffer.from(callArgs.wasm_hash).toString('hex')).toBe(
      '82b1aa7b64662f9bad8eb275436c349167779b7f0a8562be6163a7027e441a47',
    );
  });

  it('should fail if prometheus.yml is not found', async () => {
    vi.mocked(fs.existsSync).mockImplementation(
      (path) => !path.toString().endsWith('prometheus.yml'),
    );
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await program.parseAsync(['node', 'cli', 'submit']);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('`prometheus.yml` not found.'),
    );
    consoleErrorSpy.mockRestore();
  });

  it('should fail if wasm_path in manifest points to a non-existent file', async () => {
    vi.mocked(fs.existsSync).mockImplementation(
      (path) => !path.toString().endsWith('.wasm'),
    );
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await program.parseAsync(['node', 'cli', 'submit']);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('WASM file not found at path'),
    );
    consoleErrorSpy.mockRestore();
  });
});
