import type { Command } from 'commander';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

interface Manifest {
  namespace: string;
  submission: {
    repo_url: string;
    wasm_path: string;
    git_commit: string;
    name: string;
    description: string;
    [key: string]: any;
  };
}

export function registerReleaseCommand(program: Command) {
  program
    .command('release <version>')
    .description(
      'Automated workflow to update version, commit, build, and publish',
    )
    .option(
      '--skip-git',
      'Skip git operations (commit, push, hash update)',
      false,
    )
    .option('--skip-build', 'Skip building the WASM (use existing)', false)
    .action(async (version: string, options: any, thisCommand: Command) => {
      console.log(`\n🚀 Starting release workflow for version ${version}...\n`);

      const configPath = path.join(process.cwd(), 'prometheus.yml');
      if (!fs.existsSync(configPath)) {
        console.error(
          '❌ Error: `prometheus.yml` not found in current directory.',
        );
        console.error('   Run this command from your project root.');
        return process.exit(1);
      }

      try {
        // Check if we're in a git repo
        if (!options.skipGit) {
          try {
            execSync('git rev-parse --git-dir', { stdio: 'ignore' });
          } catch {
            console.error('❌ Error: Not in a git repository');
            return process.exit(1);
          }

          // Check for uncommitted changes
          try {
            execSync('git diff-index --quiet HEAD --', { stdio: 'ignore' });
          } catch {
            console.error('❌ Error: You have uncommitted changes');
            console.error('   Please commit or stash them before releasing.');
            return process.exit(1);
          }
        }

        // Step 1: Update version in main.mo if it exists
        const mainMoPath = path.join(process.cwd(), 'src', 'main.mo');
        if (fs.existsSync(mainMoPath)) {
          console.log('📝 Step 1: Updating version in src/main.mo...');
          const mainMoContent = fs.readFileSync(mainMoPath, 'utf-8');
          const versionMatch = mainMoContent.match(/version = "([^"]+)"/);
          const currentVersion = versionMatch ? versionMatch[1] : 'unknown';
          console.log(`   Current version: ${currentVersion}`);
          console.log(`   New version: ${version}`);

          const updatedContent = mainMoContent.replace(
            /version = "[^"]+"/,
            `version = "${version}"`,
          );
          fs.writeFileSync(mainMoPath, updatedContent);

          if (!options.skipGit) {
            execSync('git add src/main.mo', { stdio: 'inherit' });
          }
        } else {
          console.log(
            '⚠️  Warning: src/main.mo not found, skipping version update',
          );
        }

        // Step 2: Commit version change and get commit hash
        let commitHash: string;
        if (!options.skipGit) {
          console.log('\n📌 Step 2: Committing version change...');
          try {
            execSync(`git commit -m "v${version}"`, { stdio: 'inherit' });
          } catch {
            console.log('   (No changes to commit)');
          }
          execSync('git push', { stdio: 'inherit' });

          commitHash = execSync('git rev-parse HEAD', {
            encoding: 'utf-8',
          }).trim();
          console.log(`   Commit hash: ${commitHash}`);
        } else {
          commitHash = execSync('git rev-parse HEAD', {
            encoding: 'utf-8',
          }).trim();
          console.log(`\n📌 Step 2: Using current commit hash: ${commitHash}`);
        }

        // Step 3: Update prometheus.yml with commit hash and wasm_path
        console.log('\n📝 Step 3: Updating prometheus.yml with commit hash...');
        const manifest = yaml.load(
          fs.readFileSync(configPath, 'utf-8'),
        ) as Manifest;
        manifest.submission.git_commit = commitHash;

        // Set wasm_path to the reproducible build output path
        const wasmPath = './out/out_Linux_x86_64.wasm';
        manifest.submission.wasm_path = wasmPath;

        fs.writeFileSync(configPath, yaml.dump(manifest));
        console.log('   ✅ Updated prometheus.yml');
        console.log(`   ✅ Set wasm_path to ${wasmPath}`);

        if (!options.skipGit) {
          execSync('git add prometheus.yml', { stdio: 'inherit' });
          execSync(`git commit -m "Update git_commit hash for v${version}"`, {
            stdio: 'inherit',
          });
          execSync('git push', { stdio: 'inherit' });
          console.log('   ✅ Committed and pushed');
        }

        // Step 4: Build WASM
        if (!options.skipBuild) {
          console.log('\n🔨 Step 4: Building WASM with reproducible build...');
          console.log('   (This may take a few minutes)');
          // Get network from parent command and pass it to build
          const network = thisCommand.parent?.opts().network || 'ic';
          execSync(`app-store-cli build --network ${network}`, {
            stdio: 'inherit',
          });
        } else {
          console.log('\n⏭️  Step 4: Skipping build (using existing WASM)');
        }

        // Step 5: Publish to registry
        console.log('\n📦 Step 5: Publishing to registry...');
        // Get network from parent command and pass it to publish
        const network = thisCommand.parent?.opts().network || 'ic';
        execSync(`app-store-cli publish ${version} --network ${network}`, {
          stdio: 'inherit',
        });

        console.log('\n✅ Successfully released version ' + version + '!');
        console.log('\n📊 Next steps:');
        console.log('   1. Check the Audit Hub UI to verify bounty creation');
        console.log('   2. Monitor verifier bots for attestations');
        console.log('   3. Wait for 9/9 consensus');
      } catch (error: any) {
        console.error('\n❌ Release failed:', error.message);
        process.exit(1);
      }
    });
}
