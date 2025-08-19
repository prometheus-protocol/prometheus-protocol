import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { Command } from 'commander';
import { registerDaoGenerateBallotCommand } from '../src/commands/dao-generate-ballot.js';

// Mock the filesystem
vi.mock('node:fs');

describe('dao:generate-ballot command', () => {
  let program: Command;
  // This is the real sha256 hash of the string "mock wasm content"
  const EXPECTED_WASM_ID =
    '82b1aa7b64662f9bad8eb275436c349167779b7f0a8562be6163a7027e441a47';

  beforeEach(() => {
    program = new Command();
    registerDaoGenerateBallotCommand(program);
    vi.clearAllMocks();

    // Mock the filesystem for the "happy path"
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
      if (filePath.toString().endsWith('prometheus.yml')) {
        return yaml.dump({
          submission: { wasm_path: './test.wasm' },
        });
      }
      if (filePath.toString().endsWith('test.wasm')) {
        return Buffer.from('mock wasm content');
      }
      throw new Error(`Unexpected readFileSync call: ${filePath}`);
    });
  });

  it('should read manifest, hash WASM, and generate a correct ballot template', async () => {
    await program.parseAsync(['node', 'cli', 'dao:generate-ballot']);

    // 1. Assert that the file was written
    expect(fs.writeFileSync).toHaveBeenCalledOnce();

    // 2. Inspect the content of the written file
    const [filePath, fileContent] = vi.mocked(fs.writeFileSync).mock.calls[0];

    // Check the filename
    expect(path.basename(filePath as string)).toBe('dao_decision_ballot.yml');

    // 3. Parse the YAML and check its structure
    const parsedYaml = yaml.load(fileContent as string) as any;
    expect(parsedYaml.wasm_id).toBe(EXPECTED_WASM_ID);
    expect(parsedYaml.outcome).toBe('Verify | Reject'); // Check for the placeholder
    expect(parsedYaml.metadata).toHaveProperty('decision_summary');
    expect(parsedYaml.metadata).toHaveProperty('proposal_url');
  });

  it('should fail if prometheus.yml is not found', async () => {
    vi.mocked(fs.existsSync).mockImplementation(
      (p) => !p.toString().endsWith('prometheus.yml'),
    );
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await program.parseAsync(['node', 'cli', 'dao:generate-ballot']);

    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('`prometheus.yml` not found'),
    );
    consoleErrorSpy.mockRestore();
  });
});
