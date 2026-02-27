import { Test, TestingModule } from '@nestjs/testing';
import { LaravelPlugin } from './laravel.plugin';
import { SSHExecutorService } from '../services/ssh-executor.service';

describe('LaravelPlugin', () => {
  let plugin: LaravelPlugin;
  let sshExecutor: any;

  const mockServer = {
    id: 'server-123',
    name: 'Test Server',
    host: '192.168.1.1',
  } as any;

  const mockApplication = {
    id: 'app-123',
    name: 'Laravel App',
    path: '/var/www/laravel',
    techStack: 'LARAVEL',
  };

  beforeEach(async () => {
    const mockSSHExecutor = {
      executeCommand: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LaravelPlugin,
        {
          provide: SSHExecutorService,
          useValue: mockSSHExecutor,
        },
      ],
    }).compile();

    plugin = module.get<LaravelPlugin>(LaravelPlugin);
    sshExecutor = module.get(SSHExecutorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('detect', () => {
    it('should detect Laravel application successfully', async () => {
      const composerJson = {
        require: {
          'laravel/framework': '^10.0',
          php: '^8.1',
        },
      };

      sshExecutor.executeCommand
        .mockResolvedValueOnce('') // artisan file exists
        .mockResolvedValueOnce(JSON.stringify(composerJson)) // composer.json
        .mockResolvedValueOnce('10.48.4'); // Laravel version

      const result = await plugin.detect(mockServer, '/var/www/laravel');

      expect(result.detected).toBe(true);
      expect(result.techStack).toBe('LARAVEL');
      expect(result.version).toBe('10.48.4');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.metadata?.hasArtisan).toBe(true);
    });

    it('should not detect when artisan file missing', async () => {
      sshExecutor.executeCommand.mockRejectedValue(new Error('File not found'));

      const result = await plugin.detect(mockServer, '/var/www/test');

      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should not detect when laravel/framework not in composer.json', async () => {
      const composerJson = {
        require: {
          'symfony/console': '^6.0',
        },
      };

      sshExecutor.executeCommand
        .mockResolvedValueOnce('') // artisan exists
        .mockResolvedValueOnce(JSON.stringify(composerJson)); // composer.json

      const result = await plugin.detect(mockServer, '/var/www/test');

      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should fallback to composer.json version when artisan fails', async () => {
      const composerJson = {
        require: {
          'laravel/framework': '^10.0',
        },
      };

      sshExecutor.executeCommand
        .mockResolvedValueOnce('') // artisan exists
        .mockResolvedValueOnce(JSON.stringify(composerJson)) // composer.json
        .mockRejectedValueOnce(new Error('artisan failed')); // version command fails

      const result = await plugin.detect(mockServer, '/var/www/laravel');

      expect(result.detected).toBe(true);
      expect(result.version).toBe('10.x');
    });
  });

  describe('getDiagnosticChecks', () => {
    it('should return list of diagnostic checks', () => {
      const checks = plugin.getDiagnosticChecks();

      expect(checks).toContain('laravel_config_cache');
      expect(checks).toContain('laravel_route_cache');
      expect(checks).toContain('laravel_storage_permissions');
      expect(checks).toContain('laravel_database_connection');
      expect(checks).toContain('laravel_queue_worker');
      expect(checks).toContain('composer_dependencies');
      expect(checks).toContain('laravel_env_file');
      expect(checks).toContain('laravel_app_key');
    });
  });

  describe('executeDiagnosticCheck - laravel_config_cache', () => {
    it('should pass when config is cached and up to date', async () => {
      sshExecutor.executeCommand
        .mockResolvedValueOnce('') // cache file exists
        .mockResolvedValueOnce('1704067200') // cache timestamp
        .mockResolvedValueOnce('1704060000'); // config timestamp (older)

      const result = await plugin.executeDiagnosticCheck(
        'laravel_config_cache',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('PASS');
      expect(result.message).toContain('cached and up to date');
    });

    it('should warn when config cache is stale', async () => {
      sshExecutor.executeCommand
        .mockResolvedValueOnce('') // cache file exists
        .mockResolvedValueOnce('1704060000') // cache timestamp (older)
        .mockResolvedValueOnce('1704067200'); // config timestamp (newer)

      const result = await plugin.executeDiagnosticCheck(
        'laravel_config_cache',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('WARN');
      expect(result.message).toContain('stale');
      expect(result.suggestedFix).toContain('config:cache');
    });

    it('should warn when config not cached', async () => {
      sshExecutor.executeCommand.mockRejectedValueOnce(new Error('File not found'));

      const result = await plugin.executeDiagnosticCheck(
        'laravel_config_cache',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('WARN');
      expect(result.message).toContain('not cached');
    });
  });

  describe('executeDiagnosticCheck - laravel_storage_permissions', () => {
    it('should pass when permissions are correct', async () => {
      sshExecutor.executeCommand
        .mockResolvedValueOnce('775') // storage permissions
        .mockResolvedValueOnce('writable') // writable check
        .mockResolvedValueOnce('775'); // bootstrap/cache permissions

      const result = await plugin.executeDiagnosticCheck(
        'laravel_storage_permissions',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('PASS');
      expect(result.message).toContain('correct permissions');
    });

    it('should fail when storage not writable', async () => {
      sshExecutor.executeCommand
        .mockResolvedValueOnce('755') // storage permissions
        .mockResolvedValueOnce('not-writable'); // writable check

      const result = await plugin.executeDiagnosticCheck(
        'laravel_storage_permissions',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('FAIL');
      expect(result.severity).toBe('HIGH');
      expect(result.message).toContain('not writable');
    });

    it('should fail when storage directory not found', async () => {
      sshExecutor.executeCommand.mockResolvedValueOnce('0'); // permissions = 0

      const result = await plugin.executeDiagnosticCheck(
        'laravel_storage_permissions',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('FAIL');
      expect(result.severity).toBe('CRITICAL');
      expect(result.message).toContain('not found');
    });
  });

  describe('executeDiagnosticCheck - laravel_database_connection', () => {
    it('should pass when database connection successful', async () => {
      sshExecutor.executeCommand.mockResolvedValueOnce('MySQL 8.0.32');

      const result = await plugin.executeDiagnosticCheck(
        'laravel_database_connection',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('PASS');
      expect(result.message).toContain('successful');
    });

    it('should fail when database connection fails', async () => {
      sshExecutor.executeCommand.mockResolvedValueOnce('SQLSTATE[HY000] [2002] Connection refused');

      const result = await plugin.executeDiagnosticCheck(
        'laravel_database_connection',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('FAIL');
      expect(result.severity).toBe('CRITICAL');
      expect(result.message).toContain('Cannot connect');
    });
  });

  describe('executeDiagnosticCheck - laravel_app_key', () => {
    it('should pass when APP_KEY is properly set', async () => {
      sshExecutor.executeCommand.mockResolvedValueOnce(
        'APP_KEY=base64:abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGH==',
      );

      const result = await plugin.executeDiagnosticCheck(
        'laravel_app_key',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('PASS');
      expect(result.message).toContain('properly configured');
    });

    it('should fail when APP_KEY is not set', async () => {
      sshExecutor.executeCommand.mockResolvedValueOnce('APP_KEY=');

      const result = await plugin.executeDiagnosticCheck(
        'laravel_app_key',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('FAIL');
      expect(result.severity).toBe('CRITICAL');
      expect(result.message).toContain('not set');
      expect(result.suggestedFix).toContain('key:generate');
    });

    it('should fail when APP_KEY is default value', async () => {
      sshExecutor.executeCommand.mockResolvedValueOnce('APP_KEY=SomeRandomString');

      const result = await plugin.executeDiagnosticCheck(
        'laravel_app_key',
        mockApplication,
        mockServer,
      );

      expect(result.status).toBe('FAIL');
      expect(result.severity).toBe('CRITICAL');
      expect(result.message).toContain('default or invalid');
    });
  });

  describe('getHealingActions', () => {
    it('should return list of healing actions', () => {
      const actions = plugin.getHealingActions();

      expect(actions.length).toBeGreaterThan(0);
      expect(actions.find(a => a.name === 'cache_clear')).toBeDefined();
      expect(actions.find(a => a.name === 'optimize')).toBeDefined();
      expect(actions.find(a => a.name === 'migrate')).toBeDefined();
      expect(actions.find(a => a.name === 'fix_storage_permissions')).toBeDefined();
    });

    it('should have correct risk levels', () => {
      const actions = plugin.getHealingActions();

      const cacheClear = actions.find(a => a.name === 'cache_clear');
      expect(cacheClear?.riskLevel).toBe('LOW');

      const migrate = actions.find(a => a.name === 'migrate');
      expect(migrate?.riskLevel).toBe('HIGH');
      expect(migrate?.requiresBackup).toBe(true);
    });
  });

  describe('executeHealingAction', () => {
    it('should execute cache_clear action successfully', async () => {
      sshExecutor.executeCommand.mockResolvedValue('Cache cleared successfully');

      const result = await plugin.executeHealingAction(
        'cache_clear',
        mockApplication,
        mockServer,
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully executed');
      expect(sshExecutor.executeCommand).toHaveBeenCalledWith(
        mockServer.id,
        expect.stringContaining('cache:clear'),
      );
    });

    it('should execute optimize action successfully', async () => {
      sshExecutor.executeCommand.mockResolvedValue('Optimized successfully');

      const result = await plugin.executeHealingAction(
        'optimize',
        mockApplication,
        mockServer,
      );

      expect(result.success).toBe(true);
      expect(sshExecutor.executeCommand).toHaveBeenCalledWith(
        mockServer.id,
        expect.stringContaining('config:cache'),
      );
    });

    it('should handle action execution failure', async () => {
      sshExecutor.executeCommand.mockRejectedValue(new Error('Command failed'));

      const result = await plugin.executeHealingAction(
        'cache_clear',
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

    it('should replace path placeholder in commands', async () => {
      sshExecutor.executeCommand.mockResolvedValue('Success');

      await plugin.executeHealingAction('cache_clear', mockApplication, mockServer);

      expect(sshExecutor.executeCommand).toHaveBeenCalledWith(
        mockServer.id,
        expect.stringContaining(mockApplication.path),
      );
    });
  });
});
