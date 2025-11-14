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
    .command('release <version> [canister]')
    .description(
      'Automated workflow to update version, commit, build, and publish',
    )
    .option(
      '--skip-git',
      'Skip git operations (commit, push, hash update)',
      false,
    )
    .option('--skip-build', 'Skip building the WASM (use existing)', false)
    .action(
      async (
        version: string,
        canisterName: string | undefined,
        options: any,
        thisCommand: Command,
      ) => {
        console.log(
          `\n🚀 Starting release workflow for version ${version}...\n`,
        );

        // Find project root and canister path (same logic as build command)
        let projectRoot = process.cwd();
        let foundRoot = false;

        while (projectRoot !== '/') {
          if (fs.existsSync(path.join(projectRoot, 'dfx.json'))) {
            foundRoot = true;
            break;
          }
          projectRoot = path.dirname(projectRoot);
        }

        if (!foundRoot) {
          console.error(
            '❌ Error: dfx.json not found. Please run this command from your IC project directory.',
          );
          return process.exit(1);
        }

        let canisterPath = projectRoot;

        if (canisterName) {
          const dfxJsonPath = path.join(projectRoot, 'dfx.json');
          const dfxJson = JSON.parse(fs.readFileSync(dfxJsonPath, 'utf-8'));

          const canisterConfig = dfxJson.canisters?.[canisterName];
          if (!canisterConfig) {
            console.error(
              `❌ Error: Canister '${canisterName}' not found in dfx.json`,
            );
            return process.exit(1);
          }

          const mainFile = canisterConfig.main;
          if (!mainFile) {
            console.error(
              `❌ Error: Canister '${canisterName}' has no 'main' field in dfx.json`,
            );
            return process.exit(1);
          }

          const mainFilePath = path.join(projectRoot, mainFile);
          let currentDir = path.dirname(mainFilePath);
          let foundPrometheusYml = false;

          while (currentDir !== projectRoot && currentDir !== '/') {
            if (fs.existsSync(path.join(currentDir, 'prometheus.yml'))) {
              canisterPath = currentDir;
              foundPrometheusYml = true;
              break;
            }
            currentDir = path.dirname(currentDir);
          }

          if (
            !foundPrometheusYml &&
            fs.existsSync(path.join(projectRoot, 'prometheus.yml'))
          ) {
            canisterPath = projectRoot;
            foundPrometheusYml = true;
          }

          if (!foundPrometheusYml) {
            console.error(
              `❌ Error: prometheus.yml not found for canister '${canisterName}'`,
            );
            return process.exit(1);
          }

          console.log(`📦 Canister: ${canisterName}`);
          console.log(`📁 Canister path: ${canisterPath}`);
        }

        const configPath = path.join(canisterPath, 'prometheus.yml');
        if (!fs.existsSync(configPath)) {
          console.error('❌ Error: `prometheus.yml` not found.');
          console.error(`   Expected at: ${configPath}`);
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
          const mainMoPath = path.join(canisterPath, 'src', 'main.mo');
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
              const mainMoRelativePath = path.relative(projectRoot, mainMoPath);
              execSync(`git add ${mainMoRelativePath}`, {
                stdio: 'inherit',
                cwd: projectRoot,
              });
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
            console.log(
              `\n📌 Step 2: Using current commit hash: ${commitHash}`,
            );
          }

          // Step 3: Update prometheus.yml with commit hash and wasm_path
          console.log(
            '\n📝 Step 3: Updating prometheus.yml with commit hash...',
          );
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
            const prometheusYmlRelativePath = path.relative(
              projectRoot,
              configPath,
            );
            execSync(`git add ${prometheusYmlRelativePath}`, {
              stdio: 'inherit',
              cwd: projectRoot,
            });
            execSync(`git commit -m "Update git_commit hash for v${version}"`, {
              stdio: 'inherit',
              cwd: projectRoot,
            });
            execSync('git push', { stdio: 'inherit', cwd: projectRoot });
            console.log('   ✅ Committed and pushed');
          }

          // Step 4: Build WASM
          if (!options.skipBuild) {
            console.log(
              '\n🔨 Step 4: Building WASM with reproducible build...',
            );
            console.log('   (This may take a few minutes)');

            // Check if Docker network exists, create if needed
            try {
              execSync('docker network inspect verifier-shared-network', {
                stdio: 'ignore',
              });
            } catch {
              console.log(
                '🌐 Creating Docker network: verifier-shared-network',
              );
              execSync('docker network create verifier-shared-network', {
                stdio: 'inherit',
              });
            }

            // Bootstrap if Docker files are missing
            const dockerFiles = [
              'Dockerfile',
              'Dockerfile.base',
              'docker-compose.yml',
            ];
            const missingDockerFiles = dockerFiles.filter(
              (file) => !fs.existsSync(path.join(projectRoot, file)),
            );

            if (missingDockerFiles.length > 0) {
              console.log('🔧 Bootstrapping Docker build files...');
              const network = thisCommand.parent?.opts().network || 'ic';
              const bootstrapCmd = canisterName
                ? `app-store-cli build ${canisterName} --bootstrap --network ${network}`
                : `app-store-cli build --bootstrap --network ${network}`;
              execSync(bootstrapCmd, {
                stdio: 'inherit',
                cwd: projectRoot,
              });
            }

            // Check if base image exists, build it if needed
            const mopsTomlPath = path.join(projectRoot, 'mops.toml');
            if (fs.existsSync(mopsTomlPath)) {
              const mopsContent = fs.readFileSync(mopsTomlPath, 'utf-8');
              const mocVersionMatch = mopsContent.match(/moc\s*=\s*"([^"]+)"/);
              if (mocVersionMatch) {
                const mocVersion = mocVersionMatch[1];
                const baseImageName = `motoko-build-base:moc-${mocVersion}`;

                try {
                  execSync(`docker image inspect ${baseImageName}`, {
                    stdio: 'ignore',
                  });
                } catch {
                  console.log(`🏗️  Building base image: ${baseImageName}`);
                  execSync('docker-compose build base', {
                    stdio: 'inherit',
                    cwd: projectRoot,
                  });
                }
              }
            }

            // Get network from parent command and pass it to build
            const network = thisCommand.parent?.opts().network || 'ic';
            const buildCmd = canisterName
              ? `app-store-cli build ${canisterName} --network ${network}`
              : `app-store-cli build --network ${network}`;
            execSync(buildCmd, {
              stdio: 'inherit',
              cwd: projectRoot,
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
            cwd: canisterPath,
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
      },
    );
}
