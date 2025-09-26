# Prometheus Protocol Discord Bot

A sophisticated Discord bot that integrates with the Model Context Protocol (MCP) ecosystem, enabling seamless interaction with MCP servers, AI-powered conversations, and automated monitoring tasks directly from Discord.

## 🌟 Features

### Core Capabilities

- **� AI-Powered Chat**: GPT-5-powered conversations with full MCP tool integration
- **🔌 MCP Server Management**: Discover, connect, and manage MCP server connections
- **⚡ Task Monitoring**: Create and manage automated monitoring tasks and alerts
- **🤖 Tool Integration**: Seamlessly use MCP tools through natural language commands
- **📱 DM Support**: Full functionality available in both servers and private DMs
- **🔐 OAuth Integration**: Secure authentication flows for MCP servers requiring authorization

### MCP Integration

- **Multi-Registry Support**: Connects to remote-mcp-servers.com and custom ICP-hosted servers
- **Dynamic Tool Discovery**: Automatically discovers and integrates available tools from connected servers
- **Persistent Connections**: Maintains long-lived connections with automatic reconnection
- **Connection Pool Management**: Efficient handling of multiple simultaneous MCP connections
- **OAuth Flow Handling**: Complete OAuth 2.0/OIDC support for authenticated MCP servers

### Discord Integration

- **Slash Commands**: Modern Discord slash command interface
- **DM Compatibility**: All commands work in both server channels and private DMs
- **Real-time Status**: Live connection status updates and notifications
- **Rich Embeds**: Beautiful, informative response formatting

## 🏗️ Architecture

```
Discord Bot
├── Commands (Slash)
│   ├── /chat (AI + MCP Tools)
│   ├── /mcp (Server Management)
│   └── /tasks (Monitoring & Alerts)
├── Services
│   ├── MCP Services
│   │   ├── Connection Pool Service
│   │   ├── MCP Coordinator Service
│   │   ├── Registry Service
│   │   └── Event Handler Service
│   ├── Core Services
│   │   ├── LLM Service (GPT-5 + MCP)
│   │   ├── Database Service (Supabase)
│   │   ├── Scheduler Service
│   │   └── Discord Notification Service
│   └── OAuth & Auth
│       ├── OAuth Provider
│       └── Token Management
└── AI Functions
    ├── Task Management
    ├── MCP Tool Invocation
    └── Conversation Management
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Discord Bot Token with appropriate permissions
- OpenAI API Key (GPT-4 or GPT-5 access)
- Supabase Database (required for persistence)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd packages/apps/discord-bot

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Build the project
pnpm build

# Deploy slash commands
pnpm deploy:commands

# Start the bot
pnpm start
# Or for development with hot reload
pnpm dev
```

### Environment Variables

```env
# Discord Configuration
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_application_id
DISCORD_GUILD_ID=your_test_guild_id

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Database Configuration (Required)
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_role_key

# OAuth Configuration
OAUTH_CALLBACK_PORT=8080

# Optional: Custom Registry
MCP_REGISTRY_CANISTER_ID=custom_canister_id
```

### Discord Bot Permissions

The bot requires the following Discord permissions:

- `Send Messages`
- `Use Slash Commands`
- `Read Message History`
- `Embed Links`
- `Add Reactions`

## 📖 Usage

### Slash Commands

All commands use Discord's modern slash command interface and work in both servers and DMs.

#### `/chat` - AI-Powered Conversations

```bash
/chat message: How can you help me with weather data?
/chat message: Find me a city where it's currently 5PM
/chat message: What tools do I have available?
```

The AI assistant automatically discovers and uses MCP tools from your connected servers.

#### `/mcp` - MCP Server Management

##### Server Discovery

```bash
/mcp search query: weather           # Search for weather-related servers
/mcp search                         # Browse all available servers
```

##### Connection Management

```bash
/mcp connect server-name: weather-server    # Connect to an MCP server
/mcp list                                   # List your connected servers
/mcp disconnect server-name: weather-server # Disconnect from a server
/mcp delete server-name: weather-server     # Permanently remove connection
```

##### System Management

```bash
/mcp tools                          # List available tools from all servers
/mcp status                         # Show MCP system status
/mcp debug                          # Connection diagnostics
/mcp cleanup                        # Clean up stale connections
/mcp repair                         # Repair corrupted database records
```

