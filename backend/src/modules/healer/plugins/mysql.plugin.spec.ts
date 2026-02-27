import { Test, TestingModule } from '@nestjs/testing';
import { MySQLPlugin } from './mysql.plugin';
import { SSHExecutorService } from '../services/ssh-executor.service';

describe('MySQLPlugin', () => {
  let plugin: MySQLPlugin;
  let sshExecutor: any;

  const mockServer = {
    id: 'server-123',
    name: 'Test Server',
    host: '192.168.1.1',
  } as any;

  const mockApplication = {
    id: 'app-123',
    name: 'MySQL Database',
    path: '/var/lib/mysql',
    techStack: 'MYSQL',
  };

  beforeEach(async () => {
    const mockSSHExecutor = {
      executeCommand: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MySQLPlugin,
        {
          provide: SSHExecutorService,
          useValue: mockSSHExecutor,
        },
      ],
    }).compile();

    plugin = module.get<MySQLPlugin>(MySQLPlugin);
    sshExecutor = module.get(SSHExecutorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('detect', () => {
    it('should detect MySQL successfully', async () => {
      sshExecutor.executeCommand
        .mockResolvedValueOnce('1') // process check
        .mockResolvedValueOnce('mysql  Ver 8.0.32 for Linux') // version
        .mockResolvedValueOnce('1'); // port check

      const result = await plugin.detect(mockServer, '/var/lib/mysql');

      expect(result.detected).toBe(true);
      expect(result.techStack).toBe('MYSQL');
      expect(result.version).toBe('8.0.32');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.metadata?.portListening).toBe(true);
    });

    it('should detect MariaDB successfully', async () => {
      sshExecutor.executeCommand
        .mockResolvedValueOnce('1') // process check
        .mockResolvedValueOnce('mysql  Ver 10.6.12-MariaDB for Linux') // version
        .mockResolvedValueOnce('1'); // port check

      const result = await plugin.detect(mockServer, '/var/lib/mysql');

      expect(result.detected).toBe(true);
      expect(result.version).toBe('10.6.12');
      expect(result.metadata?.isMariaDB).toBe(true);
    });

    it('should not detect when MySQL process not running', async () => {
      sshExecutor.executeCommand.mockResolvedValueOnce('0'); // no process

      const result = await plugin.detect(mockServer, '/var/lib/mysql');

      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should detect with lower confidence when port not listening', async () => {
      sshExecutor.executeCommand
        .mockResolvedValueOnce('1') // process running
        .mockResolvedValueOnce('mysql  Ver 8.0.32 for Linux') // version
        .mockResolvedValueOnce('0'); // port not listening

      const result = await plugin.detect(mockServer, '/var/lib/mysql');

      expect(result.detected).toBe(true);
      expect(result.confidence).toBe(0.75);
      expect(result.metadata?.portListening).toBe(false);
    });
  });

  describe('getDiagnosticChecks', () => {
    it('should return list of diagnostic checks', () => {
      const checks = plugin.getDiagnosticChecks();

      expect(checks).toContain('mysql_connection');
      expect(checks).toContain('mysql_status');
      expect(checks).toContain('mysql_slow_queries');
      expect(checks).toContain('mysql_table_integrity');
      expect(checks).toContain('mysql_replication_status');
      expect(checks).toContain('mysql_buffer_pool');
      expect(checks).toContain('mysql_disk_usage');
      expect(checks).toContain('mysql_thread_count');
      expect(checks.length).toBe(8);
    });
  });

  describe('executeDiagnosticCheck - mysql_connection', () => {
    it('should pass when connection successful', async () => {
      sshExecutor.executeCommand.mockResolvedValueOnce('1');

      const result = await plugin.executeDiagnosticCheck(
        'mysql_connection',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('PASS');
      expect(result.message).toContain('successful');
    });

    it('should fail when connection denied', async () => {
      sshExecutor.executeCommand.mockResolvedValueOnce('ERROR 1045: Access denied');

      const result = await plugin.executeDiagnosticCheck(
        'mysql_connection',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('FAIL');
      expect(result.severity).toBe('CRITICAL');
      expect(result.message).toContain('Cannot connect');
    });
  });

  describe('executeDiagnosticCheck - mysql_status', () => {
    it('should pass when MySQL has good uptime', async () => {
      sshExecutor.executeCommand.mockResolvedValueOnce('86400'); // 1 day

      const result = await plugin.executeDiagnosticCheck(
        'mysql_status',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('PASS');
      expect(result.message).toContain('running');
      expect(result.details?.uptimeDays).toBe(1);
    });

    it('should warn when MySQL recently restarted', async () => {
      sshExecutor.executeCommand.mockResolvedValueOnce('1800'); // 30 minutes

      const result = await plugin.executeDiagnosticCheck(
        'mysql_status',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('WARN');
      expect(result.severity).toBe('MEDIUM');
      expect(result.message).toContain('recently restarted');
    });
  });

  describe('executeDiagnosticCheck - mysql_slow_queries', () => {
    it('should pass when slow query count is acceptable', async () => {
      sshExecutor.executeCommand
        .mockResolvedValueOnce('ON') // slow query log enabled
        .mockResolvedValueOnce('150'); // slow query count

      const result = await plugin.executeDiagnosticCheck(
        'mysql_slow_queries',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('PASS');
      expect(result.message).toContain('acceptable');
      expect(result.details?.slowQueryCount).toBe(150);
    });

    it('should warn when slow query log is disabled', async () => {
      sshExecutor.executeCommand.mockResolvedValueOnce('OFF');

      const result = await plugin.executeDiagnosticCheck(
        'mysql_slow_queries',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('WARN');
      expect(result.severity).toBe('LOW');
      expect(result.message).toContain('disabled');
    });

    it('should warn when high number of slow queries', async () => {
      sshExecutor.executeCommand
        .mockResolvedValueOnce('ON')
        .mockResolvedValueOnce('5000'); // high count

      const result = await plugin.executeDiagnosticCheck(
        'mysql_slow_queries',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('WARN');
      expect(result.severity).toBe('MEDIUM');
      expect(result.message).toContain('High number');
    });
  });

  describe('executeDiagnosticCheck - mysql_table_integrity', () => {
    it('should pass when tables are healthy', async () => {
      sshExecutor.executeCommand
        .mockResolvedValueOnce('testdb\nappdb') // databases
        .mockResolvedValueOnce('0'); // no errors

      const result = await plugin.executeDiagnosticCheck(
        'mysql_table_integrity',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('PASS');
      expect(result.message).toContain('passed');
    });

    it('should fail when table errors detected', async () => {
      sshExecutor.executeCommand
        .mockResolvedValueOnce('testdb')
        .mockResolvedValueOnce('3'); // errors found

      const result = await plugin.executeDiagnosticCheck(
        'mysql_table_integrity',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('FAIL');
      expect(result.severity).toBe('HIGH');
      expect(result.message).toContain('integrity issues');
    });

    it('should warn when no user databases found', async () => {
      sshExecutor.executeCommand.mockResolvedValueOnce(''); // no databases

      const result = await plugin.executeDiagnosticCheck(
        'mysql_table_integrity',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('WARN');
      expect(result.message).toContain('No user databases');
    });
  });

  describe('executeDiagnosticCheck - mysql_replication_status', () => {
    it('should pass when replication not configured', async () => {
      sshExecutor.executeCommand.mockResolvedValueOnce('NOT_CONFIGURED');

      const result = await plugin.executeDiagnosticCheck(
        'mysql_replication_status',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('PASS');
      expect(result.message).toContain('not configured');
      expect(result.details?.configured).toBe(false);
    });

    it('should pass when replication running normally', async () => {
      sshExecutor.executeCommand.mockResolvedValueOnce(
        'Slave_IO_Running: Yes\nSlave_SQL_Running: Yes',
      );

      const result = await plugin.executeDiagnosticCheck(
        'mysql_replication_status',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('PASS');
      expect(result.message).toContain('running normally');
      expect(result.details?.ioRunning).toBe(true);
      expect(result.details?.sqlRunning).toBe(true);
    });

    it('should fail when replication threads not running', async () => {
      sshExecutor.executeCommand.mockResolvedValueOnce(
        'Slave_IO_Running: No\nSlave_SQL_Running: Yes',
      );

      const result = await plugin.executeDiagnosticCheck(
        'mysql_replication_status',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('FAIL');
      expect(result.severity).toBe('CRITICAL');
      expect(result.message).toContain('not running');
    });
  });

  describe('executeDiagnosticCheck - mysql_buffer_pool', () => {
    it('should pass when buffer pool properly configured', async () => {
      sshExecutor.executeCommand
        .mockResolvedValueOnce('268435456') // 256MB
        .mockResolvedValueOnce('16384'); // pages

      const result = await plugin.executeDiagnosticCheck(
        'mysql_buffer_pool',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('PASS');
      expect(result.message).toContain('configured');
      expect(result.details?.sizeMB).toBe(256);
    });

    it('should warn when buffer pool is too small', async () => {
      sshExecutor.executeCommand
        .mockResolvedValueOnce('67108864') // 64MB
        .mockResolvedValueOnce('4096');

      const result = await plugin.executeDiagnosticCheck(
        'mysql_buffer_pool',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('WARN');
      expect(result.severity).toBe('MEDIUM');
      expect(result.message).toContain('small');
    });
  });

  describe('executeDiagnosticCheck - mysql_thread_count', () => {
    it('should pass when connection usage is normal', async () => {
      sshExecutor.executeCommand
        .mockResolvedValueOnce('50') // connected
        .mockResolvedValueOnce('150'); // max

      const result = await plugin.executeDiagnosticCheck(
        'mysql_thread_count',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('PASS');
      expect(result.message).toContain('normal');
      expect(result.details?.usagePercent).toBe(33);
    });

    it('should warn when connection usage is high', async () => {
      sshExecutor.executeCommand
        .mockResolvedValueOnce('130') // connected
        .mockResolvedValueOnce('150'); // max

      const result = await plugin.executeDiagnosticCheck(
        'mysql_thread_count',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('WARN');
      expect(result.severity).toBe('HIGH');
      expect(result.message).toContain('High connection usage');
      expect(result.details?.usagePercent).toBe(86);
    });

    it('should warn when connection usage is moderate', async () => {
      sshExecutor.executeCommand
        .mockResolvedValueOnce('100') // connected
        .mockResolvedValueOnce('150'); // max

      const result = await plugin.executeDiagnosticCheck(
        'mysql_thread_count',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('WARN');
      expect(result.severity).toBe('MEDIUM');
      expect(result.message).toContain('Moderate connection usage');
    });
  });

  describe('getHealingActions', () => {
    it('should return list of healing actions', () => {
      const actions = plugin.getHealingActions();

      expect(actions.length).toBeGreaterThan(0);
      expect(actions.find(a => a.name === 'optimize_tables')).toBeDefined();
      expect(actions.find(a => a.name === 'repair_tables')).toBeDefined();
      expect(actions.find(a => a.name === 'restart_mysql')).toBeDefined();
      expect(actions.find(a => a.name === 'flush_privileges')).toBeDefined();
      expect(actions.find(a => a.name === 'enable_slow_query_log')).toBeDefined();
      expect(actions.find(a => a.name === 'analyze_tables')).toBeDefined();
      expect(actions.find(a => a.name === 'kill_long_running_queries')).toBeDefined();
    });

    it('should have correct risk levels', () => {
      const actions = plugin.getHealingActions();

      const flushPrivileges = actions.find(a => a.name === 'flush_privileges');
      expect(flushPrivileges?.riskLevel).toBe('LOW');

      const repairTables = actions.find(a => a.name === 'repair_tables');
      expect(repairTables?.riskLevel).toBe('HIGH');
      expect(repairTables?.requiresBackup).toBe(true);

      const restartMySQL = actions.find(a => a.name === 'restart_mysql');
      expect(restartMySQL?.riskLevel).toBe('HIGH');
    });
  });

  describe('executeHealingAction', () => {
    it('should execute flush_privileges action successfully', async () => {
      sshExecutor.executeCommand.mockResolvedValue('Privileges flushed');

      const result = await plugin.executeHealingAction(
        'flush_privileges',
        mockApplication,
        mockServer,
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully executed');
      expect(sshExecutor.executeCommand).toHaveBeenCalledWith(
        mockServer.id,
        expect.stringContaining('FLUSH PRIVILEGES'),
      );
    });

    it('should execute enable_slow_query_log action successfully', async () => {
      sshExecutor.executeCommand.mockResolvedValue('Query OK');

      const result = await plugin.executeHealingAction(
        'enable_slow_query_log',
        mockApplication,
        mockServer,
      );

      expect(result.success).toBe(true);
      expect(sshExecutor.executeCommand).toHaveBeenCalledTimes(2); // Two commands
    });

    it('should handle action execution failure', async () => {
      sshExecutor.executeCommand.mockRejectedValue(new Error('Command failed'));

      const result = await plugin.executeHealingAction(
        'flush_privileges',
        mockApplication,
        mockServer,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to execute');
    });

    it('should throw error for unknown action', async () => {
      await expect(
        plugin.executeHealingAction('unknown_action', mockApplication, mockServer),
      ).rejects.toThrow('Unknown healing action');
    });
  });
});
