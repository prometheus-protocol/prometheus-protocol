import { describe, it, expect } from 'vitest';
import { HttpAgent } from '@dfinity/agent';

describe('Debug Module Resolution', () => {
  it('should be able to import HttpAgent from @dfinity/agent', () => {
    // If the import itself didn't crash, this test will pass.
    expect(HttpAgent).toBeDefined();
  });
});
