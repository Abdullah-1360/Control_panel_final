import { Test, TestingModule } from '@nestjs/testing';
import { ServersService } from './servers.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { AuditService } from '../audit/audit.service';
import { SSHConnectionService } from './ssh-connection.service';
import {
  ServerNotFoundException,
  ServerNameConflictException,
  ConnectionTestInProgressException,
  InvalidCredentialsException,
  InvalidServerConfigException,
} from '../../common/exceptions/server.exceptions';
import {
  AuthType,
  SudoMode,
  HostKeyStrategy,
  PlatformType,
  PrivilegeMode,
} from './dto/create-server.dto';

describe('ServersService', () => {
  let service: ServersService;
  let prisma: PrismaService;
  let encryption: EncryptionService;
  let audit: AuditService;
  let sshConnection: SSHConnectionService;

  const mockPrismaService = {
    server: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    serverTestHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockEncryptionService = {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  const mockSSHConnectionService = {
    testConnection: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EncryptionService, useValue: mockEncryptionService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: SSHConnectionService, useValue: mockSSHConnectionService },
      ],
    }).compile();

    service = module.get<ServersService>(ServersService);
    prisma = module.get<PrismaService>(PrismaService);
    encryption = module.get<EncryptionService>(EncryptionService);
    audit = module.get<AuditService>(AuditService);
    sshConnection = module.get<SSHConnectionService>(SSHConnectionService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      name: 'Test Server',
      platformType: PlatformType.LINUX,
      host: '192.168.1.100',
      port: 22,
      connectionProtocol: 'SSH',
      username: 'ubuntu',
      authType: AuthType.SSH_KEY,
      credentials: {
        privateKey: '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----',
      },
      privilegeMode: PrivilegeMode.SUDO,
      sudoMode: SudoMode.NOPASSWD,
      hostKeyStrategy: HostKeyStrategy.TOFU,
    };

    it('should create a server successfully', async () => {
      mockPrismaService.server.findUnique.mockResolvedValue(null);
      mockEncryptionService.encrypt.mockResolvedValue('encrypted_value');
      mockPrismaService.server.create.mockResolvedValue({
        id: 'server-123',
        ...createDto,
        encryptedPrivateKey: 'encrypted_value',
        lastTestStatus: 'NEVER_TESTED',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(createDto, 'user-123');

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Server');
      expect(mockPrismaService.server.findUnique).toHaveBeenCalledWith({
        where: { name: 'Test Server' },
      });
      expect(mockEncryptionService.encrypt).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw ServerNameConflictException if name exists', async () => {
      mockPrismaService.server.findUnique.mockResolvedValue({ id: 'existing-server' });

      await expect(service.create(createDto, 'user-123')).rejects.toThrow(
        ServerNameConflictException,
      );
    });

    it('should throw InvalidCredentialsException if SSH key missing', async () => {
      const invalidDto = {
        ...createDto,
        credentials: {},
      };

      mockPrismaService.server.findUnique.mockResolvedValue(null);

      await expect(service.create(invalidDto as any, 'user-123')).rejects.toThrow(
        InvalidCredentialsException,
      );
    });

    it('should throw InvalidServerConfigException if sudo password missing', async () => {
      const invalidDto = {
        ...createDto,
        sudoMode: SudoMode.PASSWORD_REQUIRED,
        sudoPassword: undefined,
      };

      mockPrismaService.server.findUnique.mockResolvedValue(null);

      await expect(service.create(invalidDto as any, 'user-123')).rejects.toThrow(
        InvalidServerConfigException,
      );
    });
  });

  describe('findOne', () => {
    it('should return a server by ID', async () => {
      const mockServer = {
        id: 'server-123',
        name: 'Test Server',
        host: '192.168.1.100',
        port: 22,
        encryptedPrivateKey: 'encrypted',
        createdBy: { id: 'user-123', email: 'test@example.com', username: 'test' },
      };

      mockPrismaService.server.findFirst.mockResolvedValue(mockServer);

      const result = await service.findOne('server-123', 'user-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('server-123');
      expect(result.hasPrivateKey).toBe(true);
    });

    it('should throw ServerNotFoundException if server not found', async () => {
      mockPrismaService.server.findFirst.mockResolvedValue(null);

      await expect(service.findOne('non-existent', 'user-123')).rejects.toThrow(
        ServerNotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated server list', async () => {
      const mockServers = [
        { id: 'server-1', name: 'Server 1', encryptedPrivateKey: 'enc1' },
        { id: 'server-2', name: 'Server 2', encryptedPrivateKey: 'enc2' },
      ];

      mockPrismaService.server.count.mockResolvedValue(2);
      mockPrismaService.server.findMany.mockResolvedValue(mockServers);

      const result = await service.findAll({ page: 1, limit: 50 }, 'user-123');

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter by platform type', async () => {
      mockPrismaService.server.count.mockResolvedValue(1);
      mockPrismaService.server.findMany.mockResolvedValue([
        { id: 'server-1', name: 'Linux Server', platformType: 'LINUX' },
      ]);

      const result = await service.findAll({ platformType: 'LINUX' }, 'user-123');

      expect(result.data).toHaveLength(1);
      expect(mockPrismaService.server.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ platformType: 'LINUX' }),
        }),
      );
    });
  });

  describe('update', () => {
    it('should update server successfully', async () => {
      const mockServer = {
        id: 'server-123',
        name: 'Old Name',
        host: '192.168.1.100',
      };

      mockPrismaService.server.findFirst.mockResolvedValue(mockServer);
      mockPrismaService.server.findUnique.mockResolvedValue(null);
      mockPrismaService.server.update.mockResolvedValue({
        ...mockServer,
        name: 'New Name',
      });

      const result = await service.update('server-123', { name: 'New Name' }, 'user-123');

      expect(result.name).toBe('New Name');
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw ServerNotFoundException if server not found', async () => {
      mockPrismaService.server.findFirst.mockResolvedValue(null);

      await expect(service.update('non-existent', { name: 'New' }, 'user-123')).rejects.toThrow(
        ServerNotFoundException,
      );
    });

    it('should throw ServerNameConflictException on name conflict', async () => {
      mockPrismaService.server.findFirst.mockResolvedValue({ id: 'server-123', name: 'Old' });
      mockPrismaService.server.findUnique.mockResolvedValue({ id: 'other-server' });

      await expect(service.update('server-123', { name: 'Existing' }, 'user-123')).rejects.toThrow(
        ServerNameConflictException,
      );
    });
  });

  describe('remove', () => {
    it('should soft delete server successfully', async () => {
      const mockServer = { id: 'server-123', name: 'Test Server' };

      mockPrismaService.server.findFirst.mockResolvedValue(mockServer);
      mockPrismaService.server.update.mockResolvedValue({
        ...mockServer,
        deletedAt: new Date(),
      });

      const result = await service.remove('server-123', 'user-123', false);

      expect(result.success).toBe(true);
      expect(mockPrismaService.server.update).toHaveBeenCalledWith({
        where: { id: 'server-123' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw ServerNotFoundException if server not found', async () => {
      mockPrismaService.server.findFirst.mockResolvedValue(null);

      await expect(service.remove('non-existent', 'user-123', false)).rejects.toThrow(
        ServerNotFoundException,
      );
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully (sync)', async () => {
      const mockServer = {
        id: 'server-123',
        name: 'Test Server',
        host: '192.168.1.100',
        port: 22,
        username: 'ubuntu',
        authType: 'SSH_KEY',
        encryptedPrivateKey: 'encrypted',
        sudoMode: 'NOPASSWD',
        hostKeyStrategy: 'TOFU',
        knownHostFingerprints: [],
      };

      const mockTestResult = {
        success: true,
        message: 'Connection successful',
        latency: 1234,
        testedAt: new Date(),
        details: {
          dnsResolution: { success: true, time: 45 },
          tcpConnection: { success: true, time: 123 },
          hostKeyVerification: { success: true, matched: true },
          authentication: { success: true, time: 456 },
          privilegeTest: { success: true },
          commandExecution: {},
        },
        errors: [],
        warnings: [],
      };

      mockPrismaService.server.findFirst.mockResolvedValue(mockServer);
      mockEncryptionService.decrypt.mockResolvedValue('decrypted_key');
      mockSSHConnectionService.testConnection.mockResolvedValue(mockTestResult);
      mockPrismaService.server.update.mockResolvedValue(mockServer);
      mockPrismaService.serverTestHistory.create.mockResolvedValue({});
      mockPrismaService.serverTestHistory.deleteMany.mockResolvedValue({});

      const result = await service.testConnection('server-123', 'user-123', false);

      expect(result.success).toBe(true);
      expect(mockSSHConnectionService.testConnection).toHaveBeenCalled();
      expect(mockPrismaService.serverTestHistory.create).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it.skip('should throw ConnectionTestInProgressException if test already running', async () => {
      const mockServer = { id: 'server-123', name: 'Test Server' };
      mockPrismaService.server.findFirst.mockResolvedValue(mockServer);
      mockEncryptionService.decrypt.mockResolvedValue('decrypted_key');
      
      // Make the SSH test take longer to simulate concurrent access
      mockSSHConnectionService.testConnection.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: true,
              message: 'Connection successful',
              latency: 1234,
              testedAt: new Date(),
              details: {
                dnsResolution: { success: true, time: 45 },
                tcpConnection: { success: true, time: 123 },
                hostKeyVerification: { success: true, matched: true },
                authentication: { success: true, time: 456 },
                privilegeTest: { success: true },
                commandExecution: {},
              },
              errors: [],
              warnings: [],
            });
          }, 100); // 100ms delay
        });
      });

      // Start first test (don't await)
      const promise1 = service.testConnection('server-123', 'user-123', false);

      // Try to start second test immediately (should fail)
      await expect(service.testConnection('server-123', 'user-123', false)).rejects.toThrow(
        ConnectionTestInProgressException,
      );

      // Wait for first test to complete
      await promise1;
    });

    it('should return immediately for async test', async () => {
      const mockServer = { id: 'server-123', name: 'Test Server' };
      mockPrismaService.server.findFirst.mockResolvedValue(mockServer);

      const result: any = await service.testConnection('server-123', 'user-123', true);

      expect(result.async).toBe(true);
      expect(result.message).toContain('background');
    });
  });

  describe('getTestHistory', () => {
    it('should return test history for last 10 days', async () => {
      const mockServer = { id: 'server-123', name: 'Test Server' };
      const mockHistory = [
        {
          id: 'test-1',
          success: true,
          testedAt: new Date(),
          triggeredBy: { id: 'user-123', email: 'test@example.com', username: 'test' },
        },
      ];

      mockPrismaService.server.findFirst.mockResolvedValue(mockServer);
      mockPrismaService.serverTestHistory.findMany.mockResolvedValue(mockHistory);

      const result = await service.getTestHistory('server-123', 'user-123');

      expect(result.total).toBe(1);
      expect(result.history).toHaveLength(1);
      expect(mockPrismaService.serverTestHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            serverId: 'server-123',
            testedAt: expect.objectContaining({ gte: expect.any(Date) }),
          }),
        }),
      );
    });
  });

  describe('checkDependencies', () => {
    it('should return empty dependencies (placeholder)', async () => {
      const result = await service.checkDependencies('server-123');

      expect(result.hasDependencies).toBe(false);
      expect(result.dependencies.applications.count).toBe(0);
    });
  });
});