#### `/tasks` - Monitoring & Alerts

##### Task Management

```bash
/tasks create name: weather-check description: Monitor Denver weather interval: 15 minutes prompt: Check if it's sunny in Denver for bike rides
/tasks list                         # List all your tasks
/tasks status task_name: weather-check      # Get task status
```

##### Task Control

```bash
/tasks enable task_name: weather-check      # Enable a task
/tasks disable task_name: weather-check     # Disable a task
/tasks delete task_name: weather-check      # Delete a task permanently
/tasks modify task_name: weather-check interval: 30 minutes  # Modify interval
```

### Direct Messages (DM) Support

All commands work identically in DMs:

1. **Find the bot** in any server where you're both members
2. **Right-click the bot's name** in the member list
3. **Select "Message"** to open a DM channel
4. **Use any slash command** exactly as you would in a server

## 🔧 Technical Details

### MCP Protocol Implementation

- **Transport**: Streamable HTTP with Server-Sent Events (SSE) fallback
- **SDK**: Official MCP TypeScript SDK v1.18.1
- **Connection Pooling**: Efficient management of multiple concurrent connections
- **Authentication**: Full OAuth 2.0/OIDC support with token refresh
- **Tool Discovery**: Real-time tool introspection via `listTools()`
- **Tool Execution**: Direct MCP tool invocation via `callTool()`
- **Resource Access**: MCP resource protocol support

### OAuth Authentication Flow

1. **Discovery**: Automatic OAuth server metadata discovery
2. **Authorization**: PKCE-secured authorization code flow
3. **Token Management**: Automatic token refresh and expiration handling
4. **Callback Handling**: Express server for OAuth callbacks
5. **Security**: State validation and CSRF protection

### Registry Integration

- **Primary Registry**: `remote-mcp-servers.com/api/servers` (254+ servers)
- **Custom Registries**: Support for ICP canister-based server hosting
- **Server Discovery**: Real-time search across multiple registries
- **Metadata Caching**: Efficient server information storage

### Function Calling Architecture

```typescript
// MCP tools are automatically converted to OpenAI functions
{
  name: "mcp__server-id__tool-name",
  description: "[Server Name] Tool description",
  parameters: { /* MCP tool input schema */ },
  metadata: {
    type: "mcp",
    server_id: "server-id",
    original_name: "tool-name",
    server_name: "Server Display Name"
  }
}
```

### Database Schema

Key tables and relationships:

- **user_mcp_connections**: User server connections with status
- **oauth_server_metadata**: Cached OAuth server configurations
- **oauth_pending**: Temporary OAuth state management
- **conversation_history**: User chat history and context
- **alert_configurations**: Monitoring task definitions

## 🛠️ Development

### Project Structure

```
src/
├── commands/
│   ├── chat/           # AI chat slash command
│   ├── mcp/            # MCP management commands
│   └── tasks/          # Task monitoring commands
├── services/
│   ├── mcp/            # MCP integration services
│   │   ├── index.ts    # Main MCP service
│   │   ├── auth.ts     # OAuth authentication
│   │   └── connection-manager.ts # Connection handling
│   ├── connections.ts  # Connection pool service
│   ├── mcp-coordinator.service.ts # MCP orchestration
│   ├── registry.service.ts # Server discovery
│   ├── llm.ts          # LLM service with MCP integration
│   ├── database.ts     # Supabase data persistence
│   ├── scheduler.ts    # Task scheduling service
│   └── discord-notification.service.ts
├── mcp/
│   ├── oauth.ts        # OAuth flow implementation
│   └── oauth-provider.ts # OAuth provider abstraction
├── ai-functions/       # AI function definitions
├── types/              # TypeScript type definitions
├── utils/              # Utility functions and loggers
├── config/             # Configuration management
└── index.ts            # Main bot entry point
```

### Key Interfaces

```typescript
interface MCPConnection {
  user_id: string;
  server_id: string;
  server_name: string;
  server_url: string;
  status: 'ACTIVE' | 'DISCONNECTED' | 'ERROR' | 'AUTH_PENDING';
  created_at: string;
  last_connected_at?: string;
  error_message?: string;
  tools?: MCPTool[];
  capabilities?: MCPCapabilities;
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema?: JSONSchema;
}

interface CommandContext {
  interaction: ChatInputCommandInteraction;
  args: string[];
  userId: string;
  channelId: string;
  guildId?: string; // Optional for DM support
}
```

