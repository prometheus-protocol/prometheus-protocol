import { PocketIc, PocketIcServer } from '@dfinity/pic';
import { IDL } from '@dfinity/candid';
import { AnonymousIdentity } from '@dfinity/agent';
import { idlFactory as mcpServerIdlFactory } from '@prometheus-protocol/declarations/mcp_server/mcp_server.did.js';
import type { _SERVICE as McpServerService } from '@prometheus-protocol/declarations/mcp_server/mcp_server.did.js';
import type { Actor } from '@dfinity/pic';

export interface McpToolsResult {
  success: boolean;
  tools?: Array<{
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
  }>;
  error?: string;
  duration: number;
}

/**
 * Verifies an MCP server WASM by loading it in PocketIC and discovering its tools
 * using direct JSON-RPC calls to the canister's http_request_update method.
 */
export async function verifyMcpTools(
  wasmPath: string,
  wasmHash: string,
): Promise<McpToolsResult> {
  const startTime = Date.now();
  let picServer: PocketIcServer | undefined;
  let pic: PocketIc | undefined;

  try {
    console.log(`📦 Loading WASM into PocketIC...`);

    // Start a PocketIC server - this will automatically download the binary if needed
    picServer = await PocketIcServer.start();
    const picUrl = picServer.getUrl();
    console.log(`   ✅ PocketIC server started at ${picUrl}`);

    // Create a PocketIC instance connected to the server
    pic = await PocketIc.create(picUrl);

    try {
      // Create a canister with the WASM using the setupCanister convenience method
      const fixture = await pic.setupCanister<McpServerService>({
        idlFactory: mcpServerIdlFactory,
        wasm: wasmPath,
      });

      const serverActor: Actor<McpServerService> = fixture.actor;
      const canisterId = fixture.canisterId.toText();
      console.log(`   ✅ Canister created: ${canisterId}`);

      // Set identity to anonymous - we'll authenticate via API key if needed
      serverActor.setIdentity(new AnonymousIdentity());

      // Prepare JSON-RPC request to list tools
      console.log(`� Discovering tools via JSON-RPC...`);
      const rpcPayload = {
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 'verifier-tools-list',
      };
      const body = new TextEncoder().encode(JSON.stringify(rpcPayload));

      // Make HTTP request to the MCP endpoint
      const httpResponse = await serverActor.http_request_update({
        method: 'POST',
        url: '/mcp',
        headers: [['Content-Type', 'application/json']],
        body,
        certificate_version: [],
      });

      // Check response status
      if (httpResponse.status_code !== 200) {
        throw new Error(
          `HTTP request failed with status ${httpResponse.status_code}`,
        );
      }

      // Parse response
      const responseBody = JSON.parse(
        new TextDecoder().decode(httpResponse.body as Uint8Array),
      );

      // Check for JSON-RPC error
      if (responseBody.error) {
        throw new Error(
          `JSON-RPC error: ${responseBody.error.message || JSON.stringify(responseBody.error)}`,
        );
      }

      // Extract tools from response
      const toolsList = responseBody.result?.tools || [];
      console.log(`   ✅ Discovered ${toolsList.length} tools`);

      // Clean up
      await pic.tearDown();
      await picServer.stop();

      const duration = Math.floor((Date.now() - startTime) / 1000);

      // Map tools to the format expected by attestation
      const tools = toolsList.map((tool: any) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

      return {
        success: true,
        tools,
        duration,
      };
    } catch (error) {
      await pic.tearDown();
      await picServer.stop();
      throw error;
    }
  } catch (error) {
    // Cleanup on outer error
    if (pic) {
      await pic.tearDown();
    }
    if (picServer) {
      await picServer.stop();
    }

    const duration = Math.floor((Date.now() - startTime) / 1000);
    console.error(`❌ MCP tools verification failed:`, error);

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration,
    };
  }
}
