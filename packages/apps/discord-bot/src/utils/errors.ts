/**
 * Centralized error handling system for the Discord bot
 * Provides consistent error types, handling strategies, and user-friendly messages
 */

import { logger, LogContext } from './logger.js';

// Base error class for all bot-specific errors
export abstract class BotError extends Error {
  abstract readonly code: string;
  abstract readonly userMessage: string;
  abstract readonly isRetryable: boolean;

  constructor(
    message: string,
    public readonly context?: Record<string, any>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Authentication and authorization errors
export class AuthenticationError extends BotError {
  readonly code = 'AUTH_ERROR';
  readonly userMessage =
    'Authentication failed. Please check your credentials.';
  readonly isRetryable = false;
}

export class AuthorizationError extends BotError {
  readonly code = 'AUTHZ_ERROR';
  readonly userMessage = 'You do not have permission to perform this action.';
  readonly isRetryable = false;
}

export class NotFoundError extends BotError {
  readonly code = 'NOT_FOUND';
  readonly userMessage = 'The requested resource was not found.';
  readonly isRetryable = false;
}

// MCP-related errors
export class MCPError extends BotError {
  readonly code = 'MCP_ERROR';
  readonly userMessage = 'Failed to connect to external service.';
  readonly isRetryable = true;
}

export class MCPConnectionError extends BotError {
  readonly code = 'MCP_CONNECTION_ERROR';
  readonly userMessage = 'Could not establish connection to service.';
  readonly isRetryable = true;
}

export class MCPToolError extends BotError {
  readonly code = 'MCP_TOOL_ERROR';
  readonly userMessage = 'External tool execution failed.';
  readonly isRetryable = true;
}

// LLM service errors
export class LLMError extends BotError {
  readonly code = 'LLM_ERROR';
  readonly userMessage = 'AI service is currently unavailable.';
  readonly isRetryable = true;
}

export class LLMRateLimitError extends BotError {
  readonly code = 'LLM_RATE_LIMIT';
  readonly userMessage =
    'AI service rate limit exceeded. Please try again later.';
  readonly isRetryable = true;
}

// Database errors
export class DatabaseError extends BotError {
  readonly code = 'DB_ERROR';
  readonly userMessage = 'Database operation failed.';
  readonly isRetryable = true;
}

// Validation errors
export class ValidationError extends BotError {
  readonly code = 'VALIDATION_ERROR';
  readonly userMessage = 'Invalid input provided.';
  readonly isRetryable = false;
}

// Rate limiting errors
export class RateLimitError extends BotError {
  readonly code = 'RATE_LIMIT';
  readonly userMessage = 'Too many requests. Please slow down.';
  readonly isRetryable = true;
}

// Network errors
export class NetworkError extends BotError {
  readonly code = 'NETWORK_ERROR';
  readonly userMessage = 'Network request failed. Please try again.';
  readonly isRetryable = true;
}

// Error handling options
export interface ErrorHandlerOptions {
  service?: string;
  userId?: string;
  action?: string;
  context?: Record<string, any>;
}

// Main error handler class
export class ErrorHandler {
  /**
   * Handle an error with consistent logging and user messaging
   */
  static async handle<T>(
    error: unknown,
    fallbackHandler: (userMessage: string) => Promise<T> | T,
    options?: ErrorHandlerOptions,
  ): Promise<T> {
    const botError = this.toBotError(error);

    // Determine if we should log (don't log validation errors by default)
    const shouldLog = !(botError instanceof ValidationError);

    // Log the error with the main logger
    const logContext: LogContext = {
      service: options?.service || 'ErrorHandler',
      userId: options?.userId,
      action: options?.action,
    };

    if (shouldLog) {
      logger.error(botError.message, botError, logContext);
    }

    // Call the fallback handler with user-friendly message
    return await fallbackHandler(botError.userMessage);
  }

  /**
   * Convert any error to a BotError
   */
  static toBotError(error: unknown): BotError {
    if (error instanceof BotError) {
      return error;
    }

    if (error instanceof Error) {
      // Try to map common error types
      if (
        error.message.includes('authentication') ||
        error.message.includes('unauthorized')
      ) {
        return new AuthenticationError(error.message);
      }
      if (
        error.message.includes('permission') ||
        error.message.includes('forbidden')
      ) {
        return new AuthorizationError(error.message);
      }
      if (error.message.includes('rate limit')) {
        return new RateLimitError(error.message);
      }
      if (
        error.message.includes('network') ||
        error.message.includes('connection')
      ) {
        return new NetworkError(error.message);
      }

      // Default to generic error
      return new (class extends BotError {
        readonly code = 'UNKNOWN_ERROR';
        readonly userMessage = 'An unexpected error occurred.';
        readonly isRetryable = false;
      })(error.message);
    }

    // Handle non-Error objects
    const message = String(error);
    return new (class extends BotError {
      readonly code = 'UNKNOWN_ERROR';
      readonly userMessage = 'An unexpected error occurred.';
      readonly isRetryable = false;
    })(message);
  }

  /**
   * Log an error with structured context
   */
  static logError(error: unknown, context: LogContext): void {
    const botError = this.toBotError(error);
    logger.error(botError.message, botError, context);
  }
}

// Utility function for retryable operations
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
  backoffMultiplier: number = 2,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on non-retryable errors
      const botError = ErrorHandler.toBotError(error);
      if (!botError.isRetryable) {
        throw error;
      }

      // Don't delay on the last attempt
      if (attempt < maxRetries) {
        const currentDelay = delay * Math.pow(backoffMultiplier, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, currentDelay));
      }
    }
  }

  throw lastError!;
}
