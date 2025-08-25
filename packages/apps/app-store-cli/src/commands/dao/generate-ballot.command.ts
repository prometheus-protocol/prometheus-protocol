import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import crypto from 'node:crypto';

const TEMPLATE = {
  outcome: 'Verified | Rejected',
  metadata: {
    decision_summary:
      "A brief, human-readable summary of the DAO's reasoning for this decision.",
    proposal_url:
      'A URL to the on-chain proposal or discussion that authorized this action.',
  },
};

interface Manifest {
  submission: {
    wasm_path: string;
  };
}

export function registerGenerateBallotCommand(program: Command) {
  program
    // 1. Use an optional positional argument for the wasm_id.
    .command('generate-ballot [wasm_id]')
    .description(
      'Generates a YAML ballot. Reads WASM ID from prometheus.yml if not provided.',
    )
    // 2. The action now receives the optional argument.
    .action((wasm_id) => {
      try {
        let targetWasmId = wasm_id;

        // 3. If wasm_id is missing, fall back to reading the local project files.
        if (!targetWasmId) {
          console.log(
            'ℹ️ WASM ID not provided, attempting to read from prometheus.yml...',
          );
          const prometheusPath = path.join(process.cwd(), 'prometheus.yml');
          if (!fs.existsSync(prometheusPath)) {
            console.error(
              '❌ Error: WASM ID not provided and prometheus.yml not found.',
            );
            console.error(
              '   Run this command from the project root or specify the WASM ID manually.',
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
          targetWasmId = crypto
            .createHash('sha256')
            .update(wasmBuffer)
            .digest('hex');
        }

        const outputData = {
          wasm_id: targetWasmId, // 4. Use the resolved targetWasmId
          ...TEMPLATE,
        };

        const fileName = 'dao_decision_ballot.yml';
        const filePath = path.join(process.cwd(), fileName);

        // 5. Update the help text in the generated file to use the new command structure.
        const fileHeader = `# Prometheus DAO Decision Ballot
#
# Target WASM ID: ${targetWasmId}
#
# 1. Change 'outcome' to either 'Verify' or 'Reject'.
# 2. Fill in the metadata fields with the required information.
# 3. Submit this file using the command:
#      app-store dao finalize ./${fileName}
`;
        const yamlContent = yaml.dump(outputData, { indent: 2 });
        fs.writeFileSync(filePath, `${fileHeader}\n${yamlContent}`);

        console.log(`✅ Success! Ballot template generated at ./${fileName}`);
      } catch (error) {
        console.error('\n❌ Operation failed:', error);
      }
    });
}
