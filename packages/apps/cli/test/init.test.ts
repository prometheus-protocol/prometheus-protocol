import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import prompts from 'prompts';
import yaml from 'js-yaml';
import { Command } from 'commander';
import { registerInitCommand } from '../src/commands/init.js';

// Mock all external dependencies
vi.mock('node:fs');
vi.mock('prompts');

describe('init command', () => {
  let program: Command;

  beforeEach(() => {
    // Reset mocks and create a new command instance for each test
    vi.resetAllMocks();
    program = new Command();
    registerInitCommand(program);
  });

  it('should create a complete submission manifest with the correct structure', async () => {
    // Arrange: Define the raw input the user would provide via prompts
    const mockUserInput = {
      id: 'com.test.app',
      name: 'My Test App',
      publisher: 'Test Devs',
      category: 'Utilities',
      canister_id: 'aaaaa-aa',
      why_this_app: 'This app solves a specific problem.',
      key_features: 'Feature A, Feature B',
      tags: 'test, app',
      visuals: {
        icon_url: 'https://test.app/icon.png',
        banner_url: 'https://test.app/banner.png',
        gallery_images: ['image1.png', 'image2.png'],
      },
      git_commit: 'a1b2c3d4e5f6a1',
      description: 'A test app description.',
      repo_url: 'https://github.com/test/app',
    };
    vi.mocked(prompts).mockResolvedValue(mockUserInput);
    vi.mocked(fs.existsSync).mockReturnValue(false);

    // Act: Run the 'init' command
    await program.parseAsync(['init'], { from: 'user' });

    // Assert: Check that the file was written correctly
    expect(fs.writeFileSync).toHaveBeenCalledOnce();

    const [filePath, fileContent] = vi.mocked(fs.writeFileSync).mock.calls[0];

    // 1. Check the filename
    expect(path.basename(filePath as string)).toBe('prometheus.yml');

    // 2. Check for the key instructional comments
    expect(fileContent).toContain('# App Namespace');
    expect(fileContent).toContain('# Version Submission Package');

    // 3. Parse the YAML content and check its structure and keys
    const parsedYaml = yaml.load(fileContent as string) as any;

    // Check top-level structure
    expect(parsedYaml).toHaveProperty('app');
    expect(parsedYaml).toHaveProperty('submission');

    // Check 'app' section: should ONLY contain the id
    expect(parsedYaml.app).toEqual({ id: 'com.test.app' });
    expect(Object.keys(parsedYaml.app).length).toBe(1);

    // Check 'submission' section for prompted values
    expect(parsedYaml.submission.name).toBe('My Test App');
    expect(parsedYaml.submission.description).toBe('A test app description.');
    expect(parsedYaml.submission.repo_url).toBe('https://github.com/test/app');

    // Check 'submission' section for all required placeholder keys
    expect(parsedYaml.submission).toHaveProperty('publisher');
    expect(parsedYaml.submission).toHaveProperty('category');
    expect(parsedYaml.submission).toHaveProperty('canister_id');
    expect(parsedYaml.submission).toHaveProperty('why_this_app');
    expect(parsedYaml.submission).toHaveProperty('key_features');
    expect(parsedYaml.submission).toHaveProperty('tags');
    expect(parsedYaml.submission).toHaveProperty('visuals');
    expect(parsedYaml.submission.visuals).toHaveProperty('gallery_images');
    expect(parsedYaml.submission).toHaveProperty('git_commit');
    expect(parsedYaml.submission).toHaveProperty('wasm_path');
  });

  it('should not overwrite an existing prometheus.yml file', async () => {
    // Arrange
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Act
    await program.parseAsync(['init'], { from: 'user' });

    // Assert
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '🟡 prometheus.yml already exists in this directory. Skipping.',
    );

    consoleLogSpy.mockRestore();
  });

  it('should exit gracefully if the user cancels the prompts', async () => {
    // Arrange: Simulate a user cancelling by returning an incomplete object
    const mockCancelledInput = {
      name: 'My Test App',
      // 'id' is missing, which will trigger the cancellation logic
    };
    vi.mocked(prompts).mockResolvedValue(mockCancelledInput);
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Act
    await program.parseAsync(['init'], { from: 'user' });

    // Assert
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '\nInitialization cancelled. Exiting.',
    );

    consoleLogSpy.mockRestore();
  });
});
