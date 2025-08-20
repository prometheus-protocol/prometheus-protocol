import { Principal } from '@dfinity/principal';
import {
  ICRC16,
  ICRC16Map,
} from '@prometheus-protocol/declarations/mcp_registry/mcp_registry.did.js';

/**
 * Recursively serializes a single JavaScript value into its corresponding
 * ICRC-16 variant type.
 * @param value The JavaScript value to serialize.
 * @returns The ICRC-16 variant object.
 */
export function serializeIcrc16Value(value: any): ICRC16 {
  if (typeof value === 'string') {
    return { Text: value };
  }
  if (typeof value === 'number') {
    // Assuming numbers should be treated as Nat
    return { Nat: BigInt(value) };
  }
  if (typeof value === 'bigint') {
    return { Nat: value };
  }
  if (typeof value === 'boolean') {
    return { Bool: value };
  }
  if (value instanceof Principal) {
    return { Principal: value };
  }
  if (value instanceof Uint8Array || value instanceof Buffer) {
    return { Blob: Array.from(value) };
  }
  if (Array.isArray(value)) {
    // If it's an array, map over its items and serialize each one recursively.
    return { Array: value.map(serializeIcrc16Value) };
  }
  if (typeof value === 'object' && value !== null) {
    // If it's an object, serialize it into a nested Map.
    return { Map: serializeToIcrc16Map(value) };
  }

  // Fallback for unsupported types like null or undefined
  // Or you could throw an error: throw new Error(`Unsupported type for ICRC-16 serialization: ${typeof value}`);
  return { Text: '' }; // Or handle as needed
}

/**
 * A generic helper to recursively serialize a JavaScript object into the ICRC-16 Map format.
 * @param data The JavaScript object to serialize.
 */
export function serializeToIcrc16Map(data: Record<string, any>): ICRC16Map {
  const metadata: ICRC16Map = [];

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      continue; // Skip null/undefined values
    }
    // Use our new, powerful, recursive helper for every value.
    const icrcValue = serializeIcrc16Value(value);
    metadata.push([key, icrcValue]);
  }

  return metadata;
}

/**
 * Deserializes a single ICRC-16 variant value into a corresponding JavaScript primitive.
 * @param value The ICRC-16 variant object (e.g., { Text: "hello" }).
 * @returns The unwrapped JavaScript value.
 */
export function deserializeIcrc16Value(value: ICRC16): any {
  if ('Text' in value) return value.Text;
  if ('Int' in value) return value.Int;
  if ('Nat' in value) return value.Nat;
  if ('Blob' in value) return value.Blob;
  if ('Bool' in value) return value.Bool;
  if ('Principal' in value) return value.Principal;
  // Handle nested types recursively
  if ('Map' in value) return deserializeFromIcrc16Map(value.Map);
  if ('Array' in value) return value.Array.map(deserializeIcrc16Value);

  // Fallback for any unhandled or unknown types
  console.warn('Unknown ICRC-16 value type:', value);
  return null;
}

/**
 * Deserializes an ICRC-16 Map (an array of key-value pairs) into a JavaScript object.
 * (This function remains unchanged)
 */
export function deserializeFromIcrc16Map(map: ICRC16Map): Record<string, any> {
  if (!map) return {};
  return map.reduce(
    (acc, [key, value]) => {
      acc[key] = deserializeIcrc16Value(value); // This can now use our new helper!
      return acc;
    },
    {} as Record<string, any>,
  );
}
