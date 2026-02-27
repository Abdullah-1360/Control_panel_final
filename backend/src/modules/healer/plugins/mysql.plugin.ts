import { Injectable } from '@nestjs/common';
import { servers as Server } from '@prisma/client';
import { SSHExecutorService } from '../services/ssh-executor.service';
import {
  IStackPlugin,
  DetectionResult,
  DiagnosticCheckResult,
  HealingAction,
} from '../interfaces/stack-plugin.interface';

@Injectable()
export class MySQLPlugin implements IStackPlugin {
  name = 'mysql';
  version = '1.0.0';
  supportedVersions = ['5.7', '8.0', '8.1', '8.2', '8.3', '8.4'];

  constructor(protected readonly sshExecutor: SSHExecutorService) {}

  async detect(server: Server, path: string): Promise<DetectionResult> {
    try {
      // Check if MySQL/MariaDB is running
      const processCheck = await this.sshExecutor.executeCommand(
        server.id,
        `ps aux | grep -E "mysqld|mariadbd" | grep -v grep | wc -l`,
      );
      
      const processCount = parseInt(processCheck.trim());
      
      if (processCount === 0) {
        return { detected: false, confidence: 0 };
      }
      
      // Try to get MySQL version
      let version = 'unknown';
      let isMariaDB = false;
      
      try {
        const versionOutput = await this.sshExecutor.executeCommand(
          server.id,
          `mysql --version 2>/dev/null || mysqld --version 2>/dev/null`,
        );
        
        // Parse version from output
        if (versionOutput.includes('MariaDB')) {
          isMariaDB = true;
          const match = versionOutput.match(/(\d+\.\d+\.\d+)-MariaDB/);
          version = match ? match[1] : 'unknown';
        } else {
          const match = versionOutput.match(/Ver (\d+\.\d+\.\d+)/);
          version = match ? match[1] : 'unknown';
        }
      } catch {
        // Version detection failed, but process is running
      }
      
      // Check if port 3306 is listening
      let portListening = false;
      try {
        const portCheck = await this.sshExecutor.executeCommand(
          server.id,
          `netstat -tuln 2>/dev/null | grep ":3306 " | wc -l || ss -tuln 2>/dev/null | grep ":3306 " | wc -l`,
        );
        portListening = parseInt(portCheck.trim()) > 0;
      } catch {
        // Port check failed
      }
      
      return {
        detected: true,
        techStack: 'MYSQL',
        version,
        confidence: portListening ? 0.95 : 0.75,
        metadata: {
          isMariaDB,
          processRunning: processCount > 0,
          portListening,
          defaultPort: 3306,
        },
      };
    } catch (error: any) {
      return { detected: false, confidence: 0 };
    }
  }

  getDiagnosticChecks(): string[] {
    return [
      'mysql_connection',
      'mysql_status',
      'mysql_slow_queries',
      'mysql_table_integrity',
      'mysql_replication_status',
      'mysql_buffer_pool',
      'mysql_disk_usage',
      'mysql_thread_count',
    ];
  }

