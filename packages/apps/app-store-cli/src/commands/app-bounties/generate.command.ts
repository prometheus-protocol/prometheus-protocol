import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

// The single, definitive template for a new bounty.
const BLANK_BOUNTY_TEMPLATE = {
  title: '',
  short_description: '',
  details_markdown:
    '# Bounty Details\n\n## 1. Project Goal\n\n*A clear, concise statement of what this bounty aims to achieve.*\n\n## 2. Scope of Work\n\n*A detailed list of features and requirements.*\n\n- Feature A\n- Feature B\n- Integration with X\n\n## 3. Acceptance Criteria\n\n*How the DAO will judge a successful submission. Be specific.*\n\n- Must be deployed as an MCP server.\n- Code must be open-sourced under an MIT license.\n- Must pass all tests in the provided suite.\n\n## 4. How to Claim\n\n*Instructions for developers.*\n\n- Submit your work by opening a pull request against the `bounty-submissions` repository.\n- Post a link to your PR in the official Discord channel.',
  reward_amount: 0.0,
  reward_token: 'preMCPT',
  status: 'Open',
};

export function registerGenerateBountyCommand(program: Command) {
  program
    .command('generate <name>')
    .description('Generates a new, blank bounty YAML file.')
    .action((name) => {
      try {
        console.log('✨ Creating a new blank bounty template...');

        const outputData = {
          ...BLANK_BOUNTY_TEMPLATE,
          // A small helper to create a sensible default title from the filename.
          title: name
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (l) => l.toUpperCase()),
        };

        const slug = name
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
        const fileName = `bounty_${slug}.yml`;
        const filePath = path.join(process.cwd(), fileName);

        if (fs.existsSync(filePath)) {
          console.error(
            `❌ Error: A file named '${fileName}' already exists in this directory.`,
          );
          return;
        }

        const fileHeader = `# Prometheus App Bounty Configuration
#
# 1. Fill in the details for your new bounty below.
# 2. Publish this bounty to the canister using the command:
#      app-store app bounties publish ./${fileName}
`;
        const yamlContent = yaml.dump(outputData, { indent: 2 });
        fs.writeFileSync(filePath, `${fileHeader}\n${yamlContent}`);

        console.log(`✅ Success! Bounty template generated at ./${fileName}`);
      } catch (error) {
        console.error('\n❌ Operation failed:', error);
      }
    });
}
