import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { HealthMonitorService } from './health-monitor.service';
import { IntegrationsService } from './integrations.service';
import { ClientFactoryService } from './client-factory.service';

describe('HealthMonitorService', () => {
  let service: HealthMonitorService;
  let integrationsService: jest.Mocked<IntegrationsService>;
  let clientFactory: jest.Mocked<ClientFactoryService>;
  let mockQueue: any;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn(),
      getWaitingCount: jest.fn().mockResolvedValue(0),
      getActiveCount: jest.fn().mockResolvedValue(0),
      getCompletedCount: jest.fn().mockResolvedValue(10),
      getFailedCount: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthMonitorService,
        {
          provide: getQueueToken('integration-health'),
          useValue: mockQueue,
        },
        {
          provide: IntegrationsService,
          useValue: {
            findAll: jest.fn(),
            updateHealthStatus: jest.fn(),
          },
        },
        {
          provide: ClientFactoryService,
          useValue: {
            getClient: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<HealthMonitorService>(HealthMonitorService);
    integrationsService = module.get(IntegrationsService);
    clientFactory = module.get(ClientFactoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scheduleHealthChecks', () => {
    it('should queue health checks for all active integrations', async () => {
      const mockIntegrations = [
        { id: 'int1', name: 'Integration 1', isActive: true },
        { id: 'int2', name: 'Integration 2', isActive: true },
      ];

      integrationsService.findAll.mockResolvedValue(mockIntegrations as any);

      await service.scheduleHealthChecks();

      expect(integrationsService.findAll).toHaveBeenCalledWith({
        isActive: true,
      });
      expect(mockQueue.add).toHaveBeenCalledTimes(2);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'check-integration',
        { integrationId: 'int1' },
        expect.objectContaining({
          attempts: 3,
          backoff: expect.any(Object),
        }),
      );
    });

    it('should handle errors gracefully', async () => {
      integrationsService.findAll.mockRejectedValue(new Error('Database error'));

      await expect(service.scheduleHealthChecks()).resolves.not.toThrow();
    });
  });

  describe('process', () => {
    it('should test connection and update health status on success', async () => {
      const mockJob = {
        data: { integrationId: 'int1' },
      } as any;

      const mockClient = {
        testConnection: jest.fn().mockResolvedValue({
          success: true,
          message: 'Connection successful',
          latency: 150,
        }),
      };

      clientFactory.getClient.mockResolvedValue(mockClient as any);

      await service.process(mockJob);

      expect(clientFactory.getClient).toHaveBeenCalledWith('int1');
      expect(mockClient.testConnection).toHaveBeenCalled();
      expect(integrationsService.updateHealthStatus).toHaveBeenCalledWith(
        'int1',
        true,
        'Connection successful',
        150,
      );
    });

    it('should update health status to DOWN on failure', async () => {
      const mockJob = {
        data: { integrationId: 'int1' },
      } as any;

      const mockClient = {
        testConnection: jest.fn().mockResolvedValue({
          success: false,
          message: 'Connection failed',
          latency: 5000,
        }),
      };

      clientFactory.getClient.mockResolvedValue(mockClient as any);

      await service.process(mockJob);

      expect(integrationsService.updateHealthStatus).toHaveBeenCalledWith(
        'int1',
        false,
        'Connection failed',
        5000,
      );
    });

    it('should handle errors and update health status', async () => {
      const mockJob = {
        data: { integrationId: 'int1' },
      } as any;

      clientFactory.getClient.mockRejectedValue(new Error('Client error'));

      await expect(service.process(mockJob)).rejects.toThrow('Client error');

      expect(integrationsService.updateHealthStatus).toHaveBeenCalledWith(
        'int1',
        false,
        'Client error',
      );
    });
  });

  describe('triggerHealthCheck', () => {
    it('should manually queue a health check', async () => {
      await service.triggerHealthCheck('int1');

      expect(mockQueue.add).toHaveBeenCalledWith(
        'check-integration',
        { integrationId: 'int1' },
        expect.objectContaining({
          attempts: 1,
        }),
      );
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const stats = await service.getQueueStats();

      expect(stats).toEqual({
        waiting: 0,
        active: 0,
        completed: 10,
        failed: 1,
        total: 11,
      });
    });
  });
});
