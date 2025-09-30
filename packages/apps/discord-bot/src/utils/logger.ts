/**
 * Centralized logging system for the Discord bot
 * Provides consistent formatting and structured logging across all services
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  service: string;
  userId?: string;
  channelId?: string;
  guildId?: string;
  action?: string;
  error?: any;
  [key: string]: any; // Allow additional properties
}

class Logger {
  private static instance: Logger;
  private currentLevel: LogLevel = LogLevel.INFO;
  private colors = {
    debug: '\x1b[36m', // cyan
    info: '\x1b[32m', // green
    warn: '\x1b[33m', // yellow
    error: '\x1b[31m', // red
    reset: '\x1b[0m',
  };

  private serviceEmojis: Record<string, string> = {
    Bot: '🤖',
    Chat: '💬',
    LLM: '🧠',
    MCP: '🔌',
    Auth: '🔐',
    DB: '🗄️',
    Scheduler: '⏰',
    ConnectionManager: '🔗',
    ToolInvoker: '🛠️',
    Registry: '📋',
    Parser: '🔍',
    Callback: '🔄',
    OpenAI: '🤖',
    Default: '📝',
  };

  constructor() {
    // Set log level from environment
    const envLevel = process.env.LOG_LEVEL?.toLowerCase();
    switch (envLevel) {
      case 'debug':
        this.currentLevel = LogLevel.DEBUG;
        break;
      case 'info':
        this.currentLevel = LogLevel.INFO;
        break;
      case 'warn':
        this.currentLevel = LogLevel.WARN;
        break;
      case 'error':
        this.currentLevel = LogLevel.ERROR;
        break;
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.currentLevel;
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): string {
    const timestamp = new Date().toISOString();
    const levelStr = LogLevel[level].padEnd(5);
    const emoji = context?.service
      ? this.serviceEmojis[context.service] || this.serviceEmojis.Default
      : '📝';
    const service = context?.service ? `[${context.service}]` : '';
    const action = context?.action ? ` ${context.action}:` : '';

    let formatted = `${emoji} ${service}${action} ${message}`;

    if (context?.userId) {
      formatted += ` (user: ${context.userId})`;
    }

    if (context?.metadata && Object.keys(context.metadata).length > 0) {
      formatted += ` ${JSON.stringify(context.metadata)}`;
    }

    return formatted;
  }

  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const formatted = this.formatMessage(LogLevel.DEBUG, message, context);
    console.log(`${this.colors.debug}[DEBUG]${this.colors.reset} ${formatted}`);
  }

  info(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const formatted = this.formatMessage(LogLevel.INFO, message, context);
    console.log(`${this.colors.info}[INFO]${this.colors.reset} ${formatted}`);
  }

  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.WARN)) return;

    const formatted = this.formatMessage(LogLevel.WARN, message, context);
    console.warn(`${this.colors.warn}[WARN]${this.colors.reset} ${formatted}`);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    const formatted = this.formatMessage(LogLevel.ERROR, message, context);
    console.error(
      `${this.colors.error}[ERROR]${this.colors.reset} ${formatted}`,
    );

    if (error) {
      console.error(
        `${this.colors.error}[ERROR]${this.colors.reset} Stack trace:`,
        error.stack,
      );
    }
  }

  // Convenience methods for specific services
  bot(message: string, context?: Omit<LogContext, 'service'>): void {
    this.info(message, { ...context, service: 'Bot' });
  }

  chat(message: string, context?: Omit<LogContext, 'service'>): void {
    this.info(message, { ...context, service: 'Chat' });
  }

  llm(message: string, context?: Omit<LogContext, 'service'>): void {
    this.info(message, { ...context, service: 'LLM' });
  }

  mcp(message: string, context?: Omit<LogContext, 'service'>): void {
    this.info(message, { ...context, service: 'MCP' });
  }

  auth(message: string, context?: Omit<LogContext, 'service'>): void {
    this.info(message, { ...context, service: 'Auth' });
  }

  db(message: string, context?: Omit<LogContext, 'service'>): void {
    this.info(message, { ...context, service: 'DB' });
  }

  // Method to create service-specific loggers
  createServiceLogger(serviceName: string) {
    return {
      debug: (message: string, context?: Omit<LogContext, 'service'>) =>
        this.debug(message, { ...context, service: serviceName }),
      info: (message: string, context?: Omit<LogContext, 'service'>) =>
        this.info(message, { ...context, service: serviceName }),
      warn: (message: string, context?: Omit<LogContext, 'service'>) =>
        this.warn(message, { ...context, service: serviceName }),
      error: (
        message: string,
        error?: Error,
        context?: Omit<LogContext, 'service'>,
      ) => this.error(message, error, { ...context, service: serviceName }),
    };
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export service-specific loggers
export const chatLogger = logger.createServiceLogger('Chat');
export const llmLogger = logger.createServiceLogger('LLM');
export const mcpLogger = logger.createServiceLogger('MCP');
export const authLogger = logger.createServiceLogger('Auth');
export const dbLogger = logger.createServiceLogger('DB');
export const connectionLogger = logger.createServiceLogger('ConnectionManager');
export const toolLogger = logger.createServiceLogger('ToolInvoker');
export const schedulerLogger = logger.createServiceLogger('Scheduler');
export const openaiLogger = logger.createServiceLogger('OpenAI');
export const botLogger = logger.createServiceLogger('Bot');

export default logger;
