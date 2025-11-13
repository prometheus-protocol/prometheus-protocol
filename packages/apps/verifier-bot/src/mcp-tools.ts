import { PocketIc, PocketIcServer, createIdentity } from '@dfinity/pic';
import { IDL } from '@dfinity/candid';
import { AnonymousIdentity } from '@dfinity/agent';
import { Principal } from '@icp-sdk/core/principal';
import { idlFactory as mcpServerIdlFactory } from '@prometheus-protocol/declarations/mcp_server/mcp_server.did.js';
import type { _SERVICE as McpServerService } from '@prometheus-protocol/declarations/mcp_server/mcp_server.did.js';
import type { Actor } from '@dfinity/pic';
import { randomBytes } from 'node:crypto';

export interface McpToolsResult {
  success: boolean;
  tools?: Array<{
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
  }>;
  hasApiKeySystem?: boolean;
  hasOwnerSystem?: boolean;
  hasWalletSystem?: boolean;
  hasIcrc120System?: boolean;
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
  let pic: PocketIc | undefined;
  let picServer: PocketIcServer | undefined;

  try {
    console.log(`📦 Loading WASM into PocketIC...`);

    // Start PocketIC server
    console.log(`   🚀 Starting PocketIC server...`);
    picServer = await PocketIcServer.start({
      showCanisterLogs: true,
      showRuntimeLogs: true,
    });
    const picUrl = picServer.getUrl();
    console.log(`   🔗 PocketIC server started at ${picUrl}`);

    // Create a PocketIC instance
    pic = await PocketIc.create(picUrl);
    console.log(`   ✅ Connected to PocketIC server`);

    try {
      // Create a canister with the WASM using explicit steps for better error handling
      console.log(`   📝 Creating canister...`);
      const canisterId = await pic.createCanister();
      console.log(`   ✅ Canister ID: ${canisterId.toText()}`);

      console.log(`   📦 Installing WASM code...`);
      try {
        const initArg = IDL.encode(
          [IDL.Opt(IDL.Record({ owner: IDL.Opt(IDL.Principal) }))],
          [[]],
        );
        await pic.installCode({
          canisterId,
          wasm: wasmPath,
          arg: initArg.buffer as ArrayBufferLike,
        });
        console.log(`   ✅ WASM installed successfully`);
      } catch (installError) {
        console.error(`   ❌ Install code failed:`, installError);
        throw installError;
      }
      console.log(`   🎭 Creating actor...`);
      const serverActor = pic.createActor<McpServerService>(
        mcpServerIdlFactory,
        canisterId,
      );
      console.log(`   ✅ Actor created`);

      // Set identity to anonymous - we'll authenticate via API key if needed
      serverActor.setIdentity(new AnonymousIdentity());

      // Prepare JSON-RPC request to list tools
      console.log(`🔍 Discovering tools via JSON-RPC...`);
      const rpcPayload = {
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 'verifier-tools-list',
      };
      const body = new TextEncoder().encode(JSON.stringify(rpcPayload));

      // Make HTTP request to the MCP endpoint
      console.log(`   📡 Making HTTP request to /mcp endpoint...`);
      const httpResponse = await serverActor.http_request_update({
        method: 'POST',
        url: '/mcp',
        headers: [['Content-Type', 'application/json']],
        body,
        certificate_version: [],
      });
      console.log(`   ✅ HTTP response received: ${httpResponse.status_code}`);

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
      console.log(`   ✅ Response parsed successfully`);

      // Check for JSON-RPC error
      if (responseBody.error) {
        throw new Error(
          `JSON-RPC error: ${responseBody.error.message || JSON.stringify(responseBody.error)}`,
        );
      }

      // Extract tools from response
      const toolsList = responseBody.result?.tools || [];
      console.log(`   ✅ Discovered ${toolsList.length} tools`);

      // ===================================================================
      // Check for API key system, owner system, and wallet system
      // ===================================================================
      console.log(`🔍 Checking for MCP server features...`);

      // Since we successfully discovered tools with AnonymousIdentity,
      // this is a public server. API key system is optional for public servers.
      const isPublicServer = true;
      console.log(`   ℹ️  Server is public (allows anonymous tool discovery)`);

      // Check for API key system (optional for public servers)
      let hasApiKeySystem = false;
      try {
        console.log(`   📋 Checking for API key methods...`);
        const testIdentity = createIdentity('test-api-key-user');
        serverActor.setIdentity(testIdentity);

        // @ts-ignore - Method may not be in type definition but could exist on canister
        const apiKey = await serverActor.create_my_api_key('test-key', []);
        if (typeof apiKey === 'string' && apiKey.length > 0) {
          console.log(
            `   ✅ API key system verified (created test key: ${apiKey.substring(0, 10)}...)`,
          );
          hasApiKeySystem = true;
        }
      } catch (apiKeyError: any) {
        const errorMsg = apiKeyError?.message || String(apiKeyError);
        if (errorMsg.includes('has no update method')) {
          console.log(
            `   ℹ️  API key system not found (optional for public servers)`,
          );
        } else {
          console.log(`   ⚠️  API key system check failed: ${errorMsg}`);
        }
      }

      // Check for owner system
      let hasOwnerSystem = false;
      try {
        console.log(`   👤 Checking for owner methods...`);
        // @ts-ignore - Method may not be in type definition but could exist on canister
        const owner = await serverActor.get_owner();
        if (owner && typeof owner.toText === 'function') {
          console.log(`   ✅ Owner system verified (owner: ${owner.toText()})`);
          hasOwnerSystem = true;
        }
      } catch (ownerError: any) {
        const errorMsg = ownerError?.message || String(ownerError);
        if (errorMsg.includes('has no query method')) {
          console.log(
            `   ❌ Owner system not found: get_owner method does not exist`,
          );
        } else {
          console.log(`   ⚠️  Owner system check failed: ${errorMsg}`);
        }
      }

      // Check for wallet/treasury system
      let hasWalletSystem = false;
      try {
        console.log(`   💰 Checking for wallet methods...`);
        const dummyLedgerId = Principal.fromText('aaaaa-aa');
        // @ts-ignore - Method may not be in type definition but could exist on canister
        const balance = await serverActor.get_treasury_balance(dummyLedgerId);
        if (typeof balance === 'bigint' || typeof balance === 'number') {
          console.log(
            `   ✅ Wallet system verified (treasury balance check returned: ${balance})`,
          );
          hasWalletSystem = true;
        }
      } catch (walletError: any) {
        const errorMsg = walletError?.message || String(walletError);
        if (errorMsg.includes('has no update method')) {
          console.log(
            `   ❌ Wallet system not found: get_treasury_balance method does not exist`,
          );
        } else {
          console.log(`   ⚠️  Wallet system check failed: ${errorMsg}`);
        }
      }

      // Check for ICRC-120 upgrade system
      let hasIcrc120System = false;
      try {
        console.log(`   🔄 Checking for ICRC-120 upgrade methods...`);
        // @ts-ignore - Method may not be in type definition but could exist on canister
        const result = await serverActor.icrc120_upgrade_finished();
        if (
          result &&
          ('Success' in result || 'InProgress' in result || 'Failed' in result)
        ) {
          console.log(
            `   ✅ ICRC-120 system verified (upgrade status check returned valid result)`,
          );
          hasIcrc120System = true;
        }
      } catch (icrc120Error: any) {
        const errorMsg = icrc120Error?.message || String(icrc120Error);
        if (
          errorMsg.includes('has no query method') ||
          errorMsg.includes('has no update method')
        ) {
          console.log(
            `   ❌ ICRC-120 system not found: icrc120_upgrade_finished method does not exist`,
          );
        } else {
          console.log(`   ⚠️  ICRC-120 system check failed: ${errorMsg}`);
        }
      }

      // Check if all required systems are present
      const missingSystems: string[] = [];
      // API key system is only required for private servers
      if (!isPublicServer && !hasApiKeySystem)
        missingSystems.push('API key system');
      if (!hasOwnerSystem) missingSystems.push('owner system');
      if (!hasWalletSystem) missingSystems.push('wallet system');
      if (!hasIcrc120System) missingSystems.push('ICRC-120 upgrade system');

      // Clean up
      await pic.tearDown();
      if (picServer) {
        await picServer.stop();
      }

      const duration = Math.floor((Date.now() - startTime) / 1000);

      // If any required systems are missing, return failure
      if (missingSystems.length > 0) {
        const errorMsg = `Missing required systems: ${missingSystems.join(', ')}`;
        console.log(`   ❌ ${errorMsg}`);
        return {
          success: false,
          error: errorMsg,
          hasApiKeySystem,
          hasOwnerSystem,
          hasWalletSystem,
          hasIcrc120System,
          duration,
        };
      }

      // Map tools to the format expected by attestation
      const tools = toolsList.map((tool: any) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

      return {
        success: true,
        tools,
        hasApiKeySystem,
        hasOwnerSystem,
        hasWalletSystem,
        hasIcrc120System,
        duration,
      };
    } catch (error) {
      await pic.tearDown();
      if (picServer) {
        await picServer.stop();
      }
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
