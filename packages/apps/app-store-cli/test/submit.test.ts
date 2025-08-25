import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import yaml from 'js-yaml';
import * as api from '@prometheus-protocol/ic-js';
import * as identityApi from '../src/identity.node.js';
import { Command } from 'commander';
import { registerSubmitCommand } from '../src/commands/submit.command.js';

// Mock all external dependencies
vi.mock('node:fs');
vi.mock('@prometheus-protocol/ic-js');
vi.mock('../src/identity.node.js'); // Adjust path if needed

describe('submit command', () => {
  let program: Command;
  const MOCK_SUBMISSION_DATA = {
    name: 'My Test App',
    description: 'A test app description.',
    repo_url: 'https://github.com/test/repo',
    wasm_path: './test.wasm',
    git_commit: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  };
  const MOCK_NAMESPACE = 'com.test.app';

  beforeEach(() => {
    program = new Command();
    registerSubmitCommand(program);
    vi.clearAllMocks();

    vi.mocked(identityApi.loadDfxIdentity).mockReturnValue({} as any);
    // 1. Mock the new on-chain call that was moved from 'init'.
    vi.mocked(api.createCanisterType).mockResolvedValue('created');
    vi.mocked(api.submitVerificationRequest).mockResolvedValue(123n);
    vi.mocked(api.serializeToIcrc16Map).mockImplementation(
      (obj) => new Map(Object.entries(obj)) as any,
    );

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (path.toString().endsWith('prometheus.yml')) {
        // 2. Update the mock manifest to use the standardized 'namespace' key.
        return yaml.dump({
          namespace: MOCK_NAMESPACE,
          submission: MOCK_SUBMISSION_DATA,
        });
      }
      return Buffer.from('mock wasm content');
    });
  });

  it('should register the type and then submit the request on the first run', async () => {
    // Act
    await program.parseAsync(['submit'], { from: 'user' });

    // Assert Phase 1: Canister Type Registration
    expect(api.createCanisterType).toHaveBeenCalledOnce();
    const [_, createTypeArgs] = vi.mocked(api.createCanisterType).mock.calls[0];
    expect(createTypeArgs.namespace).toBe(MOCK_NAMESPACE);
    expect(createTypeArgs.name).toBe(MOCK_SUBMISSION_DATA.name);

    // Assert Phase 2: Verification Submission
    expect(api.submitVerificationRequest).toHaveBeenCalledOnce();
    const [__, submitArgs] = vi.mocked(api.submitVerificationRequest).mock
      .calls[0];
    expect(submitArgs.repo).toBe(MOCK_SUBMISSION_DATA.repo_url);
  });

  it('should proceed with submission if the canister type already exists', async () => {
    // Arrange: Mock the API to indicate the type already exists.
    vi.mocked(api.createCanisterType).mockResolvedValue('existed');
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Act
    await program.parseAsync(['submit'], { from: 'user' });

    // Assert
    expect(api.createCanisterType).toHaveBeenCalledOnce();
    // CRITICAL: The submission should still happen.
    expect(api.submitVerificationRequest).toHaveBeenCalledOnce();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Canister type already exists. Proceeding...'),
    );
    consoleLogSpy.mockRestore();
  });

  it('should fail if a required field like `git_commit` is missing', async () => {
    // Arrange: Mock a manifest with a missing field.
    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (path.toString().endsWith('prometheus.yml')) {
        const badData = { ...MOCK_SUBMISSION_DATA };
        // @ts-ignore
        delete badData.git_commit;
        return yaml.dump({ namespace: MOCK_NAMESPACE, submission: badData });
      }
      return Buffer.from('mock wasm content');
    });
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Act
    await program.parseAsync(['submit'], { from: 'user' });

    // Assert: No on-chain calls should be made.
    expect(api.createCanisterType).not.toHaveBeenCalled();
    expect(api.submitVerificationRequest).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Manifest is incomplete'),
    );
    consoleErrorSpy.mockRestore();
  });
});
