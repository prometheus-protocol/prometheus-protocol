import * as AuditHub from './generated/audit_hub/audit_hub.did.js';
import * as Auth from './generated/auth_server/auth_server.did.js';
import * as Registry from './generated/mcp_registry/mcp_registry.did.js';
import * as Orchestrator from './generated/mcp_orchestrator/mcp_orchestrator.did.js';
import * as Ledger from './generated/icrc1_ledger/icrc1_ledger.did.js';
import * as AppBounties from './generated/app_bounties/app_bounties.did.js';
import * as Leaderboard from './generated/leaderboard/leaderboard.did.js';
import * as McpServer from './generated/mcp_server/mcp_server.did.js';
import * as SearchIndex from './generated/search_index/search_index.did.js';

// Centralized export for all canister interfaces
export {
  Registry,
  Orchestrator,
  Ledger,
  AuditHub,
  Auth,
  AppBounties,
  Leaderboard,
  McpServer,
  SearchIndex,
};
