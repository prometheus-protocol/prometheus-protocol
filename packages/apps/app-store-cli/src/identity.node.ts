import { type Identity } from '@dfinity/agent';
import { Ed25519KeyIdentity } from '@dfinity/identity';
import { Secp256k1KeyIdentity } from '@dfinity/identity-secp256k1';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import pemfile from 'pem-file';
import { execSync } from 'node:child_process';

/**
 * Creates an identity from the raw string content of a plaintext PEM file.
 * This is the core decoding utility.
 * @param pemContent The string content of the PEM file.
 */
function identityFromPemContent(
  pemContent: string,
): Ed25519KeyIdentity | Secp256k1KeyIdentity {
  // The pem-file library is the correct tool for both formats.
  const pemBuffer = Buffer.from(pemContent);
  const rawKey = pemfile.decode(pemBuffer);

  // Differentiate based on the header string inside the file.
  if (pemContent.includes('EC PRIVATE KEY')) {
    // This is a Secp256k1 key
    if (rawKey.length !== 118) {
      throw new Error(
        `Invalid Secp256k1 key format: expecting byte length 118 but got ${rawKey.length}`,
      );
    }
    // 1. Get the 32-byte secret key as a Buffer slice.
    const secretKeySlice = rawKey.subarray(7, 39);

    // 2. CONVERT BUFFER TO ARRAYBUFFER
    // Create a new Uint8Array from the slice, then get its underlying buffer.
    const secretKeyArrayBuffer = new Uint8Array(secretKeySlice).buffer;

    return Secp256k1KeyIdentity.fromSecretKey(secretKeyArrayBuffer);
  }

  // This is an Ed25519 key
  if (rawKey.length !== 85) {
    throw new Error(
      `Invalid Ed25519 key format: expecting byte length 85 but got ${rawKey.length}`,
    );
  }
  const secretKey = rawKey.subarray(16, 48);
  const secretKeyArrayBuffer = new Uint8Array(secretKey).buffer;
  return Ed25519KeyIdentity.fromSecretKey(secretKeyArrayBuffer);
}

/**
 * Loads a DFX identity from the local filesystem.
 * This function does NOT support encrypted identities.
 * @param identityName The name of the dfx identity.
 * @returns The Identity object.
 */
export function loadDfxIdentity(identityName: string): Identity {
  const homeDir = os.homedir();
  const identityDir = path.join(
    homeDir,
    '.config',
    'dfx',
    'identity',
    identityName,
  );
  const pemPath = path.join(identityDir, 'identity.pem');
  const encryptedPath = path.join(identityDir, 'identity.pem.encrypted');

  if (fs.existsSync(encryptedPath)) {
    throw new Error(
      `Identity '${identityName}' is encrypted. This tool does not support encrypted identities directly.\n\nPlease export the key to a temporary unencrypted file:\n\ndfx identity export ${identityName} > temp-key.pem\n\nThen use a different method for providing the identity.`,
    );
  }

  if (!fs.existsSync(pemPath)) {
    throw new Error(`Could not find identity.pem in ${identityDir}`);
  }

  const pemContent = fs.readFileSync(pemPath, 'utf-8');
  return identityFromPemContent(pemContent);
}

/**
 * Gets the name of the currently active DFX identity.
 * This is a simple utility wrapper around the dfx CLI.
 * @returns The name of the current identity.
 */
export function getCurrentIdentityName(): string {
  return execSync('dfx identity whoami').toString().trim();
}
