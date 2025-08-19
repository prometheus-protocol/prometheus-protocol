import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import crypto from 'node:crypto';

// We add the new `data_safety_v1` template to our collection.
const TEMPLATES: Record<string, Record<string, any>> = {
  security_v1: {
    '126:audit_type': 'security_v1',
    score: 0, // A numerical score from 1-100
    summary: 'A one-sentence summary of the findings.',
    issues_found: [
      {
        severity: 'critical | high | medium | low | informational',
        description: 'Describe the issue here.',
      },
    ],
  },
  build_reproducibility_v1: {
    '126:audit_type': 'build_reproducibility_v1',
    // The auditor MUST declare the outcome. This is the most important field.
    status: 'success | failure',
    failure_reason: 'If status is "failure", provide a brief explanation here.',
  },
  data_safety_v1: {
    '126:audit_type': 'data_safety_v1',
    score: 0, // A numerical score from 1-100
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

export function registerAttestGenerateCommand(program: Command) {
  program
    .command('attest:generate')
    .description(
      'Generates a YAML template for a specific audit type based on the local prometheus.yml.',
    )
    .requiredOption(
      '--type <string>',
      'The type of audit to generate a template for (e.g., "security_v1").',
    )
    // --- The --wasm-hash option has been REMOVED ---
    .action((options) => {
      try {
        // --- NEW LOGIC: Automatically find and hash the WASM ---
        const prometheusPath = path.join(process.cwd(), 'prometheus.yml');
        if (!fs.existsSync(prometheusPath)) {
          console.error(
            '❌ Error: `prometheus.yml` not found. Please run this command in a project with a valid manifest.',
          );
          return;
        }

        const manifest = yaml.load(
          fs.readFileSync(prometheusPath, 'utf-8'),
        ) as Manifest;

        if (!manifest.submission || !manifest.submission.wasm_path) {
          console.error(
            '❌ Error: Manifest is incomplete. `wasm_path` is missing in the `submission` section.',
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
        const wasmHash = crypto
          .createHash('sha256')
          .update(wasmBuffer)
          .digest('hex');
        // --- END NEW LOGIC ---

        const template = TEMPLATES[options.type];
        if (!template) {
          console.error(`❌ Error: Unknown audit type "${options.type}".`);
          console.log(
            `   Available types: ${Object.keys(TEMPLATES).join(', ')}`,
          );
          return;
        }

        const outputData = {
          wasm_hash: wasmHash, // Use the calculated hash
          metadata: template,
        };

        const fileName = `${options.type}_attestation.yml`;
        const filePath = path.join(process.cwd(), fileName);

        const fileHeader = `# Prometheus Attestation Manifest for Audit Type: ${options.type}
#
# Target WASM Hash: ${wasmHash}
#
# Please fill in all the placeholder values below.
# When you are ready, submit this file using the command:
#   prom-cli attest:submit --file ./${fileName}
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
