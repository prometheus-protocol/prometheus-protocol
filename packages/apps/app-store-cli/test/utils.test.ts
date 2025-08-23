import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import { Secp256k1KeyIdentity } from '@dfinity/identity-secp256k1';
import { loadDfxIdentity } from '../src/identity.node';

// Mock the filesystem
vi.mock('node:fs');

describe('loadDfxIdentity', () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReset();
    vi.mocked(fs.readFileSync).mockReset();
  });

  it('should correctly load a Secp256k1 identity', () => {
    // Arrange: A real, PEM-formatted Secp256k1 key
    const pemContent =
      '-----BEGIN EC PRIVATE KEY-----\nMHQCAQEEIM53iHDOpOvUELwwcOue2LQeHsbBMKcWqO7mZZNjjEDOoAcGBSuBBAAK\noUQDQgAEAXD7XUoF5M+gjAAQT5fs1jcxv5ibpF4LG40jG8wWl49KDApuRJ5itcua\n0G0SQAi3loGa8tzArrU3uW2mO10kOw==\n-----END EC PRIVATE KEY-----';
    vi.mocked(fs.existsSync).mockImplementation((path) =>
      path.toString().endsWith('.pem'),
    );
    vi.mocked(fs.readFileSync).mockReturnValue(pemContent);

    // Act
    const identity = loadDfxIdentity('test-secp256k1');

    // Assert
    expect(identity).toBeInstanceOf(Secp256k1KeyIdentity);
  });

  it('should throw an error for encrypted identities', () => {
    // Arrange
    vi.mocked(fs.existsSync).mockImplementation((path) =>
      path.toString().endsWith('.pem.encrypted'),
    );

    // Act & Assert
    expect(() => loadDfxIdentity('encrypted-id')).toThrow(
      /Identity 'encrypted-id' is encrypted/,
    );
  });
});
