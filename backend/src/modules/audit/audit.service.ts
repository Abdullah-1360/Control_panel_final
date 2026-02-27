import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ActorType, Severity } from '@prisma/client';

export interface CreateAuditLogDto {
  userId?: string;
  actorType: ActorType;
  actorId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  severity: Severity;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create an audit log entry
   */
  async log(data: CreateAuditLogDto): Promise<void> {
    try {
      await this.prisma.audit_logs.create({
        data: {
          userId: data.userId,
          actorType: data.actorType,
          actorId: data.actorId,
          action: data.action,
          resource: data.resource,
          resourceId: data.resourceId,
          description: data.description,
          metadata: data.metadata || {},
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          severity: data.severity,
        },
      });
    } catch (error) {
      // Don't throw - audit logging should never break the main flow
      this.logger.error('Failed to create audit log:', error);
    }
  }

  /**
   * Get audit logs with pagination and filtering
   */
  async findAll(params: {
    page?: number;
    limit?: number;
    userId?: string;
    action?: string;
    resource?: string;
    severity?: Severity;
    startDate?: Date;
    endDate?: Date;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.userId) where.userId = params.userId;
    if (params.action) where.action = { contains: params.action, mode: 'insensitive' };
    if (params.resource) where.resource = { contains: params.resource, mode: 'insensitive' };
    if (params.severity) where.severity = params.severity;
    
    if (params.startDate || params.endDate) {
      where.timestamp = {};
      if (params.startDate) where.timestamp.gte = params.startDate;
      if (params.endDate) where.timestamp.lte = params.endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.audit_logs.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          users: {
            select: {
              id: true,
              email: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.audit_logs.count({ where }),
    ]);

    // Transform 'users' to 'user' for frontend compatibility
    const transformedLogs = logs.map((log) => ({
      ...log,
      user: log.users,
      users: undefined,
    }));

    return {
      data: transformedLogs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get security-related audit logs
   */
  async findSecurityLogs(params: { page?: number; limit?: number }) {
    const securityActions = [
      'LOGIN',
      'LOGOUT',
      'LOGIN_FAILED',
      'PASSWORD_CHANGE',
      'PASSWORD_RESET',
      'MFA_ENABLED',
      'MFA_DISABLED',
      'ACCOUNT_LOCKED',
      'ACCOUNT_UNLOCKED',
      'ROLE_CHANGED',
      'PERMISSION_DENIED',
    ];

    return this.findAll({
      ...params,
      action: undefined, // Override action filter
    }).then((result) => ({
      ...result,
      data: result.data.filter((log: any) =>
        securityActions.some((action) => log.action.includes(action)),
      ),
    }));
  }
}
