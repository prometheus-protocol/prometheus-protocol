# Discord MCP Client

A powerful Discord bot that integrates with the Model Context Protocol (MCP) ecosystem, allowing users to discover, connect to, and interact with MCP servers directly from Discord.

## 🌟 Features

### Core Capabilities

- **🔌 MCP Server Discovery**: Search and discover MCP servers from both official registries and ICP-hosted servers
- **🤖 AI-Powered Chat**: Enhanced AI chat with access to MCP tools and custom AI functions
- **⚡ Real-time Monitoring**: Set up automated alerts and monitoring tasks
- **🛠️ Tool Integration**: Seamlessly use MCP tools through natural language

### MCP Integration

- **Dual Registry Support**: Connects to both remote-mcp-servers.com and ICP blockchain-hosted servers
- **Dynamic Tool Discovery**: Automatically discovers and integrates available tools from connected servers
- **Function Call Translation**: Converts MCP tools to OpenAI function format for seamless AI integration
- **Connection Management**: Persistent user connections with status tracking

## 🏗️ Architecture

```
Discord Bot
├── Commands
│   ├── Chat Command (AI + MCP Tools)
│   └── MCP Command (Server Management)
├── Services
│   ├── MCP Service
│   │   ├── Registry Service (Discovery)
│   │   ├── Connection Manager (SDK)
│   │   └── Tool Invoker (Execution)
│   ├── LLM Service (OpenAI + MCP)
│   └── Database Service (Supabase)
└── AI Functions
    ├── Task Management
    └── Data Sources
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Discord Bot Token
- OpenAI API Key
- Supabase Database (optional)

### Installation

```bash
# Clone and install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your tokens

# Build the project
npm run build

# Start the bot
npm start
```

### Environment Variables

```env
DISCORD_TOKEN=your_discord_bot_token
OPENAI_API_KEY=your_openai_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
MCP_REGISTRY_CANISTER_ID=mcp_registry_canister_id
```

## 📖 Usage

### MCP Commands

#### Server Discovery

```
!mcp search <query>          # Search for MCP servers
!mcp search github           # Find GitHub-related servers
!mcp search                  # Browse all available servers
```

#### Connection Management

```
!mcp list                    # List your connected servers
!mcp connect <server-id>     # Connect to an MCP server
!mcp disconnect <server-id>  # Disconnect from a server
```

#### Tool Management

```
!mcp tools                   # List available tools
!mcp status                  # Show system status
```

### AI Chat with MCP Integration

```
!chat How can I help you with GitHub?
```

The AI will automatically discover and use available MCP tools from your connected servers.

### Monitoring & Alerts

```
!chat Check my leaderboard position every 5 minutes
!chat Monitor the Prometheus repo for new issues
!chat Alert me daily if the API status changes
```

## 🔧 Technical Details

### MCP Protocol Support

- **Transport**: SSE (Server-Sent Events) for HTTP/HTTPS connections
- **Authentication**: Configurable auth support for server connections
- **Tool Discovery**: Automatic tool introspection via `listTools()`
- **Tool Execution**: Direct MCP tool invocation via `callTool()`

### Registry Integration

1. **Official Registry**: `remote-mcp-servers.com/api/servers`
2. **ICP Registry**: Custom canister-based server hosting
3. **Hybrid Search**: Combines results from both registries

### Function Calling Architecture

```typescript
// MCP tools are automatically converted to OpenAI functions
{
  name: "mcp_server-id_tool-name",
  description: "[Server Name] Tool description",
  parameters: { /* MCP tool schema */ },
  metadata: {
    type: "mcp",
    server_id: "server-id",
    original_name: "tool-name"
  }
}
```

## 🛠️ Development

### Project Structure

```
src/
├── commands/
│   ├── chat/           # AI chat command
│   └── mcp/            # MCP management commands
├── services/
│   ├── mcp/            # MCP integration services
│   │   ├── index.ts    # Main MCP service
│   │   ├── registry.ts # Server discovery
│   │   ├── connection-manager.ts # Connection handling
│   │   └── tool-invoker.ts # Tool execution
│   ├── llm.ts          # LLM service with MCP integration
│   └── database.ts     # Data persistence
├── types/              # TypeScript definitions
└── index.ts            # Main bot entry point
```

### Key Interfaces

```typescript
interface MCPServer {
  id: string;
  name: string;
  description: string;
  url: string;
  author?: string;
  tags?: string[];
  hosted_on: 'icp' | 'external';
}

interface MCPConnection {
  server_id: string;
  server_name: string;
  url: string;
  status: 'connected' | 'disconnected' | 'error';
  tools: MCPTool[];
  last_connected?: Date;
  error_message?: string;
}
```

### Testing

```bash
npm run build
node scripts/test-mcp.js
```

## 🔮 Future Enhancements

### Planned Features

- **Resource Access**: Support for MCP resource protocols
- **Prompt Templates**: Integration with MCP prompt systems
- **WebSocket Support**: Real-time MCP connections
- **Server Hosting**: Built-in MCP server hosting capabilities
- **Tool Marketplace**: User-generated tool sharing

### Integration Roadmap

- **Multi-LLM Support**: Claude, Gemini, local models
- **Voice Integration**: Discord voice channel support
- **Workflow Builder**: Visual MCP tool composition
- **Analytics Dashboard**: Usage metrics and insights

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines and join our Discord community.

### Development Setup

```bash
git clone <repo>
cd discord-bot
npm install
npm run dev
```

## 📚 Resources

- [Model Context Protocol Specification](https://modelcontextprotocol.io/docs)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/typescript-sdk)
- [Discord.js Guide](https://discordjs.guide/)
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

Built with ❤️ for the Prometheus Protocol community and the broader MCP ecosystem.
