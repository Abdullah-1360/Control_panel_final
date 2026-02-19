import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

  // Dangerous command patterns (expanded list)
  private readonly dangerousPatterns = [
    // Destructive operations
    /rm\s+-rf\s+\//,           // rm -rf /
    /rm\s+-fr\s+\//,           // rm -fr /
    /rm\s+.*\.\.\//,           // rm with parent directory traversal
    /rm\s+.*~\//,              // rm with home directory
    /dd\s+if=/,                // dd command (disk operations)
    /mkfs/,                    // filesystem formatting
    /fdisk/,                   // disk partitioning
    
    // System control
    /shutdown/,                // system shutdown
    /reboot/,                  // system reboot
    /halt/,                    // system halt
    /poweroff/,                // power off
    /init\s+0/,                // init 0 (shutdown)
    /init\s+6/,                // init 6 (reboot)
    
    // User/permission manipulation
    /userdel/,                 // delete user
    /passwd/,                  // change password
    /chmod\s+777/,             // overly permissive permissions
    /chown\s+root/,            // change owner to root
    
    // Network attacks
    /wget.*\|\s*sh/,           // download and execute
    /curl.*\|\s*sh/,           // download and execute
    /nc\s+-l/,                 // netcat listener
    /ncat\s+-l/,               // ncat listener
    
    // Code injection
    /eval\s*\(/,               // eval() in shell
    /exec\s*\(/,               // exec() in shell
    /system\s*\(/,             // system() call
    /`.*`/,                    // backtick execution
    /\$\(.*\)/,                // command substitution
    
    // File manipulation
    />\s*\/etc\//,             // redirect to /etc
    />\s*\/var\//,             // redirect to /var
    />\s*\/usr\//,             // redirect to /usr
    />\s*\/bin\//,             // redirect to /bin
    
    // Database operations
    /DROP\s+DATABASE/i,        // drop database
    /DROP\s+TABLE/i,           // drop table
    /TRUNCATE/i,               // truncate table
    
    // Compression bombs
    /tar\s+.*bomb/,            // tar bomb
    /zip\s+.*bomb/,            // zip bomb
    
    // Fork bombs
    /:\(\)\{.*:\|:&\};:/,      // bash fork bomb
  ];

  // Safe command whitelist
  private readonly safeCommands = [
    'wp',                      // WP-CLI commands
    'ls',                      // list files
    'cat',                     // read files
    'grep',                    // search
    'tail',                    // read file tail
    'head',                    // read file head
    'find',                    // find files
    'stat',                    // file stats
    'test',                    // test conditions
    'echo',                    // print
    'pwd',                     // print working directory
    'whoami',                  // current user
    'date',                    // current date
    'df',                      // disk space
    'du',                      // disk usage
    'quota',                   // disk quota
    'mysql',                   // database client
    'php',                     // PHP CLI
    'openssl',                 // SSL operations
    'mv',                      // move/rename (with restrictions)
    'cp',                      // copy (with restrictions)
    'mkdir',                   // create directory
  ];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate command for security
   */
  validateCommand(command: string): { safe: boolean; reason?: string } {
    // Check for dangerous patterns
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(command)) {
        return {
          safe: false,
          reason: `Command contains dangerous pattern: ${pattern.source}`,
        };
      }
    }

    // Extract base command
    const baseCommand = command.trim().split(/\s+/)[0];

    // Check if command is in whitelist
    const isWhitelisted = this.safeCommands.some(safe => 
      baseCommand === safe || baseCommand.startsWith(safe + '/')
    );

    if (!isWhitelisted) {
      return {
        safe: false,
        reason: `Command '${baseCommand}' is not in whitelist`,
      };
    }

    // Additional checks for specific commands
    if (baseCommand === 'mv' || baseCommand === 'cp') {
      // Ensure not moving/copying to system directories
      if (/\/(etc|var|usr|bin|sbin|boot|sys|proc)\//.test(command)) {
        return {
          safe: false,
          reason: 'Cannot move/copy to system directories',
        };
      }
    }

    if (baseCommand === 'mysql') {
      // Ensure no DROP/TRUNCATE commands
      if (/DROP|TRUNCATE/i.test(command)) {
        return {
          safe: false,
          reason: 'Destructive database operations not allowed',
        };
      }
    }

    return { safe: true };
  }

  /**
   * Validate multiple commands
   */
  validateCommands(commands: string[]): { safe: boolean; invalidCommands: string[] } {
    const invalidCommands: string[] = [];

    for (const command of commands) {
      // Skip comments
      if (command.trim().startsWith('#')) continue;

      const validation = this.validateCommand(command);
      if (!validation.safe) {
        invalidCommands.push(`${command} (${validation.reason})`);
      }
    }

    return {
      safe: invalidCommands.length === 0,
      invalidCommands,
    };
  }

  /**
   * Log audit event
   */
  async logAudit(params: {
    userId?: string;
    userEmail?: string;
    ipAddress?: string;
    userAgent?: string;
    action: string;
    resource: string;
    resourceType: string;
    details: any;
    changes?: any;
    siteId?: string;
    executionId?: string;
    success: boolean;
    errorMessage?: string;
    duration?: number;
  }): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        INSERT INTO healer_audit_logs (
          id, user_id, user_email, ip_address, user_agent,
          action, resource, resource_type, details, changes,
          site_id, execution_id, success, error_message, timestamp, duration
        ) VALUES (
          gen_random_uuid(),
          ${params.userId}, ${params.userEmail}, ${params.ipAddress}, ${params.userAgent},
          ${params.action}, ${params.resource}, ${params.resourceType},
          ${JSON.stringify(params.details)}, ${params.changes ? JSON.stringify(params.changes) : null},
          ${params.siteId}, ${params.executionId}, ${params.success},
          ${params.errorMessage}, NOW(), ${params.duration}
        )
      `;
    } catch (error) {
      this.logger.error(`Failed to log audit event: ${(error as Error).message}`);
    }
  }

  /**
   * Get audit logs
   */
  async getAuditLogs(filters: {
    userId?: string;
    siteId?: string;
    executionId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(filters.userId);
    }
    if (filters.siteId) {
      conditions.push(`site_id = $${paramIndex++}`);
      params.push(filters.siteId);
    }
    if (filters.executionId) {
      conditions.push(`execution_id = $${paramIndex++}`);
      params.push(filters.executionId);
    }
    if (filters.action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(filters.action);
    }
    if (filters.startDate) {
      conditions.push(`timestamp >= $${paramIndex++}`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push(`timestamp <= $${paramIndex++}`);
      params.push(filters.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get logs
    const logs = await this.prisma.$queryRawUnsafe(`
      SELECT * FROM healer_audit_logs
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ${limit} OFFSET ${skip}
    `, ...params);

    // Get total count
    const countResult = await this.prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count FROM healer_audit_logs
      ${whereClause}
    `, ...params) as any[];

    const total = parseInt(countResult[0]?.count || '0');

    return {
      data: (logs as any[]).map(log => ({
        ...log,
        details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details,
        changes: log.changes && typeof log.changes === 'string' ? JSON.parse(log.changes) : log.changes,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
