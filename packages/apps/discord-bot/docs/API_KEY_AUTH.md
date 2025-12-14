# API Key Authentication for MCP Connections

## Overview

The Discord bot now supports API key-based authentication for MCP servers that don't use OAuth. This is useful for servers that require a simple API key header instead of the full OAuth flow.

## Usage

### Connecting with an API Key

When using the `/mcp connect` command, you'll see a modal with three fields:

1. **MCP Server URL** (required) - The URL of your MCP server
2. **API Key Header** (optional) - The header name for your API key (e.g., `x-api-key`, `Authorization`)
3. **API Key Value** (optional) - Your actual API key

### Examples

#### Example 1: Using x-api-key header
```
MCP Server URL: https://your-mcp-server.com
API Key Header: x-api-key
API Key Value: your-secret-key-12345
```

#### Example 2: Using Authorization header
```
MCP Server URL: https://api.example.com/mcp
API Key Header: Authorization
API Key Value: Bearer sk-1234567890abcdef
```

#### Example 3: OAuth server (no API key)
```
MCP Server URL: https://oauth-server.com/mcp
API Key Header: (leave empty)
API Key Value: (leave empty)
```

## How It Works

### Authentication Priority

1. **URL-embedded credentials** (highest priority) - If your URL contains API keys in query params or path, those are used
2. **Custom API Key headers** - If you provide both header and value in the connection modal
3. **OAuth** (lowest priority) - If neither of the above, OAuth flow is attempted

### Security

- API keys are stored encrypted in the database
- Modal fields are ephemeral (only visible to you)
- API keys are never logged in plain text

### Supported Header Names

You can use any header name your server expects. Common examples:
- `x-api-key`
- `Authorization` 
- `api-key`
- `X-API-Key`
- Any custom header your server uses

## Database Schema

The `mcp_connections` table has been extended with:
- `api_key_header` (TEXT, nullable) - Stores the header name
- `api_key_value` (TEXT, nullable) - Stores the API key value

## Migration

To apply the database changes, run:
```sql
-- See migrations/add_api_key_columns.sql
ALTER TABLE mcp_connections ADD COLUMN IF NOT EXISTS api_key_header TEXT;
ALTER TABLE mcp_connections ADD COLUMN IF NOT EXISTS api_key_value TEXT;
```

## Validation

- Both API key header and value must be provided together, or neither
- If only one field is filled, you'll get an error: "Both API key header and value must be provided together"

## Troubleshooting

### Connection fails with API key
1. Verify your API key is correct
2. Check that the header name matches what your server expects (case-sensitive!)
3. Look at the error message in `/mcp list` for details

### Server expects Authorization but I'm using x-api-key
Simply reconnect with the correct header name. Use `/mcp disconnect` first, then `/mcp connect` with the right header.

### Need to update API key
1. Use `/mcp disconnect <server-name>` to disconnect
2. Use `/mcp connect` again with the updated API key
