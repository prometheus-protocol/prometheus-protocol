#!/usr/bin/env tsx

/**
 * Script to automatically bump version and release the test MCP app
 * Used for local development testing
 */

import { spawn } from 'child_process';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const TEST_REPO_PATH = '/tmp/test';
const TEST_REPO_URL = 'https://github.com/jneums/test';
const ENV_PATH = join(
  __dirname,
  '../packages/apps/verifier-bot/deployment/.env',
);

// Spinner animation
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let spinnerInterval: NodeJS.Timeout | null = null;

function startSpinner(message: string): void {
  let i = 0;
  process.stdout.write(`${message} ${spinnerFrames[0]}`);
  spinnerInterval = setInterval(() => {
    i = (i + 1) % spinnerFrames.length;
    process.stdout.write(`\r${message} ${spinnerFrames[i]}`);
  }, 80);
}

function stopSpinner(message: string, success: boolean = true): void {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
  }
  const icon = success ? '✅' : '❌';
  process.stdout.write(`\r${message} ${icon}\n`);
}

function getGitHubToken(): string {
  try {
    const envContent = readFileSync(ENV_PATH, 'utf-8');
    const match = envContent.match(/GITHUB_TOKEN=(.+)/);
    if (!match) {
      throw new Error('GITHUB_TOKEN not found in .env file');
    }
    return match[1].trim();
  } catch (error) {
    console.error('❌ Failed to read GitHub token from .env');
    throw error;
  }
}

function run(command: string, cwd?: string): string {
  try {
    return execSync(command, {
      cwd: cwd || process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error: any) {
    console.error(`❌ Command failed: ${command}`);
    console.error(error.stderr || error.message);
    throw error;
  }
}

function runWithSpinner(
  command: string,
  cwd: string,
  spinnerMessage: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    startSpinner(spinnerMessage);

    const child = spawn(command, [], {
      cwd,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      stopSpinner(spinnerMessage, code === 0);
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || stdout));
      }
    });

    child.on('error', (error) => {
      stopSpinner(spinnerMessage, false);
      reject(error);
    });
  });
}

function bumpVersion(currentVersion: string): string {
  const parts = currentVersion.split('.');
  const patch = parseInt(parts[2] || '0', 10);
  parts[2] = (patch + 1).toString();
  return parts.join('.');
}

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const networkArg = args.find((arg) => arg.startsWith('--network='));
  const network = networkArg ? networkArg.split('=')[1] : 'local';

  console.log(
    `🚀 Starting automated test app release (network: ${network})...\n`,
  );

  // Get GitHub token
  console.log('🔑 Reading GitHub token...');
  const githubToken = getGitHubToken();
  console.log('   ✅ Token loaded\n');

  // Clone or update repo
  console.log(`📦 Preparing test repository at ${TEST_REPO_PATH}...`);
  try {
    run(`cd ${TEST_REPO_PATH} && git pull`, TEST_REPO_PATH);
    console.log('   ✅ Repository updated\n');
  } catch {
    console.log('   📥 Cloning repository...');
    run(`rm -rf ${TEST_REPO_PATH}`);
    run(`git clone ${TEST_REPO_URL} ${TEST_REPO_PATH}`);
    console.log('   ✅ Repository cloned\n');
  }

  // Restore any changes
  console.log('🔄 Restoring clean state...');
  run('git restore .', TEST_REPO_PATH);
  console.log('   ✅ Clean state restored\n');

  // Read current version from package.json
  const packageJsonPath = join(TEST_REPO_PATH, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const currentVersion = packageJson.version || '0.1.0';
  const newVersion = bumpVersion(currentVersion);

  console.log(`📈 Bumping version: ${currentVersion} → ${newVersion}\n`);

  // Update package.json with new version
  packageJson.version = newVersion;
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

  // Commit version bump
  console.log('💾 Committing version bump...');
  run(`git add package.json`, TEST_REPO_PATH);
  run(`git commit -m "chore: bump version to ${newVersion}"`, TEST_REPO_PATH);
  run(`git push`, TEST_REPO_PATH);
  console.log('   ✅ Version committed and pushed\n');

  // Release the new version with spinner
  const releaseCommand = `GITHUB_TOKEN=${githubToken} app-store-cli release ${newVersion} --network ${network}`;

  try {
    const output = await runWithSpinner(
      releaseCommand,
      TEST_REPO_PATH,
      `🎯 Releasing version ${newVersion}...`,
    );
    console.log('\n' + '─'.repeat(60));
    console.log(output.trim().split('\n').slice(-10).join('\n')); // Show last 10 lines
    console.log('─'.repeat(60));
    console.log(`\n✅ Successfully released version ${newVersion}!\n`);
  } catch (error: any) {
    console.log('\n' + '─'.repeat(60));
    console.error(
      `❌ Release failed:\n${error.message?.split('\n').slice(-20).join('\n')}`,
    );
    console.log('─'.repeat(60));
    throw error;
  }
}

main().catch((error) => {
  console.error('\n❌ Script failed:', error.message);
  process.exit(1);
});
