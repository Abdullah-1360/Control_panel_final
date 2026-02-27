import { Test, TestingModule } from '@nestjs/testing';
import { CircuitBreakerService } from './circuit-breaker.service';
import { PrismaService } from '../stubs/prisma.service.stub';
import { CircuitBreakerState } from '@prisma/client';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;
  let prisma: any;

  const mockApplicationId = 'app-123';

  beforeEach(async () => {
    const mockPrismaService = {
      applications: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CircuitBreakerService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CircuitBreakerService>(CircuitBreakerService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canHeal', () => {
    it('should allow healing when circuit is CLOSED', async () => {
      prisma.applications.findUnique.mockResolvedValue({
        id: mockApplicationId,
        circuitBreakerState: CircuitBreakerState.CLOSED,
        circuitBreakerResetAt: null,
        consecutiveFailures: 0,
        maxRetries: 3,
      } as any);

      const result = await service.canHeal(mockApplicationId);

      expect(result.allowed).toBe(true);
      expect(result.state).toBe(CircuitBreakerState.CLOSED);
      expect(result.reason).toBeUndefined();
    });

    it('should allow healing when circuit is HALF_OPEN', async () => {
      prisma.applications.findUnique.mockResolvedValue({
        id: mockApplicationId,
        circuitBreakerState: CircuitBreakerState.HALF_OPEN,
        circuitBreakerResetAt: null,
        consecutiveFailures: 2,
        maxRetries: 3,
      } as any);

      const result = await service.canHeal(mockApplicationId);

      expect(result.allowed).toBe(true);
      expect(result.state).toBe(CircuitBreakerState.HALF_OPEN);
    });

    it('should block healing when circuit is OPEN and cooldown not passed', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      prisma.applications.findUnique.mockResolvedValue({
        id: mockApplicationId,
        circuitBreakerState: CircuitBreakerState.OPEN,
        circuitBreakerResetAt: futureDate,
        consecutiveFailures: 3,
        maxRetries: 3,
      } as any);

      const result = await service.canHeal(mockApplicationId);

      expect(result.allowed).toBe(false);
      expect(result.state).toBe(CircuitBreakerState.OPEN);
      expect(result.reason).toContain('Circuit breaker is open');
      expect(result.reason).toContain('60 minutes');
    });

    it('should transition to HALF_OPEN when cooldown period passed', async () => {
      const pastDate = new Date(Date.now() - 1000); // 1 second ago

      prisma.applications.findUnique.mockResolvedValue({
        id: mockApplicationId,
        circuitBreakerState: CircuitBreakerState.OPEN,
        circuitBreakerResetAt: pastDate,
        consecutiveFailures: 3,
        maxRetries: 3,
      } as any);

      prisma.applications.update.mockResolvedValue({} as any);

      const result = await service.canHeal(mockApplicationId);

      expect(result.allowed).toBe(true);
      expect(result.state).toBe(CircuitBreakerState.HALF_OPEN);
      expect(prisma.applications.update).toHaveBeenCalledWith({
        where: { id: mockApplicationId },
        data: {
          circuitBreakerState: CircuitBreakerState.HALF_OPEN,
          circuitBreakerResetAt: null,
        },
      });
    });

    it('should throw error when application not found', async () => {
      prisma.applications.findUnique.mockResolvedValue(null);

      await expect(service.canHeal(mockApplicationId)).rejects.toThrow(
        `Application ${mockApplicationId} not found`,
      );
    });
  });

  describe('recordSuccess', () => {
    it('should reset consecutive failures and close circuit', async () => {
      prisma.applications.findUnique.mockResolvedValue({
        id: mockApplicationId,
        circuitBreakerState: CircuitBreakerState.CLOSED,
      } as any);

      prisma.applications.update.mockResolvedValue({} as any);

      await service.recordSuccess(mockApplicationId);

      expect(prisma.applications.update).toHaveBeenCalledWith({
        where: { id: mockApplicationId },
        data: {
          consecutiveFailures: 0,
          circuitBreakerState: CircuitBreakerState.CLOSED,
          circuitBreakerResetAt: null,
        },
      });
    });

    it('should transition from HALF_OPEN to CLOSED on success', async () => {
      prisma.applications.findUnique.mockResolvedValue({
        id: mockApplicationId,
        circuitBreakerState: CircuitBreakerState.HALF_OPEN,
      } as any);

      prisma.applications.update.mockResolvedValue({} as any);

      await service.recordSuccess(mockApplicationId);

      expect(prisma.applications.update).toHaveBeenCalledWith({
        where: { id: mockApplicationId },
        data: {
          consecutiveFailures: 0,
          circuitBreakerState: CircuitBreakerState.CLOSED,
          circuitBreakerResetAt: null,
        },
      });
    });

    it('should throw error when application not found', async () => {
      prisma.applications.findUnique.mockResolvedValue(null);

      await expect(service.recordSuccess(mockApplicationId)).rejects.toThrow(
        `Application ${mockApplicationId} not found`,
      );
    });
  });

  describe('recordFailure', () => {
    it('should increment consecutive failures', async () => {
      prisma.applications.findUnique.mockResolvedValue({
        id: mockApplicationId,
        circuitBreakerState: CircuitBreakerState.CLOSED,
        consecutiveFailures: 1,
        maxRetries: 3,
      } as any);

      prisma.applications.update.mockResolvedValue({} as any);

      await service.recordFailure(mockApplicationId);

      expect(prisma.applications.update).toHaveBeenCalledWith({
        where: { id: mockApplicationId },
        data: { consecutiveFailures: 2 },
      });
    });

    it('should open circuit when max failures reached', async () => {
      prisma.applications.findUnique.mockResolvedValue({
        id: mockApplicationId,
        circuitBreakerState: CircuitBreakerState.CLOSED,
        consecutiveFailures: 2,
        maxRetries: 3,
      } as any);

      prisma.applications.update.mockResolvedValue({} as any);

      await service.recordFailure(mockApplicationId);

      expect(prisma.applications.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockApplicationId },
          data: expect.objectContaining({
            circuitBreakerState: CircuitBreakerState.OPEN,
            consecutiveFailures: 3,
            lastCircuitBreakerOpen: expect.any(Date),
            circuitBreakerResetAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should transition from HALF_OPEN to OPEN on failure', async () => {
      prisma.applications.findUnique.mockResolvedValue({
        id: mockApplicationId,
        circuitBreakerState: CircuitBreakerState.HALF_OPEN,
        consecutiveFailures: 2,
        maxRetries: 3,
      } as any);

      prisma.applications.update.mockResolvedValue({} as any);

      await service.recordFailure(mockApplicationId);

      expect(prisma.applications.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockApplicationId },
          data: expect.objectContaining({
            circuitBreakerState: CircuitBreakerState.OPEN,
            consecutiveFailures: 3,
          }),
        }),
      );
    });

    it('should use default max failures when not set', async () => {
      prisma.applications.findUnique.mockResolvedValue({
        id: mockApplicationId,
        circuitBreakerState: CircuitBreakerState.CLOSED,
        consecutiveFailures: 2,
        maxRetries: null,
      } as any);

      prisma.applications.update.mockResolvedValue({} as any);

      await service.recordFailure(mockApplicationId);

      // Should open circuit (3 failures = default max)
      expect(prisma.applications.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            circuitBreakerState: CircuitBreakerState.OPEN,
          }),
        }),
      );
    });

    it('should throw error when application not found', async () => {
      prisma.applications.findUnique.mockResolvedValue(null);

      await expect(service.recordFailure(mockApplicationId)).rejects.toThrow(
        `Application ${mockApplicationId} not found`,
      );
    });
  });

  describe('manualReset', () => {
    it('should reset circuit breaker to CLOSED state', async () => {
      prisma.applications.update.mockResolvedValue({} as any);

      await service.manualReset(mockApplicationId);

      expect(prisma.applications.update).toHaveBeenCalledWith({
        where: { id: mockApplicationId },
        data: {
          circuitBreakerState: CircuitBreakerState.CLOSED,
          consecutiveFailures: 0,
          circuitBreakerResetAt: null,
        },
      });
    });
  });

  describe('getStatus', () => {
    it('should return circuit breaker status', async () => {
      const futureResetAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      prisma.applications.findUnique.mockResolvedValue({
        id: mockApplicationId,
        circuitBreakerState: CircuitBreakerState.OPEN,
        consecutiveFailures: 3,
        maxRetries: 3,
        circuitBreakerResetAt: futureResetAt,
      } as any);

      const status = await service.getStatus(mockApplicationId);

      expect(status.state).toBe(CircuitBreakerState.OPEN);
      expect(status.consecutiveFailures).toBe(3);
      expect(status.maxRetries).toBe(3);
      expect(status.resetAt).toBe(futureResetAt);
      expect(status.canHeal).toBe(false); // Still in cooldown
    });

    it('should use default max retries when not set', async () => {
      prisma.applications.findUnique.mockResolvedValue({
        id: mockApplicationId,
        circuitBreakerState: CircuitBreakerState.CLOSED,
        consecutiveFailures: 0,
        maxRetries: null,
        circuitBreakerResetAt: null,
      } as any);

      const status = await service.getStatus(mockApplicationId);

      expect(status.maxRetries).toBe(3); // Default value
    });

    it('should throw error when application not found', async () => {
      prisma.applications.findUnique.mockResolvedValue(null);

      await expect(service.getStatus(mockApplicationId)).rejects.toThrow(
        `Application ${mockApplicationId} not found`,
      );
    });
  });
});
