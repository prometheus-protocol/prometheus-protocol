import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import prompts from 'prompts';
import yaml from 'js-yaml';

export function registerInitCommand(program: Command) {
  program
    .command('init')
    .description('Initializes a new prometheus.yml configuration file.')
    .option('-y, --yes', 'Use default values for all prompts')
    .action(async (options) => {
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

      // Handle Ctrl+C gracefully
      const onCancel = () => {
        console.log('\n\n⚠️  Operation cancelled by user. Exiting...');
        process.exit(0);
      };

      let responses: any;

      if (options.yes) {
        // Use default values when -y flag is provided
        responses = {
          namespace: 'com.example.app',
          publisher: 'Example Publisher',
          category: 'Utilities',
          name: 'My Application',
          description: 'A sample application built with Prometheus Protocol',
          why_this_app:
            'This app provides essential functionality for users who need reliable tools.',
          key_features: 'Feature 1, Feature 2, Feature 3',
          tags: 'productivity, utility, tool',
          repo_url: 'https://github.com/example/my-app',
          icon_url: 'https://example.com/icon.png',
          banner_url: 'https://example.com/banner.png',
          deployment_type: 'global',
        };

        console.log('📋 Using default configuration...');
      } else {
        responses = await prompts(
          [
            {
              type: 'text',
              name: 'namespace',
              message:
                'Enter a unique, reverse-domain namespace for your app (e.g., com.mycompany.app):',
              validate: (value) =>
                // --- THE FIX ---
                // The character class [a-z0-9] has been changed to [a-z0-9-]
                // to allow hyphens within each segment of the namespace.
                /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(value)
                  ? true
                  : 'Namespace must be in reverse-domain format (e.g., com.my-company.app)',
            },
            // ... (all other prompts remain the same)
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
            {
              type: 'text',
              name: 'name',
              message:
                'What is the human-readable name of this version of your application?',
            },
            {
              type: 'text',
              name: 'description',
              message:
                'Enter a short, one-sentence description for this version:',
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
            {
              type: 'text',
              name: 'repo_url',
              message:
                'Enter the public URL of your source code repository (e.g., GitHub):',
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
            {
              type: 'select',
              name: 'deployment_type',
              message: 'Choose your deployment type:',
              choices: [
                {
                  title: 'Global - Shared instance (recommended for most apps)',
                  description:
                    'Your app runs on a single canister and user data is separated by principal ids.',
                  value: 'global',
                },
                {
                  title: 'Provisioned - Dedicated instance (for wallet apps)',
                  description:
                    'Each user gets their own instance of your app, and each app has its own dedicated principal id.',
                  value: 'provisioned',
                },
              ],
              hint: 'Global deployment is recommended for most applications unless you need a dedicated principal id per user.',
            },
          ],
          { onCancel },
        );
      }

      if (!responses.namespace || !responses.name) {
        console.log('\nInitialization cancelled. Exiting.');
        return;
      }

      // 2. Structure the YAML data with the top-level 'namespace' key.
      const configData = {
        namespace: responses.namespace,
        submission: {
          name: responses.name,
          description: responses.description,
          publisher: responses.publisher,
          category: responses.category,
          deployment_type: responses.deployment_type,
          repo_url: responses.repo_url,
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
            gallery_images: responses.banner_url ? [responses.banner_url] : [],
          },
          git_commit: '',
          wasm_path: './path/to/your/canister.wasm',
        },
      };

      const fileHeader = `# Prometheus Application Manifest\n`;
      const namespaceComment = `# This is the permanent, unique identifier for your application.`;
      const submissionComment = `# This section contains all data for a specific version. This entire package will be submitted for review and locked to the audit of this version.`;
      const deploymentComment = `# deployment_type: 'global' (shared infrastructure, recommended) or 'provisioned' (dedicated resources)`;

      // 3. Generate the YAML content with the new structure.
      const yamlContent =
        `${namespaceComment}\n` +
        yaml.dump({ namespace: configData.namespace }, { indent: 2 }) +
        `\n${submissionComment}\n` +
        `${deploymentComment}\n` +
        yaml.dump({ submission: configData.submission }, { indent: 2 });

      fs.writeFileSync(configPath, fileHeader + yamlContent);

      console.log('\n✅ Success! `prometheus.yml` has been created.');

      if (options.yes) {
        console.log(
          '📝 Default configuration applied. Please review and update:',
        );
        console.log(
          '   - namespace: Update to your actual reverse-domain identifier',
        );
        console.log('   - All fields: Customize to match your application');
      }

      console.log(
        "   Please complete the 'git_commit' and 'wasm_path' fields.",
      );
      console.log('\n📖 Deployment Types:');
      console.log(
        '   • Global: Shared infrastructure with automatic scaling (recommended)',
      );
      console.log(
        '   • Provisioned: Dedicated resources for high-performance needs',
      );
      // 4. Update the help text to use the correct command name.
      console.log(
        '\n   When you are ready, run `app-store publish` to submit your app for review.',
      );
    });
}
