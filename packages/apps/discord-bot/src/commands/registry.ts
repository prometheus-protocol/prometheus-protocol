import { BaseCommand, CommandRegistry } from '../types/index.js';

export class CommandRegistryImpl implements CommandRegistry {
  private commands = new Map<string, BaseCommand>();
  private aliases = new Map<string, string>();

  register(command: BaseCommand): void {
    // Register main command name
    this.commands.set(command.name.toLowerCase(), command);
    
    // Register aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.set(alias.toLowerCase(), command.name.toLowerCase());
      }
    }
  }

  getCommand(name: string): BaseCommand | undefined {
    const lowerName = name.toLowerCase();
    
    // Check direct command name
    let command = this.commands.get(lowerName);
    if (command) return command;
    
    // Check aliases
    const aliasTarget = this.aliases.get(lowerName);
    if (aliasTarget) {
      return this.commands.get(aliasTarget);
    }
    
    return undefined;
  }

  getCommandsByCategory(category: string): BaseCommand[] {
    return Array.from(this.commands.values())
      .filter(cmd => cmd.category === category);
  }

  getAllCommands(): BaseCommand[] {
    return Array.from(this.commands.values());
  }
}