### Available Scripts

```bash
pnpm dev              # Development with hot reload
pnpm build            # Build TypeScript to JavaScript
pnpm start            # Start production bot
pnpm deploy:commands  # Deploy slash commands to Discord
pnpm test             # Run test suite
pnpm test:watch       # Run tests in watch mode
```

### Environment Setup

1. **Create Discord Application**: https://discord.com/developers/applications
2. **Get Bot Token**: Bot → Token → Copy
3. **Set Bot Permissions**: Bot → Permissions → Configure
4. **Setup Supabase**: Create project and get service role key
5. **Configure OpenAI**: Get API key with GPT-4+ access

## 🔮 Roadmap & Future Enhancements

### Current Capabilities ✅

- Full MCP protocol implementation with OAuth support
- Multi-server connection management with persistent sessions
- GPT-5 integration with automatic tool discovery
- Real-time monitoring and alerting system
- Complete DM support for all functionality
- Express OAuth callback server for authentication flows

### Planned Features 🚧

- **Enhanced Resource Access**: Full MCP resource protocol implementation
- **Prompt Templates**: Integration with MCP prompt systems
- **WebSocket Transport**: Real-time bidirectional MCP connections
- **Tool Marketplace**: Community-driven tool sharing and discovery
- **Visual Workflow Builder**: Drag-and-drop MCP tool composition
- **Analytics Dashboard**: Usage metrics, performance insights, and monitoring

### Integration Roadmap 🔭

- **Multi-LLM Support**: Claude, Gemini, and local model integration
- **Voice Integration**: Discord voice channel AI interactions
- **Mobile Companion**: React Native app for mobile MCP management
- **VS Code Extension**: IDE integration for developers
- **API Gateway**: REST API for external integrations

## 🔧 Troubleshooting

### Common Issues

#### Commands Not Appearing in DMs

- Ensure you've run `pnpm deploy:commands` after adding DM support
- Global command deployment can take up to 1 hour to propagate
- Try refreshing Discord or restarting the client

#### MCP Server Connection Failures

- Use `/mcp debug` to diagnose connection issues
- Check server URLs and authentication requirements
- Verify OAuth configuration for authenticated servers

#### Database Connection Issues

- Verify Supabase URL and service role key
- Check network connectivity to Supabase
- Ensure database schema is properly set up

### Debug Commands

```bash
/mcp debug           # Connection diagnostics
/mcp status          # System health check
/mcp cleanup         # Clean up stale connections
/mcp repair          # Fix corrupted database records
```

## 🤝 Contributing

We welcome contributions to improve the Prometheus Protocol Discord Bot!

### Development Setup

```bash
# Clone the repository
git clone https://github.com/prometheus-protocol/prometheus-protocol
cd packages/apps/discord-bot

# Install dependencies
pnpm install

# Set up development environment
cp .env.example .env
# Configure your environment variables

# Start development server
pnpm dev
```

### Contribution Guidelines

1. **Fork the repository** and create a feature branch
2. **Follow TypeScript best practices** and maintain type safety
3. **Add tests** for new functionality where appropriate
4. **Update documentation** for any user-facing changes
5. **Test DM compatibility** for any command modifications
6. **Submit a pull request** with a clear description

## 📚 Resources & Documentation

### Core Technologies

- [Model Context Protocol Specification](https://modelcontextprotocol.io/docs)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Discord.js v14 Guide](https://discordjs.guide/)
- [OpenAI API Documentation](https://platform.openai.com/docs)

### Database & Infrastructure

- [Supabase Documentation](https://supabase.com/docs)
- [Express.js Guide](https://expressjs.com/)
- [OAuth 2.0 Specification](https://oauth.net/2/)

### Development Tools

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vitest Testing Framework](https://vitest.dev/)
- [pnpm Package Manager](https://pnpm.io/)

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

**Built with ❤️ for the Prometheus Protocol community and the broader MCP ecosystem.**

_Empowering developers to build AI agents that seamlessly integrate with any service through the Model Context Protocol._
