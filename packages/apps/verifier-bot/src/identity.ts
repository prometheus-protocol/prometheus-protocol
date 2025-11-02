import { type Identity } from '@dfinity/agent';
import { Ed25519KeyIdentity } from '@dfinity/identity';
import { Secp256k1KeyIdentity } from '@dfinity/identity-secp256k1';
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
