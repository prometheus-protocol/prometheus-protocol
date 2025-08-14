import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import prompts from 'prompts';
import yaml from 'js-yaml';

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

      console.log('🚀 Welcome to the Prometheus App Publisher!');
      console.log("   Let's set up your configuration file.");

      const responses = await prompts([
        {
          type: 'text',
          name: 'name',
          message: 'What is the human-readable name of your application?',
          initial: 'My Awesome App',
        },
        {
          type: 'text',
          name: 'namespace',
          message: 'Enter a unique, reverse-domain namespace for your app:',
          initial: 'com.mycompany.app',
        },
        {
          type: 'text',
          name: 'frontend_url',
          message: 'What is the official production URL for your frontend?',
          initial: 'https://myapp.com',
        },
      ]);

      // User might have cancelled the prompts (e.g., Ctrl+C)
      if (!responses.name || !responses.namespace || !responses.frontend_url) {
        console.log('\nInitialization cancelled. Exiting.');
        return;
      }

      const yamlContent = yaml.dump(responses);
      fs.writeFileSync(configPath, yamlContent);

      console.log('\n✅ Success! `prometheus.yml` has been created.');
      console.log(
        '   You can now run `@prometheus-protocol/cli request-verification`.',
      );
    });
}
