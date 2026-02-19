import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { AuditService } from '../audit/audit.service';
import { SSHConnectionService } from './ssh-connection.service';
import { EventBusService, SystemEvent } from '../../common/events/event-bus.service';
import { CreateServerDto, AuthType, SudoMode, HostKeyStrategy } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';
import { QueryServersDto } from './dto/query-servers.dto';
import {
  ServerNotFoundException,
  ServerNameConflictException,
  ServerHasDependenciesException,
  ConnectionTestInProgressException,
  InvalidCredentialsException,
  InvalidServerConfigException,
} from '../../common/exceptions/server.exceptions';

@Injectable()
export class ServersService {
  private readonly logger = new Logger(ServersService.name);
  private readonly testLocks = new Map<string, boolean>(); // Track ongoing tests

  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private audit: AuditService,
    private sshConnection: SSHConnectionService,
    private eventBus: EventBusService,
  ) {}

  /**
   * Create a new server profile
   */
  async create(dto: CreateServerDto, userId: string) {
    // Check name uniqueness (exclude soft-deleted servers)
    const existing = await this.prisma.servers.findFirst({
      where: { 
        name: dto.name,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ServerNameConflictException(dto.name);
    }

    // Validate credentials based on authType
    this.validateCredentials(dto.authType, dto.credentials);

    // Validate sudo configuration
    if (dto.sudoMode === SudoMode.PASSWORD_REQUIRED && !dto.sudoPassword) {
      throw new InvalidServerConfigException(
        'sudoPassword is required when sudoMode is PASSWORD_REQUIRED',
      );
    }

    // Validate host key strategy
    if (
      dto.hostKeyStrategy === HostKeyStrategy.STRICT_PINNED &&
      (!dto.knownHostFingerprints || dto.knownHostFingerprints.length === 0)
    ) {
      throw new InvalidServerConfigException(
        'knownHostFingerprints are required when hostKeyStrategy is STRICT_PINNED',
      );
    }

    // Encrypt credentials
    const encryptedPrivateKey = dto.credentials.privateKey
      ? await this.encryption.encrypt(dto.credentials.privateKey)
      : null;
    const encryptedPassphrase = dto.credentials.passphrase
      ? await this.encryption.encrypt(dto.credentials.passphrase)
      : null;
    const encryptedPassword = dto.credentials.password
      ? await this.encryption.encrypt(dto.credentials.password)
      : null;
    const encryptedSudoPassword = dto.sudoPassword
      ? await this.encryption.encrypt(dto.sudoPassword)
      : null;

    // Prepare host key fingerprints with timestamps
    const knownHostFingerprints = dto.knownHostFingerprints
      ? dto.knownHostFingerprints.map((fp) => ({
          keyType: fp.keyType,
          fingerprint: fp.fingerprint,
          firstSeenAt: new Date().toISOString(),
          lastVerifiedAt: new Date().toISOString(),
        }))
      : [];

    // Create server
    const server = await this.prisma.servers.create({
      data: {
        name: dto.name,
        environment: dto.environment || null,
        tags: dto.tags || [],
        notes: dto.notes || null,
        platformType: dto.platformType,
        host: dto.host,
        port: dto.port,
        connectionProtocol: dto.connectionProtocol,
        username: dto.username,
        authType: dto.authType,
        encryptedPrivateKey,
        encryptedPassphrase,
        encryptedPassword,
        privilegeMode: dto.privilegeMode,
        sudoMode: dto.sudoMode,
        encryptedSudoPassword,
        hostKeyStrategy: dto.hostKeyStrategy,
        knownHostFingerprints: knownHostFingerprints.length > 0 ? knownHostFingerprints : [],
        lastTestStatus: 'NEVER_TESTED',
        metricsEnabled: dto.metricsEnabled ?? true,
        metricsInterval: dto.metricsInterval ?? 900,
        alertCpuThreshold: dto.alertCpuThreshold ?? 90.0,
        alertRamThreshold: dto.alertRamThreshold ?? 95.0,
        alertDiskThreshold: dto.alertDiskThreshold ?? 90.0,
        createdByUserId: userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
      },
    });

    // Audit log
    await this.audit.log({
      userId,
      actorType: 'USER',
      action: 'SERVER_CREATED',
      resource: 'server',
      resourceId: server.id,
      severity: 'INFO',
      description: `Server "${server.name}" created`,
      metadata: {
        serverName: server.name,
        host: server.host,
        platformType: server.platformType,
        authType: server.authType,
        hostKeyStrategy: server.hostKeyStrategy,
      },
    });

    // Log warning if TOFU or DISABLED
    if (dto.hostKeyStrategy === HostKeyStrategy.TOFU) {
      await this.audit.log({
        userId,
        actorType: 'USER',
        action: 'HOST_KEY_TOFU_SELECTED',
        resource: 'server',
        resourceId: server.id,
        severity: 'WARNING',
        description: `Server "${server.name}" created with TOFU host key strategy`,
        metadata: { serverName: server.name },
      });
    } else if (dto.hostKeyStrategy === HostKeyStrategy.DISABLED) {
      await this.audit.log({
        userId,
        actorType: 'USER',
        action: 'HOST_KEY_VERIFICATION_DISABLED',
        resource: 'server',
        resourceId: server.id,
        severity: 'CRITICAL',
        description: `Server "${server.name}" created with DISABLED host key verification`,
        metadata: { serverName: server.name },
      });
    }

    // Emit SSE event for real-time updates
    this.eventBus.emit({
      type: SystemEvent.SERVER_CREATED,
      data: {
        id: server.id,
        name: server.name,
        host: server.host,
        platformType: server.platformType,
        environment: server.environment,
        lastTestStatus: server.lastTestStatus,
      },
      timestamp: new Date(),
      permissions: ['servers.read'],
    });

    return this.sanitizeServer(server);
  }

  /**
   * Find all servers with pagination and filtering
   */
  async findAll(query: QueryServersDto, userId: string) {
    const { page = 1, limit = 50, sort = 'name', order = 'asc', search, platformType, environment, tags, lastTestStatus } =
      query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      deletedAt: null, // Exclude soft-deleted
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { host: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }

    if (platformType) {
      where.platformType = platformType;
    }

    if (environment) {
      where.environment = environment;
    }

    if (tags) {
      const tagArray = tags.split(',').map((t) => t.trim());
      where.tags = { hasSome: tagArray };
    }

    if (lastTestStatus) {
      where.lastTestStatus = lastTestStatus;
    }

    // Get total count
    const total = await this.prisma.servers.count({ where });

    // Get servers
    const servers = await this.prisma.servers.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sort as string]: order },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
      },
    });

    return {
      data: servers.map((s: any) => this.sanitizeServer(s)),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find one server by ID
   */
  async findOne(id: string, userId: string) {
    const server = await this.prisma.servers.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
      },
    });

    if (!server) {
      throw new ServerNotFoundException(id);
    }

    return this.sanitizeServer(server);
  }

  /**
   * Update server profile
   */
  async update(id: string, dto: UpdateServerDto, userId: string) {
    const server = await this.prisma.servers.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!server) {
      throw new ServerNotFoundException(id);
    }

    // Check name uniqueness if name is being changed
    if (dto.name && dto.name !== server.name) {
      const existing = await this.prisma.servers.findFirst({
        where: { 
          name: dto.name,
          deletedAt: null,
        },
      });

      if (existing) {
        throw new ServerNameConflictException(dto.name);
      }
    }

    // Validate credentials if being updated
    if (dto.authType && dto.credentials) {
      this.validateCredentials(dto.authType, dto.credentials);
    }

    // Validate sudo configuration if being updated
    if (dto.sudoMode === SudoMode.PASSWORD_REQUIRED && !dto.sudoPassword) {
      throw new InvalidServerConfigException(
        'sudoPassword is required when sudoMode is PASSWORD_REQUIRED',
      );
    }

    // Prepare update data
    const updateData: any = {};

    // Basic fields
    if (dto.name) updateData.name = dto.name;
    if (dto.environment !== undefined) updateData.environment = dto.environment;
    if (dto.tags) updateData.tags = dto.tags;
    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.host) updateData.host = dto.host;
    if (dto.port) updateData.port = dto.port;
    if (dto.username) updateData.username = dto.username;

    // Encrypt credentials if provided
    if (dto.credentials) {
      if (dto.credentials.privateKey) {
        updateData.encryptedPrivateKey = await this.encryption.encrypt(dto.credentials.privateKey);
      }
      if (dto.credentials.passphrase) {
        updateData.encryptedPassphrase = await this.encryption.encrypt(dto.credentials.passphrase);
      }
      if (dto.credentials.password) {
        updateData.encryptedPassword = await this.encryption.encrypt(dto.credentials.password);
      }

      // Log credential update
      await this.audit.log({
        userId,
        actorType: 'USER',
        action: 'CREDENTIALS_UPDATED',
        resource: 'server',
        resourceId: id,
        severity: 'HIGH',
        description: `Credentials updated for server "${server.name}"`,
        metadata: { serverName: server.name },
      });
    }

    if (dto.authType) updateData.authType = dto.authType;
    if (dto.privilegeMode) updateData.privilegeMode = dto.privilegeMode;
    if (dto.sudoMode) updateData.sudoMode = dto.sudoMode;

    if (dto.sudoPassword) {
      updateData.encryptedSudoPassword = await this.encryption.encrypt(dto.sudoPassword);
    }

    // Host key updates
    if (dto.hostKeyStrategy) {
      updateData.hostKeyStrategy = dto.hostKeyStrategy;

      await this.audit.log({
        userId,
        actorType: 'USER',
        action: 'HOST_KEY_CONFIG_CHANGED',
        resource: 'server',
        resourceId: id,
        severity: 'HIGH',
        description: `Host key strategy changed for server "${server.name}"`,
        metadata: {
          serverName: server.name,
          oldStrategy: server.hostKeyStrategy,
          newStrategy: dto.hostKeyStrategy,
        },
      });
    }

    if (dto.knownHostFingerprints) {
      updateData.knownHostFingerprints = dto.knownHostFingerprints.map((fp) => ({
        keyType: fp.keyType,
        fingerprint: fp.fingerprint,
        firstSeenAt: new Date().toISOString(),
        lastVerifiedAt: new Date().toISOString(),
      }));
    }

    // If host or port changed, invalidate test status
    if (dto.host || dto.port) {
      updateData.lastTestStatus = 'NEVER_TESTED';
      updateData.lastTestAt = null;
      updateData.lastTestResult = null;

      await this.audit.log({
        userId,
        actorType: 'USER',
        action: 'CONNECTION_DETAILS_CHANGED',
        resource: 'server',
        resourceId: id,
        severity: 'WARNING',
        description: `Connection details changed for server "${server.name}"`,
        metadata: { serverName: server.name },
      });
    }

    // Metrics configuration
    if (dto.metricsEnabled !== undefined) updateData.metricsEnabled = dto.metricsEnabled;
    if (dto.metricsInterval !== undefined) updateData.metricsInterval = dto.metricsInterval;
    if (dto.alertCpuThreshold !== undefined) updateData.alertCpuThreshold = dto.alertCpuThreshold;
    if (dto.alertRamThreshold !== undefined) updateData.alertRamThreshold = dto.alertRamThreshold;
    if (dto.alertDiskThreshold !== undefined) updateData.alertDiskThreshold = dto.alertDiskThreshold;

    // Update server
    const updated = await this.prisma.servers.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
      },
    });

    // Audit log
    await this.audit.log({
      userId,
      actorType: 'USER',
      action: 'SERVER_UPDATED',
      resource: 'server',
      resourceId: id,
      severity: 'INFO',
      description: `Server "${updated.name}" updated`,
      metadata: { serverName: updated.name },
    });

    // Emit SSE event for real-time updates
    this.eventBus.emit({
      type: SystemEvent.SERVER_UPDATED,
      data: {
        id: updated.id,
        name: updated.name,
        host: updated.host,
        platformType: updated.platformType,
        environment: updated.environment,
        lastTestStatus: updated.lastTestStatus,
        changes: Object.keys(updateData),
      },
      timestamp: new Date(),
      permissions: ['servers.read'],
    });

    return this.sanitizeServer(updated);
  }

  /**
   * Delete server (soft delete with 7-day retention)
   */
  async remove(id: string, userId: string, force: boolean = false) {
    const server = await this.prisma.servers.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!server) {
      throw new ServerNotFoundException(id);
    }

    // Check dependencies (placeholder for now)
    const dependencies = await this.checkDependencies(id);

    if (dependencies.hasDependencies && !force) {
      throw new ServerHasDependenciesException(id, dependencies);
    }

    if (force && dependencies.hasDependencies) {
      // Log critical audit event for forced deletion
      await this.audit.log({
        userId,
        actorType: 'USER',
        action: 'SERVER_FORCE_DELETED',
        resource: 'server',
        resourceId: id,
        severity: 'CRITICAL',
        description: `Server "${server.name}" force deleted with active dependencies`,
        metadata: {
          serverName: server.name,
          dependencies,
        },
      });
    }

    // Soft delete
    await this.prisma.servers.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Audit log
    await this.audit.log({
      userId,
      actorType: 'USER',
      action: 'SERVER_DELETED',
      resource: 'server',
      resourceId: id,
      severity: 'HIGH',
      description: `Server "${server.name}" deleted (soft delete, 7-day retention)`,
      metadata: { serverName: server.name },
    });

    return {
      success: true,
      message: 'Server deleted successfully',
    };
  }

  /**
   * Check server dependencies
   */
  async checkDependencies(id: string) {
    // Check if server exists
    const server = await this.prisma.servers.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!server) {
      throw new ServerNotFoundException(id);
    }

    // Query integrations linked to this server
    const integrations = await this.prisma.integrations.findMany({
      where: {
        linkedServerId: id,
      },
      select: {
        id: true,
        name: true,
        provider: true,
        isActive: true,
        healthStatus: true,
      },
    });

    // TODO: Query other dependencies when modules are implemented
    // - Sites (Module 4)
    // - Incidents (Module 6)
    // - Jobs (Module 5)

    const hasDependencies = integrations.length > 0;

    return {
      serverId: id,
      hasDependencies,
      dependencies: {
        integrations: {
          count: integrations.length,
          items: integrations,
        },
        sites: { count: 0, items: [] },
        incidents: { count: 0, items: [] },
        jobs: { count: 0, items: [] },
      },
    };
  }

  /**
   * Get server with decrypted credentials (for internal use only)
   */
  async getServerForConnection(id: string) {
    const server = await this.prisma.servers.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!server) {
      throw new ServerNotFoundException(id);
    }

    // Decrypt credentials
    const credentials: any = {};

    if (server.encryptedPrivateKey) {
      credentials.privateKey = await this.encryption.decrypt(server.encryptedPrivateKey);
    }

    if (server.encryptedPassphrase) {
      credentials.passphrase = await this.encryption.decrypt(server.encryptedPassphrase);
    }

    if (server.encryptedPassword) {
      credentials.password = await this.encryption.decrypt(server.encryptedPassword);
    }

    const sudoPassword = server.encryptedSudoPassword
      ? await this.encryption.decrypt(server.encryptedSudoPassword)
      : null;

    return {
      id: server.id,
      name: server.name,
      host: server.host,
      port: server.port,
      username: server.username,
      authType: server.authType,
      credentials,
      privilegeMode: server.privilegeMode,
      sudoMode: server.sudoMode,
      sudoPassword,
      hostKeyStrategy: server.hostKeyStrategy,
      knownHostFingerprints: server.knownHostFingerprints,
    };
  }

  /**
   * Validate credentials based on auth type
   */
  private validateCredentials(authType: AuthType, credentials: any) {
    if (authType === AuthType.SSH_KEY) {
      if (!credentials.privateKey) {
        throw new InvalidCredentialsException('privateKey is required for SSH_KEY auth type');
      }
    } else if (authType === AuthType.SSH_KEY_WITH_PASSPHRASE) {
      if (!credentials.privateKey || !credentials.passphrase) {
        throw new InvalidCredentialsException(
          'privateKey and passphrase are required for SSH_KEY_WITH_PASSPHRASE auth type',
        );
      }
    } else if (authType === AuthType.PASSWORD) {
      if (!credentials.password) {
        throw new InvalidCredentialsException('password is required for PASSWORD auth type');
      }
    }
  }

  /**
   * Test server connection
   */
  async testConnection(id: string, userId: string, async: boolean = false) {
    // Check if test is already running
    if (this.testLocks.get(id)) {
      throw new ConnectionTestInProgressException(id);
    }

    const server = await this.prisma.servers.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!server) {
      throw new ServerNotFoundException(id);
    }

    // If async, start test in background
    if (async) {
      this.performConnectionTest(id, userId).catch((error) => {
        this.logger.error(`Async connection test failed for server ${id}`, error);
      });

      return {
        success: true,
        message: 'Connection test started in background',
        async: true,
      };
    }

    // Synchronous test
    return this.performConnectionTest(id, userId);
  }

  /**
   * Perform connection test (internal method)
   */
  private async performConnectionTest(id: string, userId: string) {
    // Lock the server for testing
    this.testLocks.set(id, true);

    try {
      // Get server with decrypted credentials
      const serverConfig = await this.getServerForConnection(id);

      // Prepare SSH config
      const sshConfig = {
        host: serverConfig.host,
        port: serverConfig.port,
        username: serverConfig.username,
        privateKey: serverConfig.credentials.privateKey,
        passphrase: serverConfig.credentials.passphrase,
        password: serverConfig.credentials.password,
      };

      // Perform connection test
      const testResult = await this.sshConnection.testConnection(
        sshConfig,
        id,
        serverConfig.hostKeyStrategy,
        (serverConfig.knownHostFingerprints as any[]) || [],
        serverConfig.sudoMode,
        serverConfig.sudoPassword || undefined,
        [], // No custom commands for now
      );

      // Determine test status
      const testStatus = testResult.success ? 'OK' : 'FAILED';

      // Update server with test results
      await this.prisma.servers.update({
        where: { id },
        data: {
          lastTestStatus: testStatus,
          lastTestAt: new Date(),
          lastTestResult: testResult as any,
        },
      });

      // Store test history
      await this.prisma.server_test_history.create({
        data: {
          serverId: id,
          triggeredByUserId: userId,
          success: testResult.success,
          message: testResult.message,
          latency: testResult.latency,
          details: testResult.details as any,
          detectedOS: testResult.detectedOS,
          detectedUsername: testResult.detectedUsername,
          errors: testResult.errors,
          warnings: testResult.warnings,
          testedAt: testResult.testedAt,
        },
      });

      // Audit logging
      if (testResult.success) {
        await this.audit.log({
          userId,
          actorType: 'USER',
          action: 'CONNECTION_TEST_SUCCESS',
          resource: 'server',
          resourceId: id,
          severity: 'INFO',
          description: `Connection test successful for server "${serverConfig.name}"`,
          metadata: {
            serverName: serverConfig.name,
            latency: testResult.latency,
            detectedOS: testResult.detectedOS,
          },
        });
      } else {
        await this.audit.log({
          userId,
          actorType: 'USER',
          action: 'CONNECTION_TEST_FAILED',
          resource: 'server',
          resourceId: id,
          severity: 'WARNING',
          description: `Connection test failed for server "${serverConfig.name}"`,
          metadata: {
            serverName: serverConfig.name,
            errors: testResult.errors,
          },
        });
      }

      // Check for host key issues
      if (testResult.details.hostKeyVerification.matched === false) {
        await this.audit.log({
          userId,
          actorType: 'USER',
          action: 'HOST_KEY_MISMATCH',
          resource: 'server',
          resourceId: id,
          severity: 'CRITICAL',
          description: `Host key mismatch detected for server "${serverConfig.name}" - possible MITM attack`,
          metadata: {
            serverName: serverConfig.name,
            expectedFingerprints: serverConfig.knownHostFingerprints,
            receivedFingerprint: testResult.details.hostKeyVerification.fingerprint,
          },
        });
      }

      // Check for TOFU acceptance
      if (
        serverConfig.hostKeyStrategy === 'TOFU' &&
        (!serverConfig.knownHostFingerprints || (serverConfig.knownHostFingerprints as any[]).length === 0)
      ) {
        await this.audit.log({
          userId,
          actorType: 'USER',
          action: 'HOST_KEY_TOFU_ACCEPT',
          resource: 'server',
          resourceId: id,
          severity: 'WARNING',
          description: `First connection to server "${serverConfig.name}" - host key accepted via TOFU`,
          metadata: {
            serverName: serverConfig.name,
            fingerprint: testResult.details.hostKeyVerification.fingerprint,
          },
        });

        // Update server with new host key
        await this.prisma.servers.update({
          where: { id },
          data: {
            knownHostFingerprints: [
              {
                keyType: testResult.details.hostKeyVerification.keyType,
                fingerprint: testResult.details.hostKeyVerification.fingerprint,
                firstSeenAt: new Date().toISOString(),
                lastVerifiedAt: new Date().toISOString(),
              },
            ],
          },
        });
      }

      // Clean up old test history (older than 10 days)
      await this.cleanupTestHistory(id);

      return testResult;
    } finally {
      // Release lock
      this.testLocks.delete(id);
    }
  }

  /**
   * Get test history for a server (last 10 days)
   */
  async getTestHistory(id: string, userId: string) {
    const server = await this.prisma.servers.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!server) {
      throw new ServerNotFoundException(id);
    }

    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    const history = await this.prisma.server_test_history.findMany({
      where: {
        serverId: id,
        testedAt: {
          gte: tenDaysAgo,
        },
      },
      orderBy: {
        testedAt: 'desc',
      },
      include: {
        triggeredBy: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
      },
    });

    return {
      serverId: id,
      serverName: server.name,
      total: history.length,
      history,
    };
  }

  /**
   * Clean up test history older than 10 days
   */
  private async cleanupTestHistory(serverId: string) {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    await this.prisma.server_test_history.deleteMany({
      where: {
        serverId,
        testedAt: {
          lt: tenDaysAgo,
        },
      },
    });
  }

  /**
   * Remove sensitive data from server object
   */
  private sanitizeServer(server: any) {
    const {
      encryptedPrivateKey,
      encryptedPassphrase,
      encryptedPassword,
      encryptedSudoPassword,
      ...sanitized
    } = server;

    // Indicate credential presence without exposing values
    return {
      ...sanitized,
      hasPrivateKey: !!encryptedPrivateKey,
      hasPassphrase: !!encryptedPassphrase,
      hasPassword: !!encryptedPassword,
      hasSudoPassword: !!encryptedSudoPassword,
    };
  }
}
