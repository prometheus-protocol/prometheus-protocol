import { logger } from '../utils/logger.js';

// Use `unknown` for the rejection reason, as the type of an error is not guaranteed.
type RequestResolver<T> = {
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

class PendingRequestManager {
  // The map now stores resolvers for `unknown` types. This is more honest,
  // as the map contains resolvers for many different types, not just one.
  private pending = new Map<string, RequestResolver<unknown>>();
  private readonly TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Creates a Promise that will wait for a result of type T.
   * This is called by the code that initiates a request.
   */
  public waitForResponse<T>(invocationId: string): Promise<T> {
    // The promise is correctly typed to T.
    const promise = new Promise<T>((resolve, reject) => {
      // We store the resolver functions. A type assertion is needed here because
      // we are storing a specific `RequestResolver<T>` in a map that holds
      // generic `RequestResolver<unknown>`. This is a safe and necessary
      // assertion to bridge the specific and generic worlds.
      this.pending.set(invocationId, {
        resolve,
        reject,
      } as RequestResolver<unknown>);

      // CRITICAL: Add a timeout to prevent memory leaks from abandoned requests
      setTimeout(() => {
        const resolver = this.pending.get(invocationId);
        if (resolver) {
          logger.warn(
            `[PendingRequestManager] Request ${invocationId} timed out.`,
          );
          // The promise is rejected, and the resolver is cleaned up.
          resolver.reject(
            new Error(`Request timed out after ${this.TIMEOUT_MS / 1000}s`),
          );
          this.pending.delete(invocationId);
        }
      }, this.TIMEOUT_MS);
    });

    return promise;
  }

  /**
   * Resolves a pending request with the final data.
   * The `result` is `unknown` because this method doesn't know the specific
   * type `T` that the original promise expects. The promise resolution
   * itself will handle the final type assignment.
   */
  public resolveRequest(invocationId: string, result: unknown): void {
    const resolver = this.pending.get(invocationId);
    if (resolver) {
      logger.info(`[PendingRequestManager] Resolving request ${invocationId}.`);
      resolver.resolve(result);
      this.pending.delete(invocationId);
    } else {
      logger.warn(
        `[PendingRequestManager] No pending request found for invocationId ${invocationId} to resolve.`,
      );
    }
  }

  /**
   * Rejects a pending request with an error.
   * The `error` is `unknown` which is the standard for catch blocks and
   * promise rejections in modern TypeScript.
   */
  public rejectRequest(invocationId: string, error: unknown): void {
    const resolver = this.pending.get(invocationId);
    if (resolver) {
      logger.info(`[PendingRequestManager] Rejecting request ${invocationId}.`);
      resolver.reject(error);
      this.pending.delete(invocationId);
    } else {
      logger.warn(
        `[PendingRequestManager] No pending request found for invocationId ${invocationId} to reject.`,
      );
    }
  }
}

// Export as a singleton instance
export const pendingRequestManager = new PendingRequestManager();
