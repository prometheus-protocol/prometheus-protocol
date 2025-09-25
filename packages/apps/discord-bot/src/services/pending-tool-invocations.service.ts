import logger from '../utils/logger.js';

interface PendingInvocation {
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  userId: string;
  toolName: string;
  startTime: Date;
}

/**
 * Service to manage pending tool invocations that are waiting for results.
 * This allows the Discord bot to wait for MCP tool results before responding to users.
 */
export class PendingToolInvocationsService {
  private pendingInvocations = new Map<string, PendingInvocation>();
  private readonly TIMEOUT_MS = 300_000; // 5 minutes timeout

  /**
   * Register a new pending tool invocation
   */
  createPendingInvocation(
    invocationId: string,
    userId: string,
    toolName: string,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      // Clean up any existing invocation with the same ID
      this.cleanupInvocation(invocationId);

      // Set up timeout
      const timeout = setTimeout(() => {
        logger.warn(
          `[PendingInvocations] Tool invocation ${invocationId} timed out after ${this.TIMEOUT_MS}ms`,
        );
        this.cleanupInvocation(invocationId);
        reject(
          new Error(
            `Tool invocation timed out after ${this.TIMEOUT_MS / 1000} seconds`,
          ),
        );
      }, this.TIMEOUT_MS);

      // Store the pending invocation
      this.pendingInvocations.set(invocationId, {
        resolve,
        reject,
        timeout,
        userId,
        toolName,
        startTime: new Date(),
      });

      logger.debug(
        `[PendingInvocations] Registered pending invocation ${invocationId} for tool ${toolName}`,
      );
    });
  }

  /**
   * Resolve a pending tool invocation with a successful result
   */
  resolveInvocation(invocationId: string, result: any): boolean {
    const pending = this.pendingInvocations.get(invocationId);
    if (!pending) {
      logger.warn(
        `[PendingInvocations] Attempted to resolve unknown invocation ${invocationId}`,
      );
      return false;
    }

    logger.info(
      `[PendingInvocations] Resolving invocation ${invocationId} for tool ${pending.toolName} (took ${Date.now() - pending.startTime.getTime()}ms)`,
    );

    clearTimeout(pending.timeout);
    pending.resolve(result);
    this.pendingInvocations.delete(invocationId);
    return true;
  }

  /**
   * Reject a pending tool invocation with an error
   */
  rejectInvocation(invocationId: string, error: Error): boolean {
    const pending = this.pendingInvocations.get(invocationId);
    if (!pending) {
      logger.warn(
        `[PendingInvocations] Attempted to reject unknown invocation ${invocationId}`,
      );
      return false;
    }

    logger.warn(
      `[PendingInvocations] Rejecting invocation ${invocationId} for tool ${pending.toolName}: ${error.message}`,
    );

    clearTimeout(pending.timeout);
    pending.reject(error);
    this.pendingInvocations.delete(invocationId);
    return true;
  }

  /**
   * Get information about a pending invocation
   */
  getPendingInvocation(invocationId: string): PendingInvocation | undefined {
    return this.pendingInvocations.get(invocationId);
  }

  /**
   * Get all pending invocations for a user
   */
  getUserPendingInvocations(userId: string): Map<string, PendingInvocation> {
    const userInvocations = new Map<string, PendingInvocation>();
    for (const [invocationId, pending] of this.pendingInvocations) {
      if (pending.userId === userId) {
        userInvocations.set(invocationId, pending);
      }
    }
    return userInvocations;
  }

  /**
   * Clean up a specific invocation
   */
  private cleanupInvocation(invocationId: string): void {
    const pending = this.pendingInvocations.get(invocationId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingInvocations.delete(invocationId);
    }
  }

  /**
   * Get statistics about pending invocations
   */
  getStats(): {
    totalPending: number;
    oldestInvocation?: { id: string; age: number };
  } {
    const stats = {
      totalPending: this.pendingInvocations.size,
      oldestInvocation: undefined as { id: string; age: number } | undefined,
    };

    let oldestTime = Date.now();
    let oldestId = '';

    for (const [invocationId, pending] of this.pendingInvocations) {
      const startTime = pending.startTime.getTime();
      if (startTime < oldestTime) {
        oldestTime = startTime;
        oldestId = invocationId;
      }
    }

    if (oldestId) {
      stats.oldestInvocation = {
        id: oldestId,
        age: Date.now() - oldestTime,
      };
    }

    return stats;
  }

  /**
   * Clean up all pending invocations (for shutdown)
   */
  cleanup(): void {
    logger.info(
      `[PendingInvocations] Cleaning up ${this.pendingInvocations.size} pending invocations`,
    );

    for (const [invocationId, pending] of this.pendingInvocations) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Service is shutting down'));
    }

    this.pendingInvocations.clear();
  }
}
