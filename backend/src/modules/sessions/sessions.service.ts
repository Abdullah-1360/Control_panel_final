import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { SessionService } from '@/modules/auth/session.service';
import { AuditService } from '@/modules/audit/audit.service';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private prisma: PrismaService,
    private sessionService: SessionService,
    private auditService: AuditService,
  ) {}

  /**
   * Get all sessions for current user
   */
  async getUserSessions(userId: string) {
    return this.sessionService.getUserSessions(userId);
  }

  /**
   * Get all sessions (SUPER_ADMIN only)
   */
  async getAllSessions(params: {
    page?: number;
    limit?: number;
    userId?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;

    const where = params.userId ? { userId: params.userId } : {};

    const [sessions, total] = await Promise.all([
      this.prisma.sessions.findMany({
        where,
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
        orderBy: { lastActivityAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.sessions.count({ where }),
    ]);

    return {
      data: sessions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Revoke a session
   */
  async revokeSession(
    sessionId: string,
    userId: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const session = await this.prisma.sessions.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Users can only revoke their own sessions
    if (session.userId !== userId) {
      throw new ForbiddenException('Cannot revoke another user\'s session');
    }

    await this.sessionService.revokeSession(sessionId, userId);

    await this.auditService.log({
      userId,
      actorType: 'USER',
      action: 'SESSION_REVOKED',
      resource: 'SESSION',
      resourceId: sessionId,
      description: 'Session revoked',
      ipAddress,
      userAgent,
      severity: 'INFO',
    });

    return { message: 'Session revoked successfully' };
  }
}
