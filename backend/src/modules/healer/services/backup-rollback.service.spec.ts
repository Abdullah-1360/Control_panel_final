import { Test, TestingModule } from '@nestjs/testing';
import { BackupRollbackService } from './backup-rollback.service';
import { PrismaService } from '../stubs/prisma.service.stub';
import { SSHExecutorService } from './ssh-executor.service';
import { TechStack } from '@prisma/client';

describe('BackupRollbackService', () => {
  let service: BackupRollbackService;
  let prisma: any;
  let sshExecutor: any;

  const mockApplicationId = 'app-123';
  const mockServerId = 'server-123';
  const mockApplication = {
    id: mockApplicationId,
    name: 'Test App',
    path: '/var/www/test',
    techStack: TechStack.WORDPRESS,
    servers: {
      id: mockServerId,
      name: 'Test Server',
    },
  };

  beforeEach(async () => {
    const mockPrismaService = {
      applications: {
        findUnique: jest.fn(),
      },
    };

    const mockSSHExecutor = {
      executeCommand: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupRollbackService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: SSHExecutorService,
          useValue: mockSSHExecutor,
        },
      ],
    }).compile();

    service = module.get<BackupRollbackService>(BackupRollbackService);
    prisma = module.get(PrismaService);
    sshExecutor = module.get(SSHExecutorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createBackup', () => {
    it('should create backup successfully for WordPress', async () => {
      prisma.applications.findUnique.mockResolvedValue(mockApplication);
      sshExecutor.executeCommand.mockResolvedValue('');

      const result = await service.createBackup(mockApplicationId, 'test_action');

      expect(result.success).toBe(true);
      expect(result.backupId).toContain('test_action');
      expect(result.backupPath).toContain(mockApplicationId);
      expect(result.files.length).toBeGreaterThan(0);
      expect(sshExecutor.executeCommand).toHaveBeenCalled();
    });

    it('should create backup successfully for Laravel', async () => {
      const laravelApp = {
        ...mockApplication,
        techStack: TechStack.LARAVEL,
      };

      prisma.applications.findUnique.mockResolvedValue(laravelApp);
      sshExecutor.executeCommand.mockResolvedValue('');

      const result = await service.createBackup(mockApplicationId, 'test_action');

      expect(result.success).toBe(true);
      expect(result.files).toContain('.env');
      expect(result.files).toContain('composer.json');
    });

    it('should create backup successfully for Node.js', async () => {
      const nodejsApp = {
        ...mockApplication,
        techStack: TechStack.NODEJS,
      };

      prisma.applications.findUnique.mockResolvedValue(nodejsApp);
      sshExecutor.executeCommand.mockResolvedValue('');

      const result = await service.createBackup(mockApplicationId, 'test_action');

      expect(result.success).toBe(true);
      expect(result.files).toContain('package.json');
    });

    it('should handle backup failure gracefully', async () => {
      prisma.applications.findUnique.mockResolvedValue(mockApplication);
      sshExecutor.executeCommand.mockRejectedValue(new Error('SSH connection failed'));

      const result = await service.createBackup(mockApplicationId, 'test_action');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Backup failed');
      expect(result.files).toHaveLength(0);
    });

    it('should throw error when application not found', async () => {
      prisma.applications.findUnique.mockResolvedValue(null);

      await expect(
        service.createBackup(mockApplicationId, 'test_action'),
      ).rejects.toThrow(`Application ${mockApplicationId} not found`);
    });

    it('should clean up old backups after creating new one', async () => {
      prisma.applications.findUnique.mockResolvedValue(mockApplication);
      sshExecutor.executeCommand.mockResolvedValue('');

      await service.createBackup(mockApplicationId, 'test_action');

      // Verify cleanup command was called
      const cleanupCalls = sshExecutor.executeCommand.mock.calls.filter(
        (call: any) => call[1].includes('ls -1t'),
      );
      expect(cleanupCalls.length).toBeGreaterThan(0);
    });
  });

  describe('rollback', () => {
    const mockBackupId = '1234567890-test_action';

    it('should rollback successfully', async () => {
      prisma.applications.findUnique.mockResolvedValue(mockApplication);
      sshExecutor.executeCommand
        .mockResolvedValueOnce('') // Check backup exists
        .mockResolvedValueOnce('wp-config.php\n.htaccess') // List files
        .mockResolvedValue(''); // Copy files back

      const result = await service.rollback(mockApplicationId, mockBackupId);

      expect(result.success).toBe(true);
      expect(result.restoredFiles.length).toBeGreaterThan(0);
      expect(result.message).toContain('successfully');
    });

    it('should handle tar.gz archives during rollback', async () => {
      prisma.applications.findUnique.mockResolvedValue(mockApplication);
      sshExecutor.executeCommand
        .mockResolvedValueOnce('') // Check backup exists
        .mockResolvedValueOnce('storage.tar.gz') // List files
        .mockResolvedValue(''); // Extract tar

      const result = await service.rollback(mockApplicationId, mockBackupId);

      expect(result.success).toBe(true);
      expect(result.restoredFiles).toContain('storage.tar.gz');
      
      // Verify tar extraction command was called
      const tarCalls = sshExecutor.executeCommand.mock.calls.filter(
        (call: any) => call[1].includes('tar -xzf'),
      );
      expect(tarCalls.length).toBeGreaterThan(0);
    });

    it('should handle rollback failure gracefully', async () => {
      prisma.applications.findUnique.mockResolvedValue(mockApplication);
      sshExecutor.executeCommand.mockRejectedValue(new Error('Backup not found'));

      const result = await service.rollback(mockApplicationId, mockBackupId);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Rollback failed');
      expect(result.restoredFiles).toHaveLength(0);
    });

    it('should throw error when application not found', async () => {
      prisma.applications.findUnique.mockResolvedValue(null);

      await expect(
        service.rollback(mockApplicationId, mockBackupId),
      ).rejects.toThrow(`Application ${mockApplicationId} not found`);
    });
  });

  describe('listBackups', () => {
    it('should list all backups for an application', async () => {
      prisma.applications.findUnique.mockResolvedValue(mockApplication);
      sshExecutor.executeCommand
        .mockResolvedValueOnce('1234567890-action1 Jan 15 10:30\n9876543210-action2 Jan 14 09:00')
        .mockResolvedValueOnce('10M')
        .mockResolvedValueOnce('5M');

      const backups = await service.listBackups(mockApplicationId);

      expect(backups).toHaveLength(2);
      expect(backups[0].backupId).toBe('1234567890-action1');
      expect(backups[0].size).toBe('10M');
      expect(backups[1].backupId).toBe('9876543210-action2');
    });

    it('should return empty array when no backups exist', async () => {
      prisma.applications.findUnique.mockResolvedValue(mockApplication);
      sshExecutor.executeCommand.mockResolvedValue('');

      const backups = await service.listBackups(mockApplicationId);

      expect(backups).toHaveLength(0);
    });

    it('should handle listing errors gracefully', async () => {
      prisma.applications.findUnique.mockResolvedValue(mockApplication);
      sshExecutor.executeCommand.mockRejectedValue(new Error('Directory not found'));

      const backups = await service.listBackups(mockApplicationId);

      expect(backups).toHaveLength(0);
    });

    it('should throw error when application not found', async () => {
      prisma.applications.findUnique.mockResolvedValue(null);

      await expect(
        service.listBackups(mockApplicationId),
      ).rejects.toThrow(`Application ${mockApplicationId} not found`);
    });
  });

  describe('deleteBackup', () => {
    const mockBackupId = '1234567890-test_action';

    it('should delete backup successfully', async () => {
      prisma.applications.findUnique.mockResolvedValue(mockApplication);
      sshExecutor.executeCommand.mockResolvedValue('');

      await service.deleteBackup(mockApplicationId, mockBackupId);

      expect(sshExecutor.executeCommand).toHaveBeenCalledWith(
        mockServerId,
        expect.stringContaining('rm -rf'),
      );
    });

    it('should throw error when application not found', async () => {
      prisma.applications.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteBackup(mockApplicationId, mockBackupId),
      ).rejects.toThrow(`Application ${mockApplicationId} not found`);
    });
  });

  describe('performBackup - tech stack specific', () => {
    it('should backup WordPress files', async () => {
      prisma.applications.findUnique.mockResolvedValue(mockApplication);
      sshExecutor.executeCommand.mockResolvedValue('');

      const result = await service.createBackup(mockApplicationId, 'test');

      expect(result.files).toContain('wp-config.php');
    });

    it('should backup Laravel files', async () => {
      const laravelApp = { ...mockApplication, techStack: TechStack.LARAVEL };
      prisma.applications.findUnique.mockResolvedValue(laravelApp);
      sshExecutor.executeCommand.mockResolvedValue('');

      const result = await service.createBackup(mockApplicationId, 'test');

      expect(result.files).toContain('.env');
      expect(result.files).toContain('composer.json');
      expect(result.files).toContain('composer.lock');
    });

    it('should backup Express files', async () => {
      const expressApp = { ...mockApplication, techStack: TechStack.EXPRESS };
      prisma.applications.findUnique.mockResolvedValue(expressApp);
      sshExecutor.executeCommand.mockResolvedValue('');

      const result = await service.createBackup(mockApplicationId, 'test');

      expect(result.files).toContain('package.json');
    });

    it('should backup Next.js files', async () => {
      const nextjsApp = { ...mockApplication, techStack: TechStack.NEXTJS };
      prisma.applications.findUnique.mockResolvedValue(nextjsApp);
      sshExecutor.executeCommand.mockResolvedValue('');

      const result = await service.createBackup(mockApplicationId, 'test');

      expect(result.files).toContain('package.json');
    });

    it('should backup PHP Generic files', async () => {
      const phpApp = { ...mockApplication, techStack: TechStack.PHP_GENERIC };
      prisma.applications.findUnique.mockResolvedValue(phpApp);
      sshExecutor.executeCommand.mockResolvedValue('');

      const result = await service.createBackup(mockApplicationId, 'test');

      expect(result.success).toBe(true);
    });
  });
});
