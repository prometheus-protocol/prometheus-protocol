import { Identity } from '@icp-sdk/core/agent';
import { getOrchestratorActor } from '../actors.js';
import { Principal } from '@icp-sdk/core/principal';
import { Orchestrator } from '@prometheus-protocol/declarations';
import { fromNullable } from '@dfinity/utils';

export interface RequestUpgradeArgs {
  canister_id: string;
  wasm_hash: Uint8Array<ArrayBufferLike> | number[];
  mode?: 'install' | 'reinstall' | 'upgrade';
  arg?: Uint8Array;
  skip_pre_upgrade?: boolean;
}

/**
 * Requests that the orchestrator upgrade a specific canister using a specific WASM hash.
 */
export const requestUpgrade = async (
  identity: Identity,
  args: RequestUpgradeArgs,
): Promise<void> => {
  const {
    canister_id,
    wasm_hash,
    mode = 'upgrade',
    arg = [],
    skip_pre_upgrade = false,
  } = args;

  let installMode: Orchestrator.canister_install_mode;
  if (mode === 'install') {
    installMode = { install: null };
  } else if (mode === 'reinstall') {
    installMode = { reinstall: null };
  } else {
    installMode = {
      upgrade: [
        {
          skip_pre_upgrade: [skip_pre_upgrade],
          wasm_memory_persistence: [{ keep: null }],
        },
      ],
    };
  }

  const orchestratorActor = getOrchestratorActor(identity);
  const request: Orchestrator.UpgradeToRequest = {
    canister_id: Principal.fromText(canister_id),
    hash: wasm_hash,
    mode: installMode,
    args: arg,
    parameters: [],
    restart: false,
    snapshot: false,
    stop: false,
    timeout: 0n,
  };

  const result = await orchestratorActor.icrc120_upgrade_to([request]);
  const upgradeResult = result[0];

  if ('Err' in upgradeResult) {
    throw new Error(
      `Upgrade request failed: ${JSON.stringify(upgradeResult.Err)}`,
    );
  }
};

/**
 * Checks the status of the last upgrade initiated by the caller's identity.
 */
export const getUpgradeStatus = async (
  identity: Identity,
): Promise<Orchestrator.UpgradeFinishedResult> => {
  const orchestratorActor = getOrchestratorActor(identity);
  const result = await orchestratorActor.icrc120_upgrade_finished();
  return result;
};

/**
 * Provisions a new instance of an MCP server for the authenticated user.
 * This is used for "provisioned" apps where users get their own private instance.
 */
export const provisionInstance = async (
  identity: Identity,
  namespace: string,
  wasmId: string,
): Promise<Principal> => {
  const orchestratorActor = getOrchestratorActor(identity);
  const result = await orchestratorActor.provision_instance(namespace, wasmId);

  if ('err' in result) {
    throw new Error(`Provision failed: ${result.err}`);
  }

  return result.ok;
};

export const getServerCanisterId = async (
  identity: Identity,
  namespace: string,
  wasmId: string,
): Promise<Principal | undefined> => {
  const orchestratorActor = getOrchestratorActor(identity);
  const res = await orchestratorActor.get_canister_id(namespace, wasmId);
  return fromNullable(res);
};
