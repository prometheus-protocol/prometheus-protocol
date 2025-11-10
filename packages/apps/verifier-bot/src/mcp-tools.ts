import { PocketIc } from '@dfinity/pic';
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

  try {
    console.log(`📦 Loading WASM into PocketIC...`);

    // Initialize PocketIC - connect to a locally running PocketIC server
    const picUrl = process.env.PIC_URL || 'http://localhost:8080';
    const pic = await PocketIc.create(picUrl);

    try {
      // Create a canister with the WASM
      const fixture = await pic.setupCanister<McpServerService>({
        idlFactory: mcpServerIdlFactory,
        wasm: wasmPath,
        // Empty init args - MCP servers typically don't need init arguments
        arg: new Uint8Array().buffer,
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
      throw error;
    }
  } catch (error) {
    const duration = Math.floor((Date.now() - startTime) / 1000);
    console.error(`❌ MCP tools verification failed:`, error);

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration,
    };
  }
}
