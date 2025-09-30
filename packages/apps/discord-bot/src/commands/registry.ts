import { BaseCommand, CommandRegistry } from '../types/index.js';

export class CommandRegistryImpl implements CommandRegistry {
  private commands = new Map<string, BaseCommand>();

  register(command: BaseCommand): void {
    // Register main command name
    this.commands.set(command.name.toLowerCase(), command);
  }

  getCommand(name: string): BaseCommand | undefined {
    const lowerName = name.toLowerCase();
    return this.commands.get(lowerName);
  }

  getCommandsByCategory(category: string): BaseCommand[] {
    return Array.from(this.commands.values()).filter(
      (cmd) => cmd.category === category,
    );
  }

  getAllCommands(): BaseCommand[] {
    return Array.from(this.commands.values());
  }
}
