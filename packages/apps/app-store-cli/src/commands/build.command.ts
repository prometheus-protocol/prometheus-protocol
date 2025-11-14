import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import {
  REQUIRED_FILES,
  bootstrapBuildFiles,
  hasRequiredBuildFiles,
  validateMotokoProject,
  getMocVersionFromMopsToml,
  findDfxJson,
} from '@prometheus-protocol/reproducible-build';

export function registerBuildCommand(program: Command) {
  program
    .command('build [canister]')
    .description('Build your canister in a reproducible Docker environment')
    .option(
      '--bootstrap',
      'Bootstrap the reproducible build setup (creates docker-compose.yml, Dockerfile, build.sh)',
    )
    .option('--clean', 'Remove Docker images after build')
    .action(async (canisterName: string | undefined, options) => {
      try {
        console.log('🔨 Prometheus Protocol - Reproducible Build\n');

        // Find the project root (where dfx.json and mops.toml are)
        let projectRoot = process.cwd();
        let foundRoot = false;

        // Walk up the directory tree to find dfx.json
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
          process.exit(1);
        }

        console.log(`📂 Project root: ${projectRoot}`);

        // If canister name is provided, find its path from dfx.json
        let canisterPath = projectRoot;

        if (canisterName) {
          const dfxJsonPath = path.join(projectRoot, 'dfx.json');
          const dfxJson = JSON.parse(fs.readFileSync(dfxJsonPath, 'utf-8'));

          const canisterConfig = dfxJson.canisters?.[canisterName];
          if (!canisterConfig) {
            console.error(
              `❌ Error: Canister '${canisterName}' not found in dfx.json`,
            );
            process.exit(1);
          }

          // Get the main file path
          const mainFile = canisterConfig.main;
          if (!mainFile) {
            console.error(
              `❌ Error: Canister '${canisterName}' has no 'main' field in dfx.json`,
            );
            process.exit(1);
          }

          // Resolve the full path to the main file
          const mainFilePath = path.join(projectRoot, mainFile);

          // Walk up from the main file to find prometheus.yml
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

          // Check project root as well
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
            console.error(
              `   Searched from ${path.dirname(mainFilePath)} up to ${projectRoot}`,
            );
            process.exit(1);
          }

          console.log(`📦 Canister: ${canisterName}`);
          console.log(`📁 Canister path: ${canisterPath}`);
        } else {
          // No canister specified, use current directory (backward compatibility)
          canisterPath = process.cwd();
        }

        const mopsTomlPath = path.join(projectRoot, 'mops.toml');

        if (!fs.existsSync(mopsTomlPath)) {
          console.error(
            '❌ Error: mops.toml not found in project root. Please create one with your toolchain version:',
          );
          console.error('\n[toolchain]');
          console.error(
            'moc = "0.16.0"  # Replace with your desired version\n',
          );
          process.exit(1);
        }

        // Read moc version from mops.toml
        const mopsContent = fs.readFileSync(mopsTomlPath, 'utf-8');
        const mocVersionMatch = mopsContent.match(/moc\s*=\s*"([^"]+)"/);
        if (!mocVersionMatch) {
          console.error(
            '❌ Error: Could not find moc version in mops.toml. Please add:',
          );
          console.error('\n[toolchain]');
          console.error(
            'moc = "0.16.0"  # Replace with your desired version\n',
          );
          process.exit(1);
        }
        const mocVersion = mocVersionMatch[1];
        console.log(`📦 Detected Motoko compiler version: ${mocVersion}\n`);

        // Use .prometheus directory for build files
        const buildDir = path.join(projectRoot, '.prometheus');
        if (!fs.existsSync(buildDir)) {
          fs.mkdirSync(buildDir, { recursive: true });
        }

        // Change to build directory for Docker operations
        process.chdir(buildDir);

        // Check if reproducible build files exist in build directory
        const missingFiles = REQUIRED_FILES.filter(
          (file) => !fs.existsSync(path.join(buildDir, file)),
        );

        if (missingFiles.length > 0) {
          if (options.bootstrap) {
            console.log('🔧 Bootstrapping reproducible build setup...\n');

            // Validate it's a Motoko project
            // For monorepos, check the canister path (cwd) for src, not the project root
            const validation = validateMotokoProject(canisterPath);
            if (!validation.valid) {
              console.error('❌ Error: Not a valid Motoko project. Missing:');
              validation.missing.forEach((file) => console.log(`   - ${file}`));
              process.exit(1);
            }

            bootstrapBuildFiles({ projectPath: buildDir });
            console.log('✅ Setup complete!\n');
          } else {
            console.log('⚠️  Reproducible build files missing:');
            missingFiles.forEach((file) => console.log(`   - ${file}`));
            console.log('\nRun with --bootstrap to create them:');
            console.log('  app-store-cli build --bootstrap\n');
            process.exit(1);
          }
        }

        // Update docker-compose.yml with current moc version from mops.toml
        updateDockerComposeVersion(mocVersion, buildDir);

        // Check if Docker is available
        try {
          execSync('docker --version', { stdio: 'ignore' });
        } catch (error) {
          console.error(
            '❌ Error: Docker is not installed or not running. Please install Docker:',
          );
          console.error('   https://docs.docker.com/get-docker/\n');
          process.exit(1);
        }

        // Create output directory in project root if it doesn't exist
        const outDir = path.join(projectRoot, 'out');
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
          console.log('📁 Created output directory: ./out\n');
        }

        // Copy mops.toml to build directory
        const mopsSource = path.join(projectRoot, 'mops.toml');
        const mopsDest = path.join(buildDir, 'mops.toml');
        fs.copyFileSync(mopsSource, mopsDest);

        // Copy canister src to build directory (always refresh for latest changes)
        const srcInBuildDir = path.join(buildDir, 'src');
        const srcInCanister = path.join(canisterPath, 'src');

        // Remove old src if exists to ensure fresh copy
        if (fs.existsSync(srcInBuildDir)) {
          fs.rmSync(srcInBuildDir, { recursive: true, force: true });
        }

        try {
          // Copy the src directory to build context
          fs.cpSync(srcInCanister, srcInBuildDir, { recursive: true });
          console.log(
            '📦 Copied src to build context: ' +
              path.relative(projectRoot, srcInCanister) +
              '\n',
          );
        } catch (error) {
          console.error('❌ Error copying src directory:', error);
          process.exit(1);
        }

        // Run the build
        console.log('🐳 Starting Docker build...');
        console.log(
          '   This may take several minutes on the first run (downloading base images)...\n',
        );

        try {
          // Update docker-compose to mount project root's out directory
          const composeFile = path.join(buildDir, 'docker-compose.yml');
          let composeContent = fs.readFileSync(composeFile, 'utf-8');
          composeContent = composeContent.replace(
            /- \.\/out:\/project\/out/g,
            `- ${outDir}:/project/out`,
          );
          fs.writeFileSync(composeFile, composeContent);

          // Build the Docker image with cache for faster local builds
          // Pass GITHUB_TOKEN if available to avoid rate limiting
          const buildCmd = process.env.GITHUB_TOKEN
            ? `docker-compose build --build-arg GITHUB_TOKEN=${process.env.GITHUB_TOKEN}`
            : 'docker-compose build';
          execSync(buildCmd, { stdio: 'inherit', cwd: buildDir });

          // Run the build
          execSync('docker-compose run --rm wasm', {
            stdio: 'inherit',
            cwd: buildDir,
          });
        } catch (error: any) {
          if (error.status === 130) {
            // User cancelled with Ctrl+C
            console.log('\n⚠️  Build cancelled by user');
          }
          throw error;
        } finally {
          // Return to project root
          process.chdir(projectRoot);
        }

        // For monorepos, copy the WASM from project root to canister directory
        if (canisterPath !== projectRoot) {
          const wasmInRoot = path.join(
            projectRoot,
            'out',
            'out_Linux_x86_64.wasm',
          );
          const canisterOutDir = path.join(canisterPath, 'out');
          const wasmInCanister = path.join(
            canisterOutDir,
            'out_Linux_x86_64.wasm',
          );

          if (fs.existsSync(wasmInRoot)) {
            // Create out directory in canister path if it doesn't exist
            if (!fs.existsSync(canisterOutDir)) {
              fs.mkdirSync(canisterOutDir, { recursive: true });
            }
            // Copy WASM to canister directory
            fs.copyFileSync(wasmInRoot, wasmInCanister);
            console.log(
              '📦 Copied WASM to ' +
                path.relative(projectRoot, wasmInCanister) +
                '\n',
            );
          }
        }

        // Clean up if requested
        if (options.clean) {
          console.log('\n🧹 Cleaning up Docker images...');
          try {
            execSync('docker-compose down --rmi local', { stdio: 'inherit' });
          } catch (error) {
            console.warn('⚠️  Warning: Could not remove Docker images');
          }
        }

        console.log('\n✅ Build completed successfully!');
        console.log(
          '\n💡 Next steps:\n   1. Test your WASM locally\n   2. Publish with: app-store-cli publish <version>\n',
        );
      } catch (error: any) {
        console.error(`\n❌ Build failed: ${error.message}`);
        process.exit(1);
      }
    });
}

function updateDockerComposeVersion(mocVersion: string, buildDir: string) {
  const dockerComposePath = path.join(buildDir, 'docker-compose.yml');
  if (!fs.existsSync(dockerComposePath)) return;

  let dockerCompose = fs.readFileSync(dockerComposePath, 'utf-8');

  // Update the moc version in the x-base-image section
  const currentVersion = dockerCompose.match(/moc:\s*&moc\s+([^\s\n]+)/)?.[1];

  if (currentVersion && currentVersion !== mocVersion) {
    dockerCompose = dockerCompose.replace(
      /moc:\s*&moc\s+[^\s\n]+/,
      `moc: &moc ${mocVersion}`,
    );
    // Update the base image name to use local naming (motoko-build-base:moc-X.X.X)
    dockerCompose = dockerCompose.replace(
      /name:\s*&base_name\s+'[^']+'/,
      `name: &base_name 'motoko-build-base:moc-${mocVersion}'`,
    );
    fs.writeFileSync(dockerComposePath, dockerCompose);
    console.log(
      `📝 Updated docker-compose.yml MOC_VERSION: ${currentVersion} → ${mocVersion}\n`,
    );
  }
}
