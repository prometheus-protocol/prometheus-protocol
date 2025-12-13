/**
 * Obfuscates sensitive information in URLs (like API keys in query parameters or path segments)
 * while keeping the URL recognizable for debugging.
 *
 * Examples:
 * - https://mcp.zapier.com/api/mcp/s/YmZmYjE5ZTctODNkMS00ZTFkLWIyNDQtZWQwZGVkNWI5MjY1
 *   → https://mcp.zapier.com/api/mcp/s/Ym***jY1
 * - https://example.com?api_key=secret123&foo=bar
 *   → https://example.com?api_key=***&foo=bar
 */
export function obfuscateUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // Obfuscate query parameters that look like API keys
    const sensitiveParams = [
      'api_key',
      'apikey',
      'key',
      'token',
      'secret',
      'password',
      'auth',
    ];
    urlObj.searchParams.forEach((value, key) => {
      if (sensitiveParams.some((param) => key.toLowerCase().includes(param))) {
        urlObj.searchParams.set(key, '***');
      }
    });

    // Obfuscate path segments that look like API keys (long alphanumeric strings)
    const pathParts = urlObj.pathname.split('/');
    const obfuscatedParts = pathParts.map((part) => {
      // If segment is longer than 20 chars and alphanumeric, it might be an API key
      if (part.length > 20 && /^[a-zA-Z0-9_-]+$/.test(part)) {
        // Show first 2 and last 3 characters
        return part.slice(0, 2) + '***' + part.slice(-3);
      }
      return part;
    });
    urlObj.pathname = obfuscatedParts.join('/');

    return urlObj.toString();
  } catch (error) {
    // If URL parsing fails, just hide everything after the domain
    const match = url.match(/^(https?:\/\/[^\/]+)/);
    return match ? `${match[1]}/***` : '***';
  }
}
