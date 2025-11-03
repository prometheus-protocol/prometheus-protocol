import { type Identity } from '@icp-sdk/core/agent';
import { Ed25519KeyIdentity } from '@icp-sdk/core/identity';
import { Secp256k1KeyIdentity } from '@icp-sdk/core/identity/secp256k1';
import pemfile from 'pem-file';

/**
 * Creates an identity from the raw string content of a plaintext PEM file.
 * This is the core decoding utility.
 * @param pemContent The string content of the PEM file.
 */
export function identityFromPemContent(
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

    // 2. CONVERT BUFFER TO UINT8ARRAY
    // Create a new Uint8Array from the slice (v4 expects Uint8Array).
    const secretKeyUint8Array = new Uint8Array(secretKeySlice);

    return Secp256k1KeyIdentity.fromSecretKey(secretKeyUint8Array);
  }

  // This is an Ed25519 key
  if (rawKey.length !== 85) {
    throw new Error(
      `Invalid Ed25519 key format: expecting byte length 85 but got ${rawKey.length}`,
    );
  }
  const secretKey = rawKey.subarray(16, 48);
  const secretKeyUint8Array = new Uint8Array(secretKey);
  return Ed25519KeyIdentity.fromSecretKey(secretKeyUint8Array);
}
