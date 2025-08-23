import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import prompts from 'prompts';
import yaml from 'js-yaml';
import {
  createCanisterType,
  getCurrentIdentityName,
  loadDfxIdentity,
} from '@prometheus-protocol/ic-js';

export function registerInitCommand(program: Command) {
  program
    .command('init')
    .description('Initializes a new prometheus.yml configuration file.')
    .action(async () => {
      const configPath = path.join(process.cwd(), 'prometheus.yml');

      if (fs.existsSync(configPath)) {
        console.log(
          '🟡 prometheus.yml already exists in this directory. Skipping.',
        );
        return;
      }

      console.log('🚀 Welcome to the Prometheus Protocol Publisher!');
      console.log(
        "   Let's create a complete submission package for your application.",
      );

      const responses = await prompts([
        // --- Core App Identity ---
        {
          type: 'text',
          name: 'id',
          message:
            'Enter a unique, reverse-domain namespace for your app (e.g., com.mycompany.app):',
          validate: (value) =>
            /^[a-z0-9]+(\.[a-z0-9]+)+$/.test(value)
              ? true
              : 'Namespace must be in reverse-domain format (e.g., com.example.app)',
        },
        {
          type: 'text',
          name: 'publisher',
          message: 'What is your publisher or developer name?',
        },
        {
          type: 'select',
          name: 'category',
          message: 'Pick a category for your application:',
          choices: [
            { title: 'Utilities', value: 'Utilities' },
            { title: 'AI / Machine Learning', value: 'AI' },
            { title: 'Development', value: 'Development' },
            { title: 'Gaming', value: 'Gaming' },
            { title: 'Finance', value: 'Finance' },
            { title: 'Social', value: 'Social' },
          ],
        },
        // --- Version-Specific Marketing ---
        {
          type: 'text',
          name: 'name',
          message:
            'What is the human-readable name of this version of your application?',
        },
        {
          type: 'text',
          name: 'description',
          message: 'Enter a short, one-sentence description for this version:',
        },
        {
          type: 'text',
          name: 'why_this_app',
          message:
            'Describe why a user should choose your app (longer description):',
        },
        {
          type: 'text',
          name: 'key_features',
          message: 'List the key features of your app (comma-separated):',
        },
        {
          type: 'text',
          name: 'tags',
          message:
            'Enter some relevant tags for discoverability (comma-separated):',
        },
        // --- URLs and Technical Info ---
        {
          type: 'text',
          name: 'repo_url',
          message:
            'Enter the public URL of your source code repository (e.g., GitHub):',
        },
        {
          type: 'text',
          name: 'canister_id',
          message:
            "Enter the canister ID of your 'official' instance for this version:",
        },
        {
          type: 'text',
          name: 'icon_url',
          message:
            'Enter the public URL for your app icon (e.g., a 512x512 PNG):',
        },
        {
          type: 'text',
          name: 'banner_url',
          message: 'Enter the public URL for your app banner/promo image:',
        },
      ]);

      // User might have cancelled the prompts (e.g., Ctrl+C)
      if (!responses.id || !responses.name) {
        console.log('\nInitialization cancelled. Exiting.');
        return;
      }

      // --- Structure the YAML data with all required fields ---
      const configData = {
        app: {
          id: responses.id,
        },
        submission: {
          name: responses.name,
          description: responses.description,
          publisher: responses.publisher,
          category: responses.category,
          repo_url: responses.repo_url,
          canister_id: responses.canister_id || '',
          mcp_path: '/mcp',
          why_this_app: responses.why_this_app,
          key_features: responses.key_features
            ? responses.key_features.split(',').map((s: string) => s.trim())
            : [],
          tags: responses.tags
            ? responses.tags.split(',').map((s: string) => s.trim())
            : [],
          visuals: {
            icon_url: responses.icon_url,
            banner_url: responses.banner_url,
            // --- Automatically populate gallery_images as requested ---
            gallery_images: responses.banner_url ? [responses.banner_url] : [],
          },
          // --- Core submission fields for the developer to complete MANUALLY ---
          git_commit: '',
          wasm_path: './path/to/your/canister.wasm',
        },
      };

      // --- Add clear, instructive comments ---
      const fileHeader = `# Prometheus Application Manifest
# This file defines a complete, auditable package for a single version of your app.
`;
      const appComment = `
# -----------------------------------------------------------------
# App Namespace
# -----------------------------------------------------------------
# This is the permanent, unique identifier for your application.
`;
      const submissionComment = `
# -----------------------------------------------------------------
# Version Submission Package
# -----------------------------------------------------------------
# This section contains all data for a specific version. This entire package
# will be submitted for review and locked to the audit of this version.
#
# The 'canister_id' field should point to your official, developer-endorsed
# instance of this version. It will be featured on the app store.
#
# The 'mcp_path' defaults to '/mcp'. Change this only if you need to support
# a legacy ('/sse') or custom server endpoint path.
#
# Your Final Action Items:
# 1. Fill in the 'git_commit' with the exact commit hash you want audited.
# 2. Update the 'wasm_path' to point to your compiled canister WASM file.
`;

      const yamlContent =
        appComment.trim() +
        '\n' +
        yaml.dump({ app: configData.app }, { indent: 2 }) +
        '\n' +
        submissionComment.trim() +
        '\n' +
        yaml.dump({ submission: configData.submission }, { indent: 2 });

      const finalFileContent = `${fileHeader}\n${yamlContent}`;

      fs.writeFileSync(configPath, finalFileContent);

      console.log('\n✅ Success! `prometheus.yml` has been created.');
      console.log(
        "   All metadata has been collected. Please complete the final two fields in the 'submission' section.",
      );
      console.log(
        '   When you are ready, run `prom-cli submit` to request an audit.',
      );

      try {
        console.log('\n🔗 Registering canister type on-chain...');
        const identityName = getCurrentIdentityName();
        const identity = loadDfxIdentity(identityName);
        console.log(`   As Principal: ${identity.getPrincipal().toText()}`);

        const status = await createCanisterType(identity, {
          namespace: responses.id,
          name: responses.name,
          description: responses.description,
          repo_url: responses.repo_url,
        });

        if (status === 'created') {
          console.log(
            '✅ Success! Your canister type has been registered on the Prometheus Registry.',
          );
        } else {
          console.log(
            'ℹ️ This canister type already exists on-chain. Continuing...',
          );
        }
        console.log(
          '\n   When you are ready, run `prom-cli submit` to request an audit.',
        );
      } catch (error) {
        console.error('\n❌ On-chain registration failed:');
        console.error(error);
        console.log(
          '\n   Your `prometheus.yml` file was created, but you will need to resolve this error before you can publish.',
        );
      }
    });
}
