import { describe, it, expect } from 'vitest';
import { Principal } from '@icp-sdk/core/principal';
import {
  serializeIcrc16Value,
  serializeToIcrc16Map,
  deserializeIcrc16Value,
  deserializeFromIcrc16Map,
} from '../src/icrc16'; // Adjust the import path as needed

describe('ICRC-16 Serialization Utilities', () => {
  // --- Test Data ---
  const testPrincipal = Principal.fromText('bkyz2-fmaaa-aaaaa-qaaaq-cai');
  const testBlob = new Uint8Array([10, 20, 30]);

  // A complex object containing all supported data types
  const complexJsObject = {
    name: 'Test Object',
    count: 42,
    total: 1000000n,
    isActive: true,
    owner: testPrincipal,
    data: testBlob,
    tags: ['a', 'b', 123, false],
    nested: {
      key: 'value',
      deepPrincipal: testPrincipal,
    },
    emptyArray: [],
    shouldBeSkipped: null, // This should not appear in the serialized output
    alsoSkipped: undefined,
  };

  // --- The most important test: The Round-trip ---
  describe('Serialization/Deserialization Round-trip', () => {
    it('should correctly serialize and deserialize a complex object back to its original form', () => {
      // 1. Serialize the entire object to an ICRC-16 Map
      const serializedMap = serializeToIcrc16Map(complexJsObject);

      // 2. Deserialize it back to a JavaScript object
      const deserializedObject = deserializeFromIcrc16Map(serializedMap);

      // 3. Create the expected object (the original, but without the null/undefined keys)
      const expectedObject = {
        name: 'Test Object',
        count: 42n, // Note: numbers become bigints
        total: 1000000n,
        isActive: true,
        owner: testPrincipal,
        data: [10, 20, 30], // Note: Uint8Array becomes a number array
        tags: ['a', 'b', 123n, false],
        nested: {
          key: 'value',
          deepPrincipal: testPrincipal,
        },
        emptyArray: [],
      };

      // 4. Assert that the deserialized object is deeply equal to our expectation
      expect(deserializedObject).toEqual(expectedObject);
    });
  });

  // --- Granular tests for the core serializer ---
  describe('serializeIcrc16Value', () => {
    it('should serialize a string to a Text variant', () => {
      expect(serializeIcrc16Value('hello')).toEqual({ Text: 'hello' });
    });

    it('should serialize a number to a Nat variant', () => {
      expect(serializeIcrc16Value(123)).toEqual({ Nat: 123n });
    });

    it('should serialize a bigint to a Nat variant', () => {
      expect(serializeIcrc16Value(456n)).toEqual({ Nat: 456n });
    });

    it('should serialize a boolean to a Bool variant', () => {
      expect(serializeIcrc16Value(true)).toEqual({ Bool: true });
      expect(serializeIcrc16Value(false)).toEqual({ Bool: false });
    });

    it('should serialize a Principal to a Principal variant', () => {
      expect(serializeIcrc16Value(testPrincipal)).toEqual({
        Principal: testPrincipal,
      });
    });

    it('should serialize a Uint8Array to a Blob variant', () => {
      expect(serializeIcrc16Value(testBlob)).toEqual({ Blob: [10, 20, 30] });
    });

    it('should recursively serialize an array to an Array variant', () => {
      const arr = ['text', 99, true];
      const expected = {
        Array: [{ Text: 'text' }, { Nat: 99n }, { Bool: true }],
      };
      expect(serializeIcrc16Value(arr)).toEqual(expected);
    });

    it('should recursively serialize an object to a Map variant', () => {
      const obj = { key: 'value' };
      const expected = {
        Map: [['key', { Text: 'value' }]],
      };
      expect(serializeIcrc16Value(obj)).toEqual(expected);
    });

    it('should handle null or undefined with a fallback', () => {
      expect(serializeIcrc16Value(null)).toEqual({ Text: '' });
      expect(serializeIcrc16Value(undefined)).toEqual({ Text: '' });
    });
  });

  // --- Granular tests for the core deserializer ---
  describe('deserializeIcrc16Value', () => {
    it('should deserialize a Text variant to a string', () => {
      expect(deserializeIcrc16Value({ Text: 'world' })).toBe('world');
    });

    it('should deserialize a Nat variant to a bigint', () => {
      expect(deserializeIcrc16Value({ Nat: 123n })).toBe(123n);
    });

    it('should deserialize a Bool variant to a boolean', () => {
      expect(deserializeIcrc16Value({ Bool: true })).toBe(true);
    });

    it('should deserialize a Principal variant', () => {
      expect(deserializeIcrc16Value({ Principal: testPrincipal })).toBe(
        testPrincipal,
      );
    });

    it('should deserialize a Blob variant to a number array', () => {
      expect(deserializeIcrc16Value({ Blob: [1, 2, 3] })).toEqual([1, 2, 3]);
    });

    it('should recursively deserialize an Array variant', () => {
      const icrcArray = {
        Array: [{ Text: 'text' }, { Nat: 99n }, { Bool: false }],
      };
      expect(deserializeIcrc16Value(icrcArray)).toEqual(['text', 99n, false]);
    });
  });
});
