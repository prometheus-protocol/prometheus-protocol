export interface BotConfig {
  discord: {
    token: string;
    clientId: string;
    guildId?: string; // For development
  };
  database: {
    supabaseUrl: string;
    supabaseKey: string;
  };
  llm: {
    provider: 'openai' | 'anthropic';
    apiKey: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    toolConcurrencyLimit?: number; // Max concurrent tool calls to prevent MCP server overload
  };
  alerts: {
    defaultInterval: number; // milliseconds
    maxConcurrentAlerts: number;
  };
}

export class ConfigManager {
  private config: BotConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): BotConfig {
    const required = (key: string): string => {
      const value = process.env[key];
      if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
      }
      return value;
    };

    const optional = (key: string, defaultValue: string): string => {
      return process.env[key] || defaultValue;
    };

    return {
      discord: {
        token: required('DISCORD_TOKEN'),
        clientId: required('DISCORD_CLIENT_ID'),
        guildId: process.env.DISCORD_GUILD_ID,
      },
      database: {
        supabaseUrl: required('SUPABASE_URL'),
        supabaseKey: required('SUPABASE_SERVICE_ROLE_KEY'),
      },
      llm: {
        provider:
          (process.env.LLM_PROVIDER as 'openai' | 'anthropic') || 'openai',
        apiKey: required('LLM_API_KEY'),
        model: optional('LLM_MODEL', 'gpt-3.5-turbo'),
        maxTokens: parseInt(optional('LLM_MAX_TOKENS', '1000')),
        temperature: parseFloat(optional('LLM_TEMPERATURE', '0.7')),
        toolConcurrencyLimit: parseInt(
          optional('LLM_TOOL_CONCURRENCY_LIMIT', '3'),
        ),
      },
      alerts: {
        defaultInterval: parseInt(optional('ALERT_DEFAULT_INTERVAL', '300000')), // 5 minutes
        maxConcurrentAlerts: parseInt(optional('ALERT_MAX_CONCURRENT', '10')),
      },
    };
  }

  get(): BotConfig {
    return this.config;
  }

  getDiscord() {
    return this.config.discord;
  }

  getDatabase() {
    return this.config.database;
  }

  getLLM() {
    return this.config.llm;
  }

  getAlerts() {
    return this.config.alerts;
  }
}
