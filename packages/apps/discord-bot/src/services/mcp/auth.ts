/**
 * MCP Authentication error types
 */

export class OAuthAuthorizationRequiredError extends Error {
  constructor(
    message: string,
    public authUrl?: string,
  ) {
    super(message);
    this.name = 'OAuthAuthorizationRequiredError';
  }
}
