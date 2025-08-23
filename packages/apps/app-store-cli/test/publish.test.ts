import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import yaml from 'js-yaml';
import crypto from 'node:crypto';
import { Command } from 'commander';
import { registerPublishCommand } from '../src/commands/publish.js';
import * as api from '@prometheus-protocol/ic-js';
import * as identityApi from '../src/identity.node.js';

// Mock all external dependencies
vi.mock('node:fs');
vi.mock('node:child_process');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../src/identity.node.js');

// The CHUNK_SIZE from the command file, needed for testing the chunking logic
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
        return yaml.dump({
          app: { id: 'com.test.app' },
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

    await program.parseAsync(['publish', '--app-version', '1.2.3'], {
      from: 'user',
    });

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
      // --- FIX #1: The mock manifest must be complete ---
      return yaml.dump({
        app: { id: 'com.test.app' },
        submission: {
          repo_url: 'https://github.com/test/repo', // This was missing
          wasm_path: './test.wasm',
        },
      });
    });

    await program.parseAsync(['publish', '--app-version', '2.0.0'], {
      from: 'user',
    });

    expect(api.updateWasm).toHaveBeenCalledOnce();
    const [_, updateArgs] = vi.mocked(api.updateWasm).mock.calls[0];
    expect(updateArgs.chunk_hashes).toEqual([
      EXPECTED_CHUNK_1_HASH,
      EXPECTED_CHUNK_2_HASH,
    ]);

    expect(api.uploadWasmChunk).toHaveBeenCalledTimes(2);
    const uploadArgs1 = vi.mocked(api.uploadWasmChunk).mock.calls[0][1];
    expect(uploadArgs1.chunk_index).toBe(0n);
    const uploadArgs2 = vi.mocked(api.uploadWasmChunk).mock.calls[1][1];
    expect(uploadArgs2.chunk_index).toBe(1n);
  });

  it('should fail if the version string is invalid', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await program.parseAsync(['publish', '--app-version', '1.2'], {
      from: 'user',
    });

    expect(api.updateWasm).not.toHaveBeenCalled();
    // --- FIX #2: The assertion must match the actual error handling logic ---
    // It should check for the "Operation failed" header...
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Operation failed'),
    );
    // ...and it should check for the actual Error object.
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(
          'Version must be in format major.minor.patch',
        ),
      }),
    );
    consoleErrorSpy.mockRestore();
  });
});
