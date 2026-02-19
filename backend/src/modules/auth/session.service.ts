import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import Redis from 'ioredis';
import * as crypto from 'crypto';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private redis: Redis;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const redisUrl = this.configService.get('REDIS_URL') || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl);
  }

  /**
   * Create session in both Redis (cache) and PostgreSQL (persistence)
   */
  async createSession(
    userId: string,
    refreshToken: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<string> {
    const sessionId = crypto.randomUUID();
    const tokenHash = this.hashToken(refreshToken);
    const accessTokenHash = this.hashToken(crypto.randomBytes(32).toString('hex'));
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    // Store in PostgreSQL
    await this.prisma.sessions.create({
      data: {
        id: sessionId,
        userId,
        token: accessTokenHash,
        refreshToken: tokenHash,
        ipAddress,
        userAgent,
        expiresAt,
        lastActivityAt: now, // Set initial last activity
      },
    });

    // Store in Redis for fast lookup
    await this.redis.setex(
      `session:${tokenHash}`,
      7 * 24 * 60 * 60, // 7 days in seconds
      JSON.stringify({
        sessionId,
        userId,
        ipAddress,
        userAgent,
        expiresAt: expiresAt.toISOString(),
      }),
    );

    this.logger.log(`Session created for user ${userId}`);
    return sessionId;
  }

  /**
   * Validate session by refresh token
   */
  async validateSession(refreshToken: string): Promise<{
    sessionId: string;
    userId: string;
  } | null> {
    const tokenHash = this.hashToken(refreshToken);

    // Try Redis first (fast)
    const cached = await this.redis.get(`session:${tokenHash}`);
    if (cached) {
      const session = JSON.parse(cached);
      
      // Check expiration
      if (new Date(session.expiresAt) < new Date()) {
        await this.invalidateSession(refreshToken);
        return null;
      }

      // Update last activity in PostgreSQL (async, don't wait)
      this.prisma.sessions
        .updateMany({
          where: { refreshToken: tokenHash },
          data: { lastActivityAt: new Date() },
        })
        .catch((error) => {
          this.logger.error('Failed to update session activity', error);
        });

      return {
        sessionId: session.sessionId,
        userId: session.userId,
      };
    }

    // Fallback to PostgreSQL
    const session = await this.prisma.sessions.findUnique({
      where: { refreshToken: tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
      },
    });

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    // Update last activity
    await this.prisma.sessions.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() },
    });

    return {
      sessionId: session.id,
      userId: session.userId,
    };
  }

  /**
   * Invalidate session (logout)
   */
  async invalidateSession(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);

    // Remove from Redis
    await this.redis.del(`session:${tokenHash}`);

    // Delete from PostgreSQL
    await this.prisma.sessions.deleteMany({
      where: { refreshToken: tokenHash },
    });

    this.logger.log('Session invalidated');
  }

  /**
   * Invalidate all sessions for a user
   */
  async invalidateAllUserSessions(userId: string): Promise<void> {
    // Get all sessions for user
    const sessions = await this.prisma.sessions.findMany({
      where: { userId },
      select: { refreshToken: true },
    });

    // Remove from Redis
    const pipeline = this.redis.pipeline();
    for (const session of sessions) {
      pipeline.del(`session:${session.refreshToken}`);
    }
    await pipeline.exec();

    // Delete all from PostgreSQL
    await this.prisma.sessions.deleteMany({
      where: { userId },
    });

    this.logger.log(`All sessions invalidated for user ${userId}`);
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string) {
    return this.prisma.sessions.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
        lastActivityAt: true,
      },
      orderBy: { lastActivityAt: 'desc' },
    });
  }

  /**
   * Revoke specific session
   */
  async revokeSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.prisma.sessions.findFirst({
      where: { id: sessionId, userId },
      select: { refreshToken: true },
    });

    if (!session) {
      return;
    }

    // Remove from Redis
    await this.redis.del(`session:${session.refreshToken}`);

    // Delete from PostgreSQL
    await this.prisma.sessions.delete({
      where: { id: sessionId },
    });

    this.logger.log(`Session ${sessionId} revoked`);
  }

  /**
   * Clean up expired sessions (run periodically)
   */
  async cleanupExpiredSessions(): Promise<void> {
    const deleted = await this.prisma.sessions.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    this.logger.log(`Cleaned up ${deleted.count} expired sessions`);
  }

  /**
   * Hash token for storage
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
