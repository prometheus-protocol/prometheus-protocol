import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import yaml from 'js-yaml';
import * as api from '@prometheus-protocol/ic-js';
import { Command } from 'commander';
import { registerSubmitCommand } from '../src/commands/submit.js';

// Mock all external dependencies
vi.mock('node:child_process');
vi.mock('node:fs');
vi.mock('@prometheus-protocol/ic-js');

describe('submit command', () => {
  let program: Command;

  // A complete mock of the submission data from the manifest
  const MOCK_SUBMISSION_DATA = {
    name: 'My Test App',
    description: 'A test app description.',
    publisher: 'Test Devs',
    repo_url: 'https://github.com/test/repo',
    wasm_path: './test.wasm',
    git_commit: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    key_features: ['Feature A', 'Feature B'],
  };

  beforeEach(async () => {
    program = new Command();
    registerSubmitCommand(program);

    // Reset all mocks to a clean state
    vi.clearAllMocks();

    vi.mocked(api.getCurrentIdentityName).mockReturnValue('test-user');
    vi.mocked(api.loadDfxIdentity).mockReturnValue({} as any);
    vi.mocked(api.submitVerificationRequest).mockResolvedValue(123n);
    vi.mocked(api.serializeToIcrc16Map).mockImplementation((obj) => {
      // Simple mock that converts an object to a Map with ICRC-16-like values
      const map = new Map<string, any>();
      for (const [key, value] of Object.entries(obj)) {
        if (Array.isArray(value)) {
          map.set(key, { Array: value.map((v) => ({ Text: v })) });
        } else {
          map.set(key, { Text: value });
        }
      }
      return map as any;
    });

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (path.toString().endsWith('prometheus.yml')) {
        return yaml.dump({
          app: { id: 'com.test.app' },
          submission: MOCK_SUBMISSION_DATA,
        });
      }
      if (path.toString().endsWith('test.wasm')) {
        return Buffer.from('mock wasm content');
      }
      throw new Error(`fs.readFileSync: unhandled path ${path}`);
    });
  });

  it('should read the manifest, serialize metadata, and call the API with correct arguments', async () => {
    // Act
    await program.parseAsync(['submit'], { from: 'user' });

    // Assert
    expect(api.submitVerificationRequest).toHaveBeenCalledOnce();

    const callArgs = vi.mocked(api.submitVerificationRequest).mock.calls[0][1];

    // 1. Assert top-level technical fields are correct
    expect(callArgs.repo).toBe(MOCK_SUBMISSION_DATA.repo_url);
    expect(Buffer.from(callArgs.commit_hash).toString('hex')).toBe(
      MOCK_SUBMISSION_DATA.git_commit,
    );
    expect(Buffer.from(callArgs.wasm_hash).toString('hex')).toBe(
      '82b1aa7b64662f9bad8eb275436c349167779b7f0a8562be6163a7027e441a47',
    );

    console.log(callArgs);

    // 2. Assert metadata is correctly serialized into ICRC-16 format
    const metadataMap = new Map(callArgs.metadata);
    expect(metadataMap.get('name')).toEqual({ Text: 'My Test App' });
    expect(metadataMap.get('publisher')).toEqual({ Text: 'Test Devs' });
    // Check that the array is correctly JSON stringified
    expect(metadataMap.get('key_features')).toEqual({
      Array: [{ Text: 'Feature A' }, { Text: 'Feature B' }],
    });

    // 3. Assert that technical fields are NOT included in the metadata map
    expect(metadataMap.has('repo_url')).toBe(false);
    expect(metadataMap.has('wasm_path')).toBe(false);
    expect(metadataMap.has('git_commit')).toBe(false);
  });

  it('should fail if a required metadata field like `name` is missing', async () => {
    // Arrange: Mock a manifest with a missing `name`
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (path.toString().endsWith('prometheus.yml')) {
        const badData = { ...MOCK_SUBMISSION_DATA };
        // @ts-ignore
        delete badData.name;
        return yaml.dump({ app: { id: 'com.test.app' }, submission: badData });
      }
      return Buffer.from('mock wasm content');
    });
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Act
    await program.parseAsync(['node', 'cli', 'submit']);

    // Assert
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Manifest is incomplete.'),
    );
    consoleErrorSpy.mockRestore();
  });

  it('should fail if prometheus.yml is not found', async () => {
    // Arrange
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Act
    await program.parseAsync(['node', 'cli', 'submit']);

    // Assert
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('`prometheus.yml` not found.'),
    );
    consoleErrorSpy.mockRestore();
  });
});
