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
vi.mock('../src/identity.node.js');

const CHUNK_SIZE = 1.9 * 1024 * 1024;

describe('publish command', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerPublishCommand(program);
    vi.clearAllMocks();

    // Mock all required API functions
    vi.mocked(api.createCanisterType).mockResolvedValue('existed');
    vi.mocked(api.submitVerificationRequest).mockResolvedValue(1n);
    vi.mocked(api.updateWasm).mockResolvedValue(undefined);
    vi.mocked(api.uploadWasmChunk).mockResolvedValue(undefined);
    vi.mocked(api.serializeToIcrc16Map).mockImplementation((obj) => []); // Simple mock

    // Mock identity functions
    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue({} as any);
    vi.mocked(identityApi.getCurrentIdentityName).mockReturnValue('test-user');
    vi.mocked(fs.existsSync).mockReturnValue(true);

    // Default mock for a complete manifest and a small WASM file
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (path.toString().endsWith('prometheus.yml')) {
        return yaml.dump({
          namespace: 'com.test.app',
          submission: {
            repo_url: 'https://github.com/test/repo',
            wasm_path: './test.wasm',
            git_commit: 'a1b2c3d4',
            name: 'Test App',
            description: 'A test application.',
          },
        });
      }
      if (path.toString().endsWith('test.wasm')) {
        return Buffer.from('mock wasm content');
      }
      return '';
    });
  });

  it('should execute all 5 phases for a valid submission', async () => {
    const MOCK_WASM_CONTENT = Buffer.from('mock wasm content');
    const EXPECTED_TOTAL_HASH = crypto
      .createHash('sha256')
      .update(MOCK_WASM_CONTENT)
      .digest();

    await program.parseAsync(['publish', '1.2.3'], { from: 'user' });

    // --- Assert Phase 2: Ensure Canister Type ---
    expect(api.createCanisterType).toHaveBeenCalledOnce();
    const [_, createTypeArgs] = vi.mocked(api.createCanisterType).mock.calls[0];
    expect(createTypeArgs.namespace).toBe('com.test.app');
    expect(createTypeArgs.name).toBe('Test App');

    // --- Assert Phase 3: Submit Verification Request ---
    expect(api.submitVerificationRequest).toHaveBeenCalledOnce();
    const [__, verificationArgs] = vi.mocked(api.submitVerificationRequest).mock
      .calls[0];
    expect(verificationArgs.wasm_hash).toEqual(EXPECTED_TOTAL_HASH);
    expect(verificationArgs.repo).toBe('https://github.com/test/repo');

    // --- Assert Phase 4: Register WASM Version ---
    expect(api.updateWasm).toHaveBeenCalledOnce();
    const [___, updateArgs] = vi.mocked(api.updateWasm).mock.calls[0];
    expect(updateArgs.namespace).toBe('com.test.app');
    expect(updateArgs.version).toEqual([1n, 2n, 3n]);
    expect(updateArgs.wasm_hash).toEqual(EXPECTED_TOTAL_HASH);

    // --- Assert Phase 5: Upload Chunks ---
    expect(api.uploadWasmChunk).toHaveBeenCalledOnce();
    const [____, uploadArgs] = vi.mocked(api.uploadWasmChunk).mock.calls[0];
    expect(uploadArgs.chunk_index).toBe(0n);
    expect(uploadArgs.chunk_bytes).toEqual(MOCK_WASM_CONTENT);
  });

  it('should correctly split and upload a multi-chunk WASM', async () => {
    const CHUNK_1_CONTENT = Buffer.alloc(CHUNK_SIZE, 'a');
    const CHUNK_2_CONTENT = Buffer.from('final chunk');
    const MOCK_LARGE_WASM = Buffer.concat([CHUNK_1_CONTENT, CHUNK_2_CONTENT]);

    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (path.toString().endsWith('test.wasm')) return MOCK_LARGE_WASM;
      // Return the same complete manifest as the default mock
      return yaml.dump({
        namespace: 'com.test.app',
        submission: {
          repo_url: 'https://github.com/test/repo',
          wasm_path: './test.wasm',
          git_commit: 'a1b2c3d4',
          name: 'Test App',
          description: 'A test application.',
        },
      });
    });

    await program.parseAsync(['publish', '2.0.0'], { from: 'user' });

    // Check that all phases were still called
    expect(api.createCanisterType).toHaveBeenCalledOnce();
    expect(api.submitVerificationRequest).toHaveBeenCalledOnce();
    expect(api.updateWasm).toHaveBeenCalledOnce();

    // Specifically check the multi-chunk upload
    expect(api.uploadWasmChunk).toHaveBeenCalledTimes(2);
    const [_, uploadArgs1] = vi.mocked(api.uploadWasmChunk).mock.calls[0];
    const [__, uploadArgs2] = vi.mocked(api.uploadWasmChunk).mock.calls[1];
    expect(uploadArgs1.chunk_index).toBe(0n);
    expect(uploadArgs2.chunk_index).toBe(1n);
  });

  it('should fail if the manifest is incomplete', async () => {
    // Mock an incomplete manifest
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (path.toString().endsWith('prometheus.yml')) {
        return yaml.dump({
          namespace: 'com.test.app',
          // Missing submission details
        });
      }
      return '';
    });
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await program.parseAsync(['publish', '1.0.0'], { from: 'user' });

    expect(api.createCanisterType).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error: Manifest is incomplete'),
    );
    consoleErrorSpy.mockRestore();
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
        '❌ Error: `prometheus.yml` not found. Please run `app-store init` first.',
      ),
    );
    consoleErrorSpy.mockRestore();
  });
});
