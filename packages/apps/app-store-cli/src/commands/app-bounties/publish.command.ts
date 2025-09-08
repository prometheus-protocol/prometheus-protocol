import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { createAppBounty, updateAppBounty } from '@prometheus-protocol/ic-js';
import {
  getCurrentIdentityName,
  loadDfxIdentity,
} from '../../identity.node.js';

export function registerPublishBountyCommand(program: Command) {
  program
    .command('publish <file>')
    .description('Creates or updates an app bounty from a YAML file.')
    .action(async (file) => {
      try {
        const filePath = path.resolve(process.cwd(), file);
        if (!fs.existsSync(filePath)) {
          console.error(`❌ Error: File not found at ${filePath}`);
          return; // Exit the action early.
        }

        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const bountyData = yaml.load(fileContent) as any;

        const identityName = getCurrentIdentityName();
        console.log(`\n🔑 Using current dfx identity: '${identityName}'`);
        const identity = loadDfxIdentity(identityName);

        if (bountyData.id) {
          // --- UPDATE PATH ---
          console.log(
            `   📞 Updating existing bounty with ID: ${bountyData.id}...`,
          );
          await updateAppBounty(identity, {
            ...bountyData,
            id: BigInt(bountyData.id), // Ensure ID is a bigint for the call
          });
          console.log('\n🎉 Success! The bounty has been updated on-chain.');
        } else {
          // --- CREATE PATH ---
          console.log('   📞 Creating a new bounty on-chain...');
          const newBountyId = await createAppBounty(identity, bountyData);
          console.log(
            `\n🎉 Success! New bounty created with ID: ${newBountyId}`,
          );

          // Write the new ID back to the YAML file for future updates
          bountyData.id = Number(newBountyId); // YAML dump works better with number
          const updatedYamlContent = yaml.dump(bountyData, { indent: 2 });

          // Preserve comments at the top of the file
          const fileHeader = fileContent.split('---')[0].trim();
          const finalContent = fileHeader.includes('title:')
            ? `# Bounty Configuration\n${updatedYamlContent}`
            : `${fileHeader}\n${updatedYamlContent}`;

          fs.writeFileSync(filePath, finalContent);
          console.log(`   📝 The new ID has been written back to ${file}.`);
        }
      } catch (error) {
        console.error('\n❌ Operation failed:', error);
      }
    });
}
