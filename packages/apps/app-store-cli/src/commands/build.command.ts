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
    .command('build')
    .description('Build your canister in a reproducible Docker environment')
    .option(
      '--bootstrap',
      'Bootstrap the reproducible build setup (creates docker-compose.yml, Dockerfile, build.sh)',
    )
    .option('--clean', 'Remove Docker images after build')
    .action(async (options) => {
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
            '❌ Error: dfx.json not found. Please run this command from your canister project directory or a subdirectory of your IC project.',
          );
          process.exit(1);
        }

        const dfxJsonPath = path.join(projectRoot, 'dfx.json');
        const mopsTomlPath = path.join(projectRoot, 'mops.toml');

        console.log(`📂 Project root: ${projectRoot}`);

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

        // Change to project root for build operations
        process.chdir(projectRoot);

        // Check if reproducible build files exist in project root
        const missingFiles = REQUIRED_FILES.filter(
          (file) => !fs.existsSync(path.join(projectRoot, file)),
        );

        if (missingFiles.length > 0) {
          if (options.bootstrap) {
            console.log('🔧 Bootstrapping reproducible build setup...\n');

            // Validate it's a Motoko project
            const validation = validateMotokoProject(projectRoot);
            if (!validation.valid) {
              console.error('❌ Error: Not a valid Motoko project. Missing:');
              validation.missing.forEach((file) => console.log(`   - ${file}`));
              process.exit(1);
            }

            bootstrapBuildFiles({ projectPath: projectRoot });
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
        updateDockerComposeVersion(mocVersion);

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

        // Create output directory if it doesn't exist
        if (!fs.existsSync('out')) {
          fs.mkdirSync('out', { recursive: true });
          console.log('📁 Created output directory: ./out\n');
        }

        // Run the build
        console.log('🐳 Starting Docker build...');
        console.log(
          '   This may take several minutes on the first run (downloading base images)...\n',
        );

        try {
          // Build the Docker image without cache to ensure fresh build
          // Pass GITHUB_TOKEN if available to avoid rate limiting
          const buildCmd = process.env.GITHUB_TOKEN
            ? `docker-compose build --no-cache --build-arg GITHUB_TOKEN=${process.env.GITHUB_TOKEN}`
            : 'docker-compose build --no-cache';
          execSync(buildCmd, { stdio: 'inherit' });

          // Run the build
          execSync('docker-compose run --rm wasm', { stdio: 'inherit' });
        } catch (error: any) {
          if (error.status === 130) {
            // User cancelled with Ctrl+C
            console.log('\n⚠️  Build cancelled by user');
            process.exit(0);
          }
          throw error;
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

function updateDockerComposeVersion(mocVersion: string) {
  if (!fs.existsSync('docker-compose.yml')) return;

  let dockerCompose = fs.readFileSync('docker-compose.yml', 'utf-8');

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
    fs.writeFileSync('docker-compose.yml', dockerCompose);
    console.log(
      `📝 Updated docker-compose.yml MOC_VERSION: ${currentVersion} → ${mocVersion}\n`,
    );
  }
}
