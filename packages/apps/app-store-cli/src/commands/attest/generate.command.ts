import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import crypto from 'node:crypto';

// We add the new `data_safety_v1` template to our collection.
const TEMPLATES: Record<string, Record<string, any>> = {
  app_info_v1: {
    '126:audit_type': 'app_info_v1',
    name: "Your App's Display Name",
    publisher: 'Your Company or Developer Name',
    canister_id: 'Your App Canister ID (e.g., aaaaa-aa)',
    mcp_path: '/mcp',
    category: 'App Store Category (e.g., Productivity, Games)',
    icon_url: '/path/to/your/icon.png',
    banner_url: '/path/to/your/banner.png',
    gallery_images: ['/path/to/screenshot1.png', '/path/to/screenshot2.png'],
    description:
      "A detailed, paragraph-long description of what your app does and who it's for.",
    key_features: [
      'Feature 1: Describe a key capability',
      'Feature 2: Another cool thing it does',
      'Feature 3: A third selling point',
    ],
    why_this_app:
      'A short, compelling reason why users should choose your app over others.',
    tags: ['Keyword1', 'Keyword2', 'SearchTerm'],
  },
  build_reproducibility_v1: {
    '126:audit_type': 'build_reproducibility_v1',
    // The auditor MUST declare the outcome. This is the most important field.
    status: 'success | failure',
    git_commit: 'The exact commit hash used for the build.',
    repo_url: 'The URL of the repository used for the build.',
    canister_id: 'The canister ID of the deployed version.',
    failure_reason: 'If status is "failure", provide a brief explanation here.',
  },
  data_safety_v1: {
    '126:audit_type': 'data_safety_v1',
    overall_description:
      "A high-level, one-sentence summary of the app's data handling practices.",
    data_points: [
      {
        category: 'Data Collection', // e.g., Data Collection, Data Sharing, Security Practices, Data Retention
        title: 'Example Point Title (e.g., Temporary Location Use)',
        description: 'A detailed explanation of this specific data practice.',
      },
      {
        category: 'Security Practices',
        title: 'Another Example (e.g., On-Chain Transparency)',
        description: "Describe another key aspect of the app's data safety.",
      },
    ],
  },
  tools_v1: {
    '126:audit_type': 'tools_v1',
    tools: [
      {
        name: 'example_tool_name',
        cost: '0.00', // Use a string to preserve decimal precision
        token: 'TOKEN_SYMBOL', // e.g., ICP, PMP, ckUSDT
        description:
          'A clear, human-readable description of what this tool does and when the cost is incurred.',
      },
    ],
  },
};

interface Manifest {
  submission: {
    wasm_path: string;
  };
}

export function registerGenerateAttestationCommand(program: Command) {
  program
    // 1. Use positional arguments: <type> is required, [wasm_hash] is optional.
    .command('generate <type> [wasm_hash]')
    .description(
      'Generates a YAML template. Reads WASM hash from prometheus.yml if not provided.',
    )
    // 2. The action now receives both arguments directly.
    .action((type, wasm_hash) => {
      try {
        let targetWasmHash = wasm_hash;

        // 3. If wasm_hash is missing, try to load it from the config file.
        if (!targetWasmHash) {
          console.log(
            'ℹ️ WASM hash not provided, attempting to read from prometheus.yml...',
          );
          const prometheusPath = path.join(process.cwd(), 'prometheus.yml');
          if (!fs.existsSync(prometheusPath)) {
            console.error(
              '❌ Error: WASM hash not provided and prometheus.yml not found.',
            );
            console.error(
              '   Run this command from the project root or specify the WASM hash manually.',
            );
            return;
          }

          const manifest = yaml.load(
            fs.readFileSync(prometheusPath, 'utf-8'),
          ) as Manifest;

          if (!manifest.submission?.wasm_path) {
            console.error(
              '❌ Error: `wasm_path` is missing in the `submission` section of prometheus.yml.',
            );
            return;
          }

          const wasmFilePath = path.resolve(
            process.cwd(),
            manifest.submission.wasm_path,
          );
          if (!fs.existsSync(wasmFilePath)) {
            console.error(
              `❌ Error: WASM file not found at path: ${wasmFilePath}`,
            );
            return;
          }

          const wasmBuffer = fs.readFileSync(wasmFilePath);
          targetWasmHash = crypto
            .createHash('sha256')
            .update(wasmBuffer)
            .digest('hex');
        }

        const template = TEMPLATES[type];
        if (!template) {
          console.error(`❌ Error: Unknown audit type "${type}".`);
          console.log(
            `   Available types: ${Object.keys(TEMPLATES).join(', ')}`,
          );
          return;
        }

        const outputData = {
          wasm_hash: targetWasmHash, // 4. Use the resolved targetWasmHash
          metadata: template,
        };

        const fileName = `${type}_attestation.yml`;
        const filePath = path.join(process.cwd(), fileName);

        // 5. Update the help text in the generated file to use the new command structure.
        const fileHeader = `# Prometheus Attestation Manifest for Audit Type: ${type}
#
# Target WASM Hash: ${targetWasmHash}
#
# Please fill in all the placeholder values below.
# When you are ready, submit this file using the command:
#   app-store attest submit ./${fileName}
`;

        const yamlContent = yaml.dump(outputData, { indent: 2 });
        fs.writeFileSync(filePath, `${fileHeader}\n${yamlContent}`);

        console.log(`✅ Success! Template generated at ./${fileName}`);
        console.log(
          '   Please edit the file to complete your attestation details.',
        );
      } catch (error) {
        console.error('\n❌ Operation failed:');
        console.error(error);
      }
    });
}
