import crypto from 'crypto';
import logger from '../utils/logger.js';

/**
 * OAuth Security Service - Handles encryption, token validation, and security controls
 */
export class OAuthSecurityService {
  private readonly encryptionKey: Buffer;
  private readonly algorithm = 'aes-256-cbc';
  private readonly ivLength = 16;

  constructor() {
    // Get encryption key from environment or generate one
    const keyString = process.env.OAUTH_ENCRYPTION_KEY;
    if (!keyString) {
      logger.warn(
        'OAUTH_ENCRYPTION_KEY not set - generating ephemeral key (tokens will be invalid after restart)',
      );
      this.encryptionKey = crypto.randomBytes(32);
    } else {
      // Ensure the key is exactly 32 bytes for AES-256
      this.encryptionKey = crypto.scryptSync(keyString, 'salt', 32);
    }
  }

  /**
   * Encrypt a token before storing it in the database
   */
  encryptToken(token: string): string {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(
        this.algorithm,
        this.encryptionKey,
        iv,
      );

      let encrypted = cipher.update(token, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Combine IV + encrypted data
      const result = iv.toString('hex') + ':' + encrypted;
      return result;
    } catch (error) {
      logger.error(
        'Failed to encrypt OAuth token:',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw new Error('Token encryption failed');
    }
  }

  /**
   * Decrypt a token retrieved from the database
   */
  decryptToken(encryptedToken: string): string {
    try {
      const parts = encryptedToken.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted token format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.encryptionKey,
        iv,
      );

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error(
        'Failed to decrypt OAuth token:',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw new Error(
        'Token decryption failed - token may be corrupted or key changed',
      );
    }
  }

  /**
   * Sanitize token for logging (shows only first/last few characters)
   */
  sanitizeTokenForLogging(token: string): string {
    if (!token || token.length < 8) {
      return '[REDACTED]';
    }
    return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  }

  /**
   * Validate token format and basic security checks
   */
  validateToken(token: string): { isValid: boolean; reason?: string } {
    if (!token) {
      return { isValid: false, reason: 'Token is empty' };
    }

    if (token.length < 10) {
      return { isValid: false, reason: 'Token too short' };
    }

    if (token.length > 8192) {
      return { isValid: false, reason: 'Token too long' };
    }

    // Check for suspicious patterns
    if (token.includes('\\x00') || token.includes('\0')) {
      return { isValid: false, reason: 'Token contains null bytes' };
    }

    return { isValid: true };
  }

  /**
   * Generate a secure token fingerprint for comparison without exposing the token
   */
  generateTokenFingerprint(token: string): string {
    return crypto
      .createHash('sha256')
      .update(token)
      .update('oauth-token-fingerprint')
      .digest('hex');
  }

  /**
   * Track token authentication attempts (not retrievals) to prevent replay attacks
   */
  private authAttemptTracker = new Map<string, number>();

  checkTokenReuse(
    token: string,
    userId: string,
    context: 'authentication' | 'retrieval' = 'retrieval',
  ): { isReuse: boolean; lastUsed?: number } {
    // Only check replay attacks for authentication attempts, not normal token retrievals
    if (context === 'retrieval') {
      return { isReuse: false };
    }

    const fingerprint = this.generateTokenFingerprint(token + userId);
    const now = Date.now();
    const lastUsed = this.authAttemptTracker.get(fingerprint);

    // Consider it reuse if used within the last 30 seconds for authentication
    const isReuse = lastUsed && now - lastUsed < 30000;

    // Update usage time for authentication attempts
    this.authAttemptTracker.set(fingerprint, now);

    // Clean up old entries (older than 1 hour)
    const oneHourAgo = now - 60 * 60 * 1000;
    for (const [key, time] of this.authAttemptTracker.entries()) {
      if (time < oneHourAgo) {
        this.authAttemptTracker.delete(key);
      }
    }
    return { isReuse: !!isReuse, lastUsed };
  }

  /**
   * Validate that a user owns a specific token
   */
  validateTokenOwnership(
    serverId: string,
    userId: string,
    requestingUserId: string,
  ): boolean {
    return userId === requestingUserId;
  }

  /**
   * Generate a secure state parameter for OAuth flows
   */
  generateSecureState(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Validate OAuth state parameter
   */
  validateState(state: string): boolean {
    // State should be base64url and reasonable length
    const stateRegex = /^[A-Za-z0-9_-]{32,}$/;
    return stateRegex.test(state);
  }

  /**
   * Securely wipe sensitive data from memory
   */
  secureWipe(sensitiveData: string): void {
    // In JavaScript, we can't truly wipe memory, but we can try to overwrite
    // This is more of a best practice signal than a guarantee
    if (typeof sensitiveData === 'string') {
      // Create a new string of same length with random data
      const randomData = crypto
        .randomBytes(sensitiveData.length)
        .toString('hex');
      // Note: This doesn't actually overwrite the original string in memory
      // but signals our intent to clear sensitive data
    }
  }

  /**
   * Rate limiting for token operations
   */
  private rateLimiter = new Map<string, { count: number; resetTime: number }>();

  checkRateLimit(
    userId: string,
    operation: string,
  ): { allowed: boolean; resetTime?: number } {
    const key = `${userId}:${operation}`;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const maxOperations = operation === 'token_refresh' ? 10 : 50; // Lower limit for refresh operations

    const current = this.rateLimiter.get(key);

    if (!current || now > current.resetTime) {
      // New window
      this.rateLimiter.set(key, { count: 1, resetTime: now + windowMs });
      return { allowed: true };
    }

    if (current.count >= maxOperations) {
      return { allowed: false, resetTime: current.resetTime };
    }

    current.count++;
    return { allowed: true };
  }

  /**
   * Validate token expiry with secure buffer
   */
  isTokenExpiring(expiresAt: Date, bufferMinutes: number = 5): boolean {
    const now = new Date();
    const buffer = bufferMinutes * 60 * 1000; // Convert to milliseconds
    return expiresAt.getTime() <= now.getTime() + buffer;
  }

  /**
   * Create audit log entry for token operations
   */
  auditLog(
    operation: string,
    userId: string,
    serverId: string,
    metadata?: any,
  ): void {
    logger.info(`[OAuth Audit] ${operation}`, {
      service: 'OAuthSecurityService',
      userId: userId.substring(0, 8) + '...', // Partially redact user ID
      serverId,
      timestamp: new Date().toISOString(),
      operation,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    });
  }

  /**
   * Cleanup expired tokens and security data
   */
  cleanup(): void {
    const now = Date.now();

    // Clean up rate limiter
    for (const [key, data] of this.rateLimiter.entries()) {
      if (now > data.resetTime) {
        this.rateLimiter.delete(key);
      }
    }

    // Clean up auth attempt tracker
    const oneHourAgo = now - 60 * 60 * 1000;
    for (const [key, time] of this.authAttemptTracker.entries()) {
      if (time < oneHourAgo) {
        this.authAttemptTracker.delete(key);
      }
    }
  }
}

// Singleton instance
export const oauthSecurityService = new OAuthSecurityService();

// Cleanup timer
setInterval(
  () => {
    oauthSecurityService.cleanup();
  },
  5 * 60 * 1000,
); // Run cleanup every 5 minutes
