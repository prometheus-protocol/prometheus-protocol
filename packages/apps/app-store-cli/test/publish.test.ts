import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import yaml from 'js-yaml';
import crypto from 'node:crypto';
import { Command } from 'commander';
import { registerPublishCommand } from '../src/commands/publish.command.js';
import * as api from '@prometheus-protocol/ic-js';
import * as identityApi from '../src/identity.node.js';

// Mock all external dependencies
vi.mock('node:fs');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../src/identity.node.js'); // Adjust path if needed

const CHUNK_SIZE = 1.9 * 1024 * 1024;

describe('publish command', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerPublishCommand(program);
    vi.clearAllMocks();

    vi.mocked(api.updateWasm).mockResolvedValue(undefined);
    vi.mocked(api.uploadWasmChunk).mockResolvedValue(undefined);
    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue({} as any);
    vi.mocked(identityApi.getCurrentIdentityName).mockReturnValue('test-user');
    vi.mocked(fs.existsSync).mockReturnValue(true);

    // Default mock for a small WASM file
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (path.toString().endsWith('prometheus.yml')) {
        // 1. Use the standardized 'namespace' key
        return yaml.dump({
          namespace: 'com.test.app',
          submission: {
            repo_url: 'https://github.com/test/repo',
            wasm_path: './test.wasm',
          },
        });
      }
      if (path.toString().endsWith('test.wasm')) {
        return Buffer.from('mock wasm content');
      }
      return '';
    });
  });

  it('should register and upload a single-chunk WASM', async () => {
    const MOCK_WASM_CONTENT = Buffer.from('mock wasm content');
    const EXPECTED_TOTAL_HASH = crypto
      .createHash('sha256')
      .update(MOCK_WASM_CONTENT)
      .digest();

    // 2. Use the new positional argument structure
    await program.parseAsync(['publish', '1.2.3'], { from: 'user' });

    expect(api.updateWasm).toHaveBeenCalledOnce();
    const [_, updateArgs] = vi.mocked(api.updateWasm).mock.calls[0];
    expect(updateArgs.namespace).toBe('com.test.app');
    expect(updateArgs.version).toEqual([1n, 2n, 3n]);
    expect(updateArgs.wasm_hash).toEqual(EXPECTED_TOTAL_HASH);

    expect(api.uploadWasmChunk).toHaveBeenCalledOnce();
    const [__, uploadArgs] = vi.mocked(api.uploadWasmChunk).mock.calls[0];
    expect(uploadArgs.chunk_index).toBe(0n);
    expect(uploadArgs.chunk_bytes).toEqual(MOCK_WASM_CONTENT);
  });

  it('should correctly split and upload a multi-chunk WASM', async () => {
    const CHUNK_1_CONTENT = Buffer.alloc(CHUNK_SIZE, 'a');
    const CHUNK_2_CONTENT = Buffer.from('final chunk');
    const MOCK_LARGE_WASM = Buffer.concat([CHUNK_1_CONTENT, CHUNK_2_CONTENT]);
    const EXPECTED_CHUNK_1_HASH = crypto
      .createHash('sha256')
      .update(CHUNK_1_CONTENT)
      .digest();
    const EXPECTED_CHUNK_2_HASH = crypto
      .createHash('sha256')
      .update(CHUNK_2_CONTENT)
      .digest();

    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (path.toString().endsWith('test.wasm')) return MOCK_LARGE_WASM;
      return yaml.dump({
        namespace: 'com.test.app', // Use standardized key
        submission: {
          repo_url: 'https://github.com/test/repo',
          wasm_path: './test.wasm',
        },
      });
    });

    // Use new positional argument structure
    await program.parseAsync(['publish', '2.0.0'], { from: 'user' });

    expect(api.updateWasm).toHaveBeenCalledOnce();
    const [_, updateArgs] = vi.mocked(api.updateWasm).mock.calls[0];
    expect(updateArgs.chunk_hashes).toEqual([
      EXPECTED_CHUNK_1_HASH,
      EXPECTED_CHUNK_2_HASH,
    ]);

    expect(api.uploadWasmChunk).toHaveBeenCalledTimes(2);
  });

  it('should fail if the version string is invalid', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Use new positional argument structure
    await program.parseAsync(['publish', '1.2'], { from: 'user' });

    expect(api.updateWasm).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Operation failed'),
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(
          'Version must be in format major.minor.patch',
        ),
      }),
    );
    consoleErrorSpy.mockRestore();
  });

  it('should fail if prometheus.yml is not found', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await program.parseAsync(['publish', '1.0.0'], { from: 'user' });

    expect(api.updateWasm).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '❌ Error: `prometheus.yml` not found. Please run this command in a project directory.',
      ),
    );
    consoleErrorSpy.mockRestore();
  });
});
