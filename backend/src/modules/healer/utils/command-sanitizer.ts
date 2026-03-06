/**
 * Command Sanitizer Utility
 * Prevents command injection vulnerabilities by sanitizing inputs
 */

export class CommandSanitizer {
  /**
   * Escape shell arguments to prevent command injection
   */
  static escapeShellArg(arg: string): string {
    if (!arg) return "''";
    
    // Replace single quotes with '\'' and wrap in single quotes
    return "'" + arg.replace(/'/g, "'\\''") + "'";
  }

  /**
   * Validate and sanitize file path
   */
  static sanitizePath(path: string): string {
    if (!path) {
      throw new Error('Path cannot be empty');
    }

    // Remove any null bytes
    path = path.replace(/\0/g, '');

    // Check for path traversal attempts
    if (path.includes('..') || path.includes('~')) {
      throw new Error('Path traversal detected');
    }

    // Ensure path starts with /
    if (!path.startsWith('/')) {
      throw new Error('Path must be absolute');
    }

    // Remove trailing slashes
    path = path.replace(/\/+$/, '');

    return path;
  }

  /**
   * Validate domain name
   */
  static sanitizeDomain(domain: string): string {
    if (!domain) {
      throw new Error('Domain cannot be empty');
    }

    // Remove protocol if present
    domain = domain.replace(/^https?:\/\//, '');

    // Remove trailing slash
    domain = domain.replace(/\/$/, '');

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!domainRegex.test(domain)) {
      throw new Error('Invalid domain format');
    }

    return domain;
  }

  /**
   * Validate server ID (UUID format)
   */
  static validateServerId(serverId: string): void {
    if (!serverId) {
      throw new Error('Server ID cannot be empty');
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(serverId)) {
      throw new Error('Invalid server ID format');
    }
  }

  /**
   * Build safe grep command with escaped pattern
   */
  static buildGrepCommand(pattern: string, path: string, options: string = ''): string {
    const escapedPattern = this.escapeShellArg(pattern);
    const escapedPath = this.escapeShellArg(path);
    
    return `grep ${options} ${escapedPattern} ${escapedPath} 2>/dev/null || true`;
  }

  /**
   * Build safe find command
   */
  static buildFindCommand(path: string, options: string): string {
    const escapedPath = this.escapeShellArg(path);
    
    return `find ${escapedPath} ${options} 2>/dev/null || true`;
  }

  /**
   * Sanitize MySQL identifier (database name, table name, column name)
   */
  static sanitizeMySQLIdentifier(identifier: string): string {
    if (!identifier) {
      throw new Error('MySQL identifier cannot be empty');
    }

    // Remove any backticks
    identifier = identifier.replace(/`/g, '');

    // Validate identifier format (alphanumeric, underscore, max 64 chars)
    if (!/^[a-zA-Z0-9_]{1,64}$/.test(identifier)) {
      throw new Error('Invalid MySQL identifier format');
    }

    // Wrap in backticks for safe use
    return `\`${identifier}\``;
  }

  /**
   * Create temporary MySQL config file content
   */
  static createMySQLConfigContent(config: {
    host: string;
    user: string;
    password: string;
    database?: string;
  }): string {
    return `[client]
user=${config.user}
password=${config.password}
host=${config.host}
${config.database ? `database=${config.database}` : ''}
`;
  }
}
