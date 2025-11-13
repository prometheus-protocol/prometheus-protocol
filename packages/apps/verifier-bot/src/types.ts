export interface BuildResult {
  success: boolean;
  wasmHash?: string;
  wasmPath?: string; // Path to the built WASM file
  buildLog?: string;
  error?: string;
  duration: number; // seconds
}

export interface VerificationJob {
  wasm_hash: string;
  repo: string;
  commit_hash: string;
  requester: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface BountyInfo {
  id: bigint;
  challengeParameters: {
    wasm_hash: Uint8Array;
    audit_type: string;
  };
  tokenAmount: bigint;
  tokenCanisterId: string;
  timeoutDate?: Date;
}
