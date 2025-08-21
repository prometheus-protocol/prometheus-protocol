import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import crypto from 'node:crypto';

const TEMPLATE = {
  outcome: 'Verify | Reject',
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

export function registerDaoGenerateBallotCommand(program: Command) {
  program
    .command('dao:generate-ballot')
    .description(
      'Generates a YAML ballot for finalizing the verification of the WASM in prometheus.yml.',
    )
    .action(() => {
      try {
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
        const wasmId = crypto
          .createHash('sha256')
          .update(wasmBuffer)
          .digest('hex');

        const outputData = {
          wasm_id: wasmId,
          ...TEMPLATE,
        };

        const fileName = 'dao_decision_ballot.yml';
        const filePath = path.join(process.cwd(), fileName);

        const fileHeader = `# Prometheus DAO Decision Ballot
#
# Target WASM ID: ${wasmId}
#
# 1. Change 'outcome' to either 'Pass' or 'Fail'.
# 2. Fill in the metadata fields with the required information.
# 3. Submit this file using the command:
#      prom-cli dao:finalize --file ./${fileName}
`;
        const yamlContent = yaml.dump(outputData, { indent: 2 });
        fs.writeFileSync(filePath, `${fileHeader}\n${yamlContent}`);

        console.log(`✅ Success! Ballot template generated at ./${fileName}`);
      } catch (error) {
        console.error('\n❌ Operation failed:', error);
      }
    });
}
