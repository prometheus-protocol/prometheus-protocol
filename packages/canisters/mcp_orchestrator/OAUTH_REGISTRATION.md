# OAuth Registration Automation

The MCP Orchestrator now automatically registers newly provisioned canisters as OAuth resource servers with the Prometheus Auth Server.

## Features

### Automatic Registration

- When a new canister is successfully provisioned, it's automatically registered with the OAuth server
- Registration happens after successful canister provision and WASM installation
- Default OAuth scopes are applied: `openid`, `mcp:tools`, `mcp:resources`

### Manual Registration

- Fallback manual registration function available for troubleshooting
- Allows custom OAuth scope configuration
- Can be used to re-register canisters with updated settings

## Setup

### 1. Configure Auth Server

First, set the auth server ID on the orchestrator:

```bash
# Local development
dfx canister call mcp_orchestrator set_auth_server_id '(principal "your-auth-server-id")'

# Production
dfx canister --network ic call mcp_orchestrator set_auth_server_id '(principal "your-auth-server-id")'
```

### 2. Verify Configuration

Check that the auth server is properly configured:

```bash
dfx canister call mcp_orchestrator get_auth_server_id
```

## Usage

### Automatic Registration

OAuth registration happens automatically when you provision a new instance:

```bash
dfx canister call mcp_orchestrator provision_instance '("my-namespace", "wasm-id-hex")'
```

The orchestrator will:

1. Provision a new canister
2. Install the WASM module
3. Automatically register the canister with the OAuth server

### Manual Registration

If automatic registration fails or you need custom OAuth settings:

```bash
dfx canister call mcp_orchestrator register_oauth_resource '(
  principal "canister-id",
  record {
    name = "My Custom MCP Server";
    logo_uri = "https://example.com/logo.png";
    uris = vec { "https://my-canister.icp0.io" };
    initial_service_principal = principal "canister-id";
    scopes = vec {
      record { "openid"; "Basic user identification" };
      record { "mcp:tools"; "Access to MCP tools" };
      record { "custom:scope"; "Custom application scope" };
    };
    accepted_payment_canisters = vec {};
    frontend_host = null;
  }
)'
```

## Default OAuth Configuration

Automatically registered canisters get these default settings:

- **Name**: `{namespace} MCP Server`
- **Scopes**:
  - `openid`: Grants access to the user's unique identifier (Principal)
  - `mcp:tools`: Allows access to MCP server tools and functions
  - `mcp:resources`: Allows access to MCP server resources
- **URIs**: Automatically determined based on environment (local vs production)
- **Payment Canisters**: Empty (no payment required by default)
- **Service Principal**: The canister itself

## Environment Detection

The orchestrator automatically detects the deployment environment:

- **Local Development**: URLs formatted as `http://127.0.0.1:4943/?canisterId={canister_id}`
- **Production**: URLs formatted as `https://{canister_id}.icp0.io`

Detection is based on common local canister ID patterns.

## Error Handling

If OAuth registration fails:

- The canister provision still succeeds
- Error is logged but doesn't block the deployment
- You can use manual registration as a fallback

## Permissions

- **Orchestrator Owner**: Can register OAuth resources for any canister
- **Canister Owner**: Can register OAuth resources for their own canisters only
- **Others**: Cannot register OAuth resources

## Troubleshooting

### Common Issues

1. **Auth server not configured**

   ```
   Error: "Auth server ID not configured"
   ```

   Solution: Set the auth server ID using `set_auth_server_id`

2. **Permission denied**

   ```
   Error: "Unauthorized: Only the orchestrator owner or canister owner can register OAuth resources"
   ```

   Solution: Ensure you're calling from the correct identity

3. **Auth server unreachable**
   ```
   Error: "Error calling auth server: ..."
   ```
   Solution: Verify the auth server is running and the ID is correct

### Debug Commands

```bash
# Check auth server configuration
dfx canister call mcp_orchestrator get_auth_server_id

# Check managed canisters
dfx canister call mcp_orchestrator get_canisters '("namespace")'

# Check canister ownership
dfx canister call mcp_orchestrator get_canister_id '("namespace", "wasm-id")'
```
