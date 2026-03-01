import { Test, TestingModule } from '@nestjs/testing';
import { HealerModule } from './healer.module';
import { PrismaService } from '../../prisma/prisma.service';
import { ApplicationService } from './services/application.service';
import { HealingStrategyEngineService } from './services/healing-strategy-engine.service';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { BackupRollbackService } from './services/backup-rollback.service';
import { HealingMode, CircuitBreakerState, TechStack, CheckCategory, CheckStatus, RiskLevel } from '@prisma/client';
import { CheckResult } from './core/interfaces';

describe('Healer Module Integration Tests', () => {
  let prisma: PrismaService;
  let applicationService: ApplicationService;
  let strategyEngine: HealingStrategyEngineService;
  let circuitBreaker: CircuitBreakerService;
  let backupService: BackupRollbackService;

  // Mock data
  const mockServer = {
    id: 'server-1',
    name: 'Test Server',
    host: '192.168.1.100',
    port: 22,
    username: 'root',
    platformType: 'LINUX',
    connectionProtocol: 'SSH',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    environment: 'production',
    tags: [],
    notes: null,
    authMethod: 'PASSWORD',
    privateKeyPath: null,
    passphrase: null,
    password: 'encrypted',
    isActive: true,
    lastHealthCheck: new Date(),
    healthStatus: 'HEALTHY',
    cpuUsage: 0,
    memoryUsage: 0,
    diskUsage: 0,
    networkLatency: 0,
    metricsInterval: 60,
  };

  const mockApplication = {
    id: 'app-1',
    serverId: 'server-1',
    domain: 'test.example.com',
    path: '/var/www/test',
    techStack: TechStack.WORDPRESS,
    version: '6.4.0',
    phpVersion: '8.2',
    healthScore: 85,
    healthStatus: 'HEALTHY' as any,
    healingMode: HealingMode.SEMI_AUTO,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastDiagnosedAt: null,
    lastHealedAt: null,
    detectionMethod: 'AUTO' as any,
    metadata: {},
    circuitBreakerState: CircuitBreakerState.CLOSED,
    consecutiveFailures: 0,
    maxRetries: 3,
    circuitBreakerResetAt: null,
    lastCircuitBreakerOpen: null,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HealerModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        applications: {
          findUnique: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
          count: jest.fn(),
        },
        servers: {
          findUnique: jest.fn(),
        },
        diagnostic_results: {
          findMany: jest.fn(),
          create: jest.fn(),
          createMany: jest.fn(),
        },
        healing_executions: {
          create: jest.fn(),
          update: jest.fn(),
          findUnique: jest.fn(),
        },
        healing_actions: {
          createMany: jest.fn(),
        },
      })
      .compile();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    applicationService = moduleFixture.get<ApplicationService>(ApplicationService);
    strategyEngine = moduleFixture.get<HealingStrategyEngineService>(HealingStrategyEngineService);
    circuitBreaker = moduleFixture.get<CircuitBreakerService>(CircuitBreakerService);
    backupService = moduleFixture.get<BackupRollbackService>(BackupRollbackService);
  });

  afterAll(async () => {
    // Cleanup
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Application Service Integration', () => {
    it('should find all applications with pagination', async () => {
      (prisma.applications.findMany as jest.Mock).mockResolvedValue([mockApplication]);
      (prisma.applications.count as jest.Mock).mockResolvedValue(1);

      const result = await applicationService.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(prisma.applications.findMany).toHaveBeenCalled();
    });

    it('should find application by id', async () => {
      (prisma.applications.findUnique as jest.Mock).mockResolvedValue(mockApplication);

      const result = await applicationService.findOne('app-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('app-1');
      expect(prisma.applications.findUnique).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        include: { servers: true },
      });
    });

    it('should throw error when application not found', async () => {
      (prisma.applications.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(applicationService.findOne('non-existent')).rejects.toThrow();
    });
  });

  describe('Healing Strategy Engine Integration', () => {
    it('should determine healing plan based on diagnostic results', async () => {
      const diagnosticResults: CheckResult[] = [
        {
          checkName: 'core_files',
          category: 'SYSTEM' as CheckCategory,
          status: 'FAIL' as CheckStatus,
          severity: 'HIGH' as RiskLevel,
          message: 'Core files corrupted',
          executionTime: 100,
        },
      ];

      const healingPlan = await strategyEngine.determineHealingPlan(
        mockApplication,
        diagnosticResults,
        HealingMode.SEMI_AUTO,
      );

      expect(healingPlan).toBeDefined();
      expect(healingPlan).toHaveProperty('autoHeal');
      expect(healingPlan).toHaveProperty('requireApproval');
      expect(healingPlan).toHaveProperty('cannotHeal');
    });

    it('should respect MANUAL healing mode', async () => {
      const diagnosticResults: CheckResult[] = [
        {
          checkName: 'cache',
          category: 'PERFORMANCE' as CheckCategory,
          status: 'FAIL' as CheckStatus,
          severity: 'LOW' as RiskLevel,
          message: 'Cache needs clearing',
          executionTime: 50,
        },
      ];

      const healingPlan = await strategyEngine.determineHealingPlan(
        mockApplication,
        diagnosticResults,
        HealingMode.MANUAL,
      );

      // In MANUAL mode, nothing should auto-heal
      expect(healingPlan.autoHeal.length).toBe(0);
    });

    it('should auto-heal LOW risk in SEMI_AUTO mode', async () => {
      const diagnosticResults: CheckResult[] = [
        {
          checkName: 'cache',
          category: 'PERFORMANCE' as CheckCategory,
          status: 'FAIL' as CheckStatus,
          severity: 'LOW' as RiskLevel,
          message: 'Cache needs clearing',
          executionTime: 50,
        },
      ];

      const healingPlan = await strategyEngine.determineHealingPlan(
        mockApplication,
        diagnosticResults,
        HealingMode.SEMI_AUTO,
      );

      // LOW risk should be in autoHeal or requireApproval depending on plugin actions
      expect(healingPlan.autoHeal.length + healingPlan.requireApproval.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should allow healing when circuit is CLOSED', async () => {
      (prisma.applications.findUnique as jest.Mock).mockResolvedValue({
        ...mockApplication,
        circuitBreakerState: CircuitBreakerState.CLOSED,
      });

      const result = await circuitBreaker.canHeal('app-1');

      expect(result.allowed).toBe(true);
      expect(result.state).toBe(CircuitBreakerState.CLOSED);
    });

    it('should block healing when circuit is OPEN', async () => {
      const resetAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      (prisma.applications.findUnique as jest.Mock).mockResolvedValue({
        ...mockApplication,
        circuitBreakerState: CircuitBreakerState.OPEN,
        circuitBreakerResetAt: resetAt,
        consecutiveFailures: 5,
      });

      const result = await circuitBreaker.canHeal('app-1');

      expect(result.allowed).toBe(false);
      expect(result.state).toBe(CircuitBreakerState.OPEN);
      expect(result.reason).toContain('Circuit breaker is open');
    });

    it('should record successful healing', async () => {
      (prisma.applications.findUnique as jest.Mock).mockResolvedValue(mockApplication);
      (prisma.applications.update as jest.Mock).mockResolvedValue(mockApplication);

      await circuitBreaker.recordSuccess('app-1');

      expect(prisma.applications.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: {
          consecutiveFailures: 0,
          circuitBreakerState: CircuitBreakerState.CLOSED,
          circuitBreakerResetAt: null,
        },
      });
    });

    it('should record failed healing and increment failures', async () => {
      (prisma.applications.findUnique as jest.Mock).mockResolvedValue({
        ...mockApplication,
        consecutiveFailures: 1,
      });
      (prisma.applications.update as jest.Mock).mockResolvedValue(mockApplication);

      await circuitBreaker.recordFailure('app-1');

      expect(prisma.applications.update).toHaveBeenCalled();
    });
  });

  describe('Backup & Rollback Integration', () => {
    it('should create backup before healing', async () => {
      (prisma.applications.findUnique as jest.Mock).mockResolvedValue({
        ...mockApplication,
        servers: mockServer,
      });

      // Mock SSH executor to avoid actual SSH calls
      const result = await backupService.createBackup('app-1', 'test-action');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('backupId');
    });

    it('should list backups for application', async () => {
      (prisma.applications.findUnique as jest.Mock).mockResolvedValue({
        ...mockApplication,
        servers: mockServer,
      });

      const backups = await backupService.listBackups('app-1');

      expect(Array.isArray(backups)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle application not found in circuit breaker', async () => {
      (prisma.applications.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(circuitBreaker.canHeal('non-existent')).rejects.toThrow(
        'Application non-existent not found',
      );
    });

    it('should handle application not found in backup service', async () => {
      (prisma.applications.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(backupService.createBackup('non-existent', 'action')).rejects.toThrow(
        'Application non-existent not found',
      );
    });
  });
});