  async executeDiagnosticCheck(
    checkName: string,
    application: any,
    server: Server,
  ): Promise<DiagnosticCheckResult> {
    const startTime = Date.now();
    
    try {
      switch (checkName) {
        case 'mysql_connection':
          return await this.checkConnection(application, server, startTime);
        case 'mysql_status':
          return await this.checkStatus(application, server, startTime);
        case 'mysql_slow_queries':
          return await this.checkSlowQueries(application, server, startTime);
        case 'mysql_table_integrity':
          return await this.checkTableIntegrity(application, server, startTime);
        case 'mysql_replication_status':
          return await this.checkReplicationStatus(application, server, startTime);
        case 'mysql_buffer_pool':
          return await this.checkBufferPool(application, server, startTime);
        case 'mysql_disk_usage':
          return await this.checkDiskUsage(application, server, startTime);
        case 'mysql_thread_count':
          return await this.checkThreadCount(application, server, startTime);
        default:
          throw new Error(`Unknown check: ${checkName}`);
      }
    } catch (error: any) {
      return {
        checkName,
        category: 'DATABASE',
        status: 'ERROR',
        severity: 'MEDIUM',
        message: `Check failed: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkConnection(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Try to connect to MySQL
      const connectionTest = await this.sshExecutor.executeCommand(
        server.id,
        `mysql -e "SELECT 1;" 2>&1`,
      );
      
      if (connectionTest.includes('ERROR') || connectionTest.includes('Access denied')) {
        return {
          checkName: 'mysql_connection',
          category: 'DATABASE',
          status: 'FAIL',
          severity: 'CRITICAL',
          message: 'Cannot connect to MySQL server',
          details: { error: connectionTest },
          suggestedFix: 'Check MySQL credentials and ensure server is running',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'mysql_connection',
        category: 'DATABASE',
        status: 'PASS',
        severity: 'LOW',
        message: 'MySQL connection successful',
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'mysql_connection',
        category: 'DATABASE',
        status: 'FAIL',
        severity: 'CRITICAL',
        message: `Connection failed: ${error?.message || 'Unknown error'}`,
        suggestedFix: 'Ensure MySQL server is running and accessible',
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkStatus(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Get MySQL status variables
      const statusOutput = await this.sshExecutor.executeCommand(
        server.id,
        `mysql -e "SHOW GLOBAL STATUS LIKE 'Uptime';" 2>/dev/null | grep -v Variable | awk '{print $2}'`,
      );
      
      const uptime = parseInt(statusOutput.trim());
      
      if (isNaN(uptime)) {
        return {
          checkName: 'mysql_status',
          category: 'DATABASE',
          status: 'WARN',
          severity: 'MEDIUM',
          message: 'Unable to retrieve MySQL status',
          executionTime: Date.now() - startTime,
        };
      }
      
      const uptimeHours = Math.floor(uptime / 3600);
      const uptimeDays = Math.floor(uptimeHours / 24);
      
      // Check if uptime is very low (recently restarted)
      if (uptimeHours < 1) {
        return {
          checkName: 'mysql_status',
          category: 'DATABASE',
          status: 'WARN',
          severity: 'MEDIUM',
          message: `MySQL recently restarted (uptime: ${uptime} seconds)`,
          details: { uptime, uptimeHours, uptimeDays },
          suggestedFix: 'Investigate recent restart cause',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'mysql_status',
        category: 'DATABASE',
        status: 'PASS',
        severity: 'LOW',
        message: `MySQL running (uptime: ${uptimeDays} days, ${uptimeHours % 24} hours)`,
        details: { uptime, uptimeHours, uptimeDays },
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'mysql_status',
        category: 'DATABASE',
        status: 'ERROR',
        severity: 'MEDIUM',
        message: `Failed to check status: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkSlowQueries(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Check slow query log status and count
      const slowQueryStatus = await this.sshExecutor.executeCommand(
        server.id,
        `mysql -e "SHOW GLOBAL VARIABLES LIKE 'slow_query_log';" 2>/dev/null | grep -v Variable | awk '{print $2}'`,
      );
      
      const slowQueryEnabled = slowQueryStatus.trim() === 'ON';
      
      if (!slowQueryEnabled) {
        return {
          checkName: 'mysql_slow_queries',
          category: 'PERFORMANCE',
          status: 'WARN',
          severity: 'LOW',
          message: 'Slow query log is disabled',
          details: { enabled: false },
          suggestedFix: 'Enable slow query log for performance monitoring',
          executionTime: Date.now() - startTime,
        };
      }
      
      // Get slow query count
      const slowQueryCount = await this.sshExecutor.executeCommand(
        server.id,
        `mysql -e "SHOW GLOBAL STATUS LIKE 'Slow_queries';" 2>/dev/null | grep -v Variable | awk '{print $2}'`,
      );
      
      const count = parseInt(slowQueryCount.trim());
      
      if (isNaN(count)) {
        return {
          checkName: 'mysql_slow_queries',
          category: 'PERFORMANCE',
          status: 'WARN',
          severity: 'LOW',
          message: 'Unable to retrieve slow query count',
          executionTime: Date.now() - startTime,
        };
      }
      
      if (count > 1000) {
        return {
          checkName: 'mysql_slow_queries',
          category: 'PERFORMANCE',
          status: 'WARN',
          severity: 'MEDIUM',
          message: `High number of slow queries detected: ${count}`,
          details: { slowQueryCount: count, enabled: true },
          suggestedFix: 'Review slow query log and optimize queries',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'mysql_slow_queries',
        category: 'PERFORMANCE',
        status: 'PASS',
        severity: 'LOW',
        message: `Slow query count acceptable: ${count}`,
        details: { slowQueryCount: count, enabled: true },
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'mysql_slow_queries',
        category: 'PERFORMANCE',
        status: 'ERROR',
        severity: 'LOW',
        message: `Failed to check slow queries: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkTableIntegrity(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Get list of databases (excluding system databases)
      const databases = await this.sshExecutor.executeCommand(
        server.id,
        `mysql -e "SHOW DATABASES;" 2>/dev/null | grep -vE "^(Database|information_schema|performance_schema|mysql|sys)$"`,
      );
      
      const dbList = databases.trim().split('\n').filter(db => db);
      
      if (dbList.length === 0) {
        return {
          checkName: 'mysql_table_integrity',
          category: 'DATABASE',
          status: 'WARN',
          severity: 'LOW',
          message: 'No user databases found',
          executionTime: Date.now() - startTime,
        };
      }
      
      // Check first database for table issues (sample check)
      const firstDb = dbList[0];
      const checkResult = await this.sshExecutor.executeCommand(
        server.id,
        `mysql -e "USE ${firstDb}; CHECK TABLE $(mysql -e 'SHOW TABLES;' ${firstDb} 2>/dev/null | grep -v Tables | head -1) QUICK;" 2>/dev/null | grep -i error | wc -l`,
      );
      
      const errorCount = parseInt(checkResult.trim());
      
      if (errorCount > 0) {
        return {
          checkName: 'mysql_table_integrity',
          category: 'DATABASE',
          status: 'FAIL',
          severity: 'HIGH',
          message: `Table integrity issues detected in database: ${firstDb}`,
          details: { database: firstDb, errorCount },
          suggestedFix: 'Run REPAIR TABLE on affected tables',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'mysql_table_integrity',
        category: 'DATABASE',
        status: 'PASS',
        severity: 'LOW',
        message: `Table integrity check passed (sampled ${firstDb})`,
        details: { databaseCount: dbList.length, sampledDatabase: firstDb },
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'mysql_table_integrity',
        category: 'DATABASE',
        status: 'ERROR',
        severity: 'MEDIUM',
        message: `Failed to check table integrity: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkReplicationStatus(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Check if replication is configured
      const replicationStatus = await this.sshExecutor.executeCommand(
        server.id,
        `mysql -e "SHOW REPLICA STATUS\\G" 2>/dev/null | grep -E "Slave_IO_Running|Slave_SQL_Running" || echo "NOT_CONFIGURED"`,
      );
      
      if (replicationStatus.includes('NOT_CONFIGURED') || replicationStatus.trim() === '') {
        return {
          checkName: 'mysql_replication_status',
          category: 'DATABASE',
          status: 'PASS',
          severity: 'LOW',
          message: 'Replication not configured (standalone server)',
          details: { configured: false },
          executionTime: Date.now() - startTime,
        };
      }
      
      // Check if both IO and SQL threads are running
      const ioRunning = replicationStatus.includes('Slave_IO_Running: Yes');
      const sqlRunning = replicationStatus.includes('Slave_SQL_Running: Yes');
      
      if (!ioRunning || !sqlRunning) {
        return {
          checkName: 'mysql_replication_status',
          category: 'DATABASE',
          status: 'FAIL',
          severity: 'CRITICAL',
          message: 'Replication threads not running',
          details: { ioRunning, sqlRunning, configured: true },
          suggestedFix: 'Check replication configuration and restart replication',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'mysql_replication_status',
        category: 'DATABASE',
        status: 'PASS',
        severity: 'LOW',
        message: 'Replication running normally',
        details: { ioRunning, sqlRunning, configured: true },
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'mysql_replication_status',
        category: 'DATABASE',
        status: 'ERROR',
        severity: 'LOW',
        message: `Failed to check replication: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkBufferPool(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Get buffer pool size and usage
      const bufferPoolSize = await this.sshExecutor.executeCommand(
        server.id,
        `mysql -e "SHOW GLOBAL VARIABLES LIKE 'innodb_buffer_pool_size';" 2>/dev/null | grep -v Variable | awk '{print $2}'`,
      );
      
      const bufferPoolPages = await this.sshExecutor.executeCommand(
        server.id,
        `mysql -e "SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_pages_total';" 2>/dev/null | grep -v Variable | awk '{print $2}'`,
      );
      
      const size = parseInt(bufferPoolSize.trim());
      const pages = parseInt(bufferPoolPages.trim());
      
      if (isNaN(size) || isNaN(pages)) {
        return {
          checkName: 'mysql_buffer_pool',
          category: 'PERFORMANCE',
          status: 'WARN',
          severity: 'LOW',
          message: 'Unable to retrieve buffer pool information',
          executionTime: Date.now() - startTime,
        };
      }
      
      const sizeMB = Math.floor(size / 1024 / 1024);
      
      // Check if buffer pool is too small (less than 128MB)
      if (sizeMB < 128) {
        return {
          checkName: 'mysql_buffer_pool',
          category: 'PERFORMANCE',
          status: 'WARN',
          severity: 'MEDIUM',
          message: `InnoDB buffer pool size is small: ${sizeMB}MB`,
          details: { sizeBytes: size, sizeMB, pages },
          suggestedFix: 'Consider increasing innodb_buffer_pool_size',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'mysql_buffer_pool',
        category: 'PERFORMANCE',
        status: 'PASS',
        severity: 'LOW',
        message: `InnoDB buffer pool configured: ${sizeMB}MB`,
        details: { sizeBytes: size, sizeMB, pages },
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'mysql_buffer_pool',
        category: 'PERFORMANCE',
        status: 'ERROR',
        severity: 'LOW',
        message: `Failed to check buffer pool: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkDiskUsage(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Get MySQL data directory
      const dataDir = await this.sshExecutor.executeCommand(
        server.id,
        `mysql -e "SHOW VARIABLES LIKE 'datadir';" 2>/dev/null | grep -v Variable | awk '{print $2}'`,
      );
      
      const dataDirPath = dataDir.trim();
      
      if (!dataDirPath) {
        return {
          checkName: 'mysql_disk_usage',
          category: 'SYSTEM',
          status: 'WARN',
          severity: 'LOW',
          message: 'Unable to determine MySQL data directory',
          executionTime: Date.now() - startTime,
        };
      }
      
      // Get disk usage of data directory
      const diskUsage = await this.sshExecutor.executeCommand(
        server.id,
        `du -sh ${dataDirPath} 2>/dev/null | awk '{print $1}'`,
      );
      
      const usage = diskUsage.trim();
      
      // Get available disk space
      const diskSpace = await this.sshExecutor.executeCommand(
        server.id,
        `df -h ${dataDirPath} 2>/dev/null | tail -1 | awk '{print $4}'`,
      );
      
      const available = diskSpace.trim();
      
      return {
        checkName: 'mysql_disk_usage',
        category: 'SYSTEM',
        status: 'PASS',
        severity: 'LOW',
        message: `MySQL data directory: ${usage} used, ${available} available`,
        details: { dataDir: dataDirPath, usage, available },
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'mysql_disk_usage',
        category: 'SYSTEM',
        status: 'ERROR',
        severity: 'LOW',
        message: `Failed to check disk usage: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async checkThreadCount(
    application: any,
    server: Server,
    startTime: number,
  ): Promise<DiagnosticCheckResult> {
    try {
      // Get current thread count
      const threadsConnected = await this.sshExecutor.executeCommand(
        server.id,
        `mysql -e "SHOW GLOBAL STATUS LIKE 'Threads_connected';" 2>/dev/null | grep -v Variable | awk '{print $2}'`,
      );
      
      const maxConnections = await this.sshExecutor.executeCommand(
        server.id,
        `mysql -e "SHOW GLOBAL VARIABLES LIKE 'max_connections';" 2>/dev/null | grep -v Variable | awk '{print $2}'`,
      );
      
      const connected = parseInt(threadsConnected.trim());
      const max = parseInt(maxConnections.trim());
      
      if (isNaN(connected) || isNaN(max)) {
        return {
          checkName: 'mysql_thread_count',
          category: 'SYSTEM',
          status: 'WARN',
          severity: 'LOW',
          message: 'Unable to retrieve thread count',
          executionTime: Date.now() - startTime,
        };
      }
      
      const usagePercent = Math.floor((connected / max) * 100);
      
      if (usagePercent > 80) {
        return {
          checkName: 'mysql_thread_count',
          category: 'SYSTEM',
          status: 'WARN',
          severity: 'HIGH',
          message: `High connection usage: ${connected}/${max} (${usagePercent}%)`,
          details: { connected, max, usagePercent },
          suggestedFix: 'Consider increasing max_connections or investigating connection leaks',
          executionTime: Date.now() - startTime,
        };
      }
      
      if (usagePercent > 60) {
        return {
          checkName: 'mysql_thread_count',
          category: 'SYSTEM',
          status: 'WARN',
          severity: 'MEDIUM',
          message: `Moderate connection usage: ${connected}/${max} (${usagePercent}%)`,
          details: { connected, max, usagePercent },
          suggestedFix: 'Monitor connection usage trends',
          executionTime: Date.now() - startTime,
        };
      }
      
      return {
        checkName: 'mysql_thread_count',
        category: 'SYSTEM',
        status: 'PASS',
        severity: 'LOW',
        message: `Connection usage normal: ${connected}/${max} (${usagePercent}%)`,
        details: { connected, max, usagePercent },
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        checkName: 'mysql_thread_count',
        category: 'SYSTEM',
        status: 'ERROR',
        severity: 'MEDIUM',
        message: `Failed to check thread count: ${error?.message || 'Unknown error'}`,
        executionTime: Date.now() - startTime,
      };
    }
  }

  getHealingActions(): HealingAction[] {
    return [
      {
        name: 'optimize_tables',
        description: 'Optimize all tables in user databases',
        commands: [
          'for db in $(mysql -e "SHOW DATABASES;" | grep -vE "^(Database|information_schema|performance_schema|mysql|sys)$"); do mysql -e "USE $db; OPTIMIZE TABLE $(mysql -e \'SHOW TABLES;\' $db | grep -v Tables | tr \'\\n\' \',\' | sed \'s/,$//\');"; done',
        ],
        requiresBackup: true,
        estimatedDuration: 300,
        riskLevel: 'MEDIUM',
      },
      {
        name: 'repair_tables',
        description: 'Repair corrupted tables',
        commands: [
          'for db in $(mysql -e "SHOW DATABASES;" | grep -vE "^(Database|information_schema|performance_schema|mysql|sys)$"); do mysql -e "USE $db; REPAIR TABLE $(mysql -e \'SHOW TABLES;\' $db | grep -v Tables | tr \'\\n\' \',\' | sed \'s/,$//\');"; done',
        ],
        requiresBackup: true,
        estimatedDuration: 600,
        riskLevel: 'HIGH',
      },
      {
        name: 'restart_mysql',
        description: 'Restart MySQL service',
        commands: [
          'systemctl restart mysql || systemctl restart mysqld || service mysql restart',
        ],
        requiresBackup: false,
        estimatedDuration: 30,
        riskLevel: 'HIGH',
      },
      {
        name: 'flush_privileges',
        description: 'Flush MySQL privileges',
        commands: [
          'mysql -e "FLUSH PRIVILEGES;"',
        ],
        requiresBackup: false,
        estimatedDuration: 5,
        riskLevel: 'LOW',
      },
      {
        name: 'enable_slow_query_log',
        description: 'Enable slow query logging',
        commands: [
          'mysql -e "SET GLOBAL slow_query_log = \'ON\';"',
          'mysql -e "SET GLOBAL long_query_time = 2;"',
        ],
        requiresBackup: false,
        estimatedDuration: 5,
        riskLevel: 'LOW',
      },
      {
        name: 'analyze_tables',
        description: 'Analyze tables for query optimization',
        commands: [
          'for db in $(mysql -e "SHOW DATABASES;" | grep -vE "^(Database|information_schema|performance_schema|mysql|sys)$"); do mysql -e "USE $db; ANALYZE TABLE $(mysql -e \'SHOW TABLES;\' $db | grep -v Tables | tr \'\\n\' \',\' | sed \'s/,$//\');"; done',
        ],
        requiresBackup: false,
        estimatedDuration: 180,
        riskLevel: 'LOW',
      },
      {
        name: 'kill_long_running_queries',
        description: 'Kill queries running longer than 5 minutes',
        commands: [
          'mysql -e "SELECT CONCAT(\'KILL \',id,\';\') FROM information_schema.processlist WHERE command != \'Sleep\' AND time > 300;" | grep KILL | mysql',
        ],
        requiresBackup: false,
        estimatedDuration: 10,
        riskLevel: 'MEDIUM',
      },
    ];
  }

  async executeHealingAction(
    actionName: string,
    application: any,
    server: Server,
  ): Promise<{ success: boolean; message: string; details?: any }> {
    const action = this.getHealingActions().find(a => a.name === actionName);
    if (!action) {
      throw new Error(`Unknown healing action: ${actionName}`);
    }

    try {
      const results: string[] = [];
      
      for (const command of action.commands) {
        const output = await this.sshExecutor.executeCommand(server.id, command);
        results.push(output);
      }
      
      return {
        success: true,
        message: `Successfully executed ${action.description}`,
        details: { results },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to execute ${action.description}: ${error?.message || 'Unknown error'}`,
        details: { error: error?.message || 'Unknown error' },
      };
    }
  }
}
