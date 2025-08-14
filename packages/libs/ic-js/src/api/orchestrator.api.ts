import { Identity } from '@dfinity/agent';
import { getOrchestratorActor } from '../actors.js';
import { Principal } from '@dfinity/principal';
import { Orchestrator } from '@prometheus-protocol/declarations';

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

  if ('err' in upgradeResult) {
    throw new Error(
      `Upgrade request failed: ${JSON.stringify(upgradeResult.err)}`,
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
