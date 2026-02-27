import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { EmailService } from '@/modules/email/email.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { MfaService } from './mfa.service';
import * as jose from 'jose';
import { JwtPayload } from '@/common/decorators/current-user.decorator';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private jwtSecret: Uint8Array;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private auditService: AuditService,
    private emailService: EmailService,
    private passwordService: PasswordService,
    private sessionService: SessionService,
    private mfaService: MfaService,
  ) {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }
    this.jwtSecret = new TextEncoder().encode(secret);
  }

  /**
   * User login
   */
  async login(
    email: string,
    password: string,
    mfaCode: string | undefined,
    ipAddress: string,
    userAgent: string,
  ) {
    try {
      // Find user
      const user = await this.prisma.users.findUnique({
        where: { email },
        include: {
          roles: {
            include: {
              permissions: true,
            },
          },
        },
      });

      if (!user) {
        await this.auditService.log({
          actorType: 'USER',
          action: 'LOGIN_FAILED',
          resource: 'AUTH',
          description: `Login failed: User not found (${email})`,
          ipAddress,
          userAgent,
          severity: 'WARNING',
        });
        throw new UnauthorizedException('Invalid credentials');
      }

      // Check if user is active
      if (!user.isActive) {
        await this.auditService.log({
          userId: user.id,
          actorType: 'USER',
          action: 'LOGIN_FAILED',
          resource: 'AUTH',
          description: 'Login failed: Account inactive',
          ipAddress,
          userAgent,
          severity: 'WARNING',
        });
        throw new UnauthorizedException('Account is inactive');
      }

      // Check if user is locked
      if (user.isLocked && user.lockoutUntil && user.lockoutUntil > new Date()) {
        await this.auditService.log({
          userId: user.id,
          actorType: 'USER',
          action: 'LOGIN_FAILED',
          resource: 'AUTH',
          description: 'Login failed: Account locked',
          ipAddress,
          userAgent,
          severity: 'HIGH',
        });
        throw new UnauthorizedException(
          `Account is locked until ${user.lockoutUntil.toISOString()}`,
        );
      }

      // Verify password
      const isPasswordValid = await this.passwordService.verifyPassword(
        user.passwordHash,
        password,
      );

      if (!isPasswordValid) {
        // Increment failed attempts
        const failedAttempts = user.failedLoginAttempts + 1;
        const updates: any = { failedLoginAttempts: failedAttempts };

        // Lock account after 5 failed attempts
        if (failedAttempts >= 5) {
          const lockoutUntil = new Date();
          lockoutUntil.setMinutes(lockoutUntil.getMinutes() + 15);
          
          updates.isLocked = true;
          updates.lockoutUntil = lockoutUntil;

          await this.emailService.sendAccountLockedEmail(user.email, user.username);

          await this.auditService.log({
            userId: user.id,
            actorType: 'SYSTEM',
            action: 'ACCOUNT_LOCKED',
            resource: 'USER',
            resourceId: user.id,
            description: 'Account locked due to failed login attempts',
            ipAddress,
            userAgent,
            severity: 'HIGH',
          });
        }

        await this.prisma.users.update({
          where: { id: user.id },
          data: updates,
        });

        await this.auditService.log({
          userId: user.id,
          actorType: 'USER',
          action: 'LOGIN_FAILED',
          resource: 'AUTH',
          description: `Login failed: Invalid password (attempt ${failedAttempts}/5)`,
          ipAddress,
          userAgent,
          severity: 'WARNING',
        });

        throw new UnauthorizedException('Invalid credentials');
      }

      // Check MFA
      if (user.mfaEnabled) {
        if (!mfaCode) {
          throw new BadRequestException('MFA code is required');
        }

        // Decrypt MFA secret
        const decryptedSecret = await this.mfaService.decryptSecret(user.mfaSecret!);

        // Try TOTP first
        const isTotpValid = this.mfaService.verifyTotpCode(decryptedSecret, mfaCode);

        if (!isTotpValid) {
          // Try backup code
          const backupResult = await this.mfaService.verifyBackupCode(
            user.mfaBackupCodes,
            mfaCode,
          );

          if (!backupResult.valid) {
            await this.auditService.log({
              userId: user.id,
              actorType: 'USER',
              action: 'MFA_FAILED',
              resource: 'AUTH',
              description: 'MFA verification failed',
              ipAddress,
              userAgent,
              severity: 'WARNING',
            });
            throw new UnauthorizedException('Invalid MFA code');
          }

          // Update backup codes
          await this.prisma.users.update({
            where: { id: user.id },
            data: { mfaBackupCodes: backupResult.remainingCodes },
          });

          await this.auditService.log({
            userId: user.id,
            actorType: 'USER',
            action: 'BACKUP_CODE_USED',
            resource: 'AUTH',
            description: `Backup code used. Remaining: ${backupResult.remainingCodes?.length || 0}`,
            ipAddress,
            userAgent,
            severity: 'INFO',
          });

          // Warn if running low on backup codes
          if (backupResult.remainingCodes && backupResult.remainingCodes.length < 3) {
            this.logger.warn(
              `User ${user.email} has only ${backupResult.remainingCodes.length} backup codes remaining`,
            );
          }
        }
      }

      // Reset failed attempts and unlock
      await this.prisma.users.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          isLocked: false,
          lockoutUntil: null,
          lastLoginAt: new Date(),
          lastLoginIp: ipAddress,
        },
      });

      // Generate tokens
      const { accessToken, refreshToken } = await this.generateTokens(user);

      // Create session
      await this.sessionService.createSession(
        user.id,
        refreshToken,
        ipAddress,
        userAgent,
      );

      // Log successful login
      await this.auditService.log({
        userId: user.id,
        actorType: 'USER',
        action: 'LOGIN',
        resource: 'AUTH',
        description: 'User logged in successfully',
        ipAddress,
        userAgent,
        severity: 'INFO',
      });

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: {
            id: user.roles.id,
            name: user.roles.name,
            displayName: user.roles.displayName,
          },
          mfaEnabled: user.mfaEnabled,
          mustChangePassword: user.mustChangePassword,
        },
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error('Login error:', error);
      throw new UnauthorizedException('Login failed');
    }
  }

  /**
   * Logout
   */
  async logout(refreshToken: string, userId: string, ipAddress: string, userAgent: string) {
    try {
      await this.sessionService.invalidateSession(refreshToken);

      await this.auditService.log({
        userId,
        actorType: 'USER',
        action: 'LOGOUT',
        resource: 'AUTH',
        description: 'User logged out',
        ipAddress,
        userAgent,
        severity: 'INFO',
      });

      return { message: 'Logged out successfully' };
    } catch (error) {
      this.logger.error('Logout error:', error);
      throw error;
    }
  }

  /**
   * Refresh tokens
   */
  async refreshTokens(refreshToken: string, ipAddress: string, userAgent: string) {
    try {
      // Validate session
      const session = await this.sessionService.validateSession(refreshToken);

      if (!session) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Get user
      const user = await this.prisma.users.findUnique({
        where: { id: session.userId },
        include: {
          roles: {
            include: {
              permissions: true,
            },
          },
        },
      });

      if (!user || !user.isActive) {
        await this.sessionService.invalidateSession(refreshToken);
        throw new UnauthorizedException('Account is inactive');
      }

      // IMPORTANT: Invalidate old refresh token immediately (single-use token rotation)
      await this.sessionService.invalidateSession(refreshToken);

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      // Create new session with new refresh token
      await this.sessionService.createSession(
        user.id,
        tokens.refreshToken,
        ipAddress,
        userAgent,
      );

      // Log token refresh
      await this.auditService.log({
        userId: user.id,
        actorType: 'USER',
        action: 'TOKEN_REFRESHED',
        resource: 'AUTH',
        description: 'Access token refreshed successfully',
        ipAddress,
        userAgent,
        severity: 'INFO',
      });

      return tokens;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Token refresh error:', error);
      throw new UnauthorizedException('Failed to refresh token');
    }
  }

  /**
   * Generate JWT tokens
   */
  private async generateTokens(user: any): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const permissions = user.roles?.permissions?.map(
      (p: any) => `${p.resource}.${p.action}`,
    ) || [];

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      roleId: user.roleId,
      permissions,
    };

    const accessTokenExpiry = this.configService.get<string>('JWT_ACCESS_EXPIRY', '24h');
    const refreshTokenExpiry = this.configService.get<string>('JWT_REFRESH_EXPIRY', '7d');

    const accessToken = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(accessTokenExpiry)
      .sign(this.jwtSecret);

    const refreshToken = await new jose.SignJWT({ sub: user.id })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(refreshTokenExpiry)
      .sign(this.jwtSecret);

    return { accessToken, refreshToken };
  }

  /**
   * Change password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
    ipAddress: string,
    userAgent: string,
  ) {
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // Validate password policy
    this.passwordService.validatePasswordPolicy(newPassword);

    const user = await this.prisma.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isValid = await this.passwordService.verifyPassword(
      user.passwordHash,
      currentPassword,
    );

    if (!isValid) {
      await this.auditService.log({
        userId,
        actorType: 'USER',
        action: 'PASSWORD_CHANGE_FAILED',
        resource: 'USER',
        resourceId: userId,
        description: 'Password change failed: Invalid current password',
        ipAddress,
        userAgent,
        severity: 'WARNING',
      });
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Check password history
    for (const oldHash of user.passwordHistory) {
      const isReused = await this.passwordService.verifyPassword(oldHash, newPassword);
      if (isReused) {
        throw new BadRequestException('Cannot reuse recent passwords');
      }
    }

    // Hash new password
    const newHash = await this.passwordService.hashPassword(newPassword);

    // Update password history (keep last 3)
    const passwordHistory = [user.passwordHash, ...user.passwordHistory].slice(0, 3);

    // Update user
    await this.prisma.users.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        passwordHistory,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
      },
    });

    // Invalidate all other sessions
    await this.sessionService.invalidateAllUserSessions(userId);

    // Send email notification
    await this.emailService.sendPasswordChangedEmail(user.email, user.username);

    // Log password change
    await this.auditService.log({
      userId,
      actorType: 'USER',
      action: 'PASSWORD_CHANGED',
      resource: 'USER',
      resourceId: userId,
      description: 'Password changed successfully',
      ipAddress,
      userAgent,
      severity: 'INFO',
    });

    return { message: 'Password changed successfully' };
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string, ipAddress: string, userAgent: string) {
    // Always return success to prevent email enumeration
    const user = await this.prisma.users.findUnique({ where: { email } });

    if (user) {
      // Generate reset token
      const resetToken = this.passwordService.generateResetToken();
      const tokenHash = this.passwordService.hashResetToken(resetToken);

      // Store token
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

      await this.prisma.password_reset_tokens.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      // Send email
      await this.emailService.sendPasswordResetEmail(user.email, resetToken);

      // Log request
      await this.auditService.log({
        userId: user.id,
        actorType: 'USER',
        action: 'PASSWORD_RESET_REQUESTED',
        resource: 'USER',
        resourceId: user.id,
        description: 'Password reset requested',
        ipAddress,
        userAgent,
        severity: 'INFO',
      });
    }

    return {
      message: 'If the email exists, a password reset link has been sent',
    };
  }

  /**
   * Reset password with token
   */
  async resetPassword(
    token: string,
    newPassword: string,
    confirmPassword: string,
    ipAddress: string,
    userAgent: string,
  ) {
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // Validate password policy
    this.passwordService.validatePasswordPolicy(newPassword);

    // Hash token
    const tokenHash = this.passwordService.hashResetToken(token);

    // Find token
    const resetToken = await this.prisma.password_reset_tokens.findUnique({
      where: { tokenHash },
      include: { users: true },
    });

    if (!resetToken || resetToken.used || !resetToken.users) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    const user = resetToken.users;

    // Hash new password
    const newHash = await this.passwordService.hashPassword(newPassword);

    // Update user
    await this.prisma.users.update({
      where: { id: resetToken.userId },
      data: {
        passwordHash: newHash,
        passwordChangedAt: new Date(),
        passwordHistory: [], // Clear history on reset
      },
    });

    // Mark token as used
    await this.prisma.password_reset_tokens.update({
      where: { id: resetToken.id },
      data: { used: true },
    });

    // Invalidate all sessions
    await this.sessionService.invalidateAllUserSessions(resetToken.userId);

    // Send confirmation email
    await this.emailService.sendPasswordChangedEmail(
      user.email,
      user.username,
    );

    // Log password reset
    await this.auditService.log({
      userId: resetToken.userId,
      actorType: 'USER',
      action: 'PASSWORD_RESET',
      resource: 'USER',
      resourceId: resetToken.userId,
      description: 'Password reset completed',
      ipAddress,
      userAgent,
      severity: 'INFO',
    });

    return { message: 'Password reset successfully' };
  }

  /**
   * Setup MFA
   */
  async setupMfa(userId: string) {
    const user = await this.prisma.users.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.mfaEnabled) {
      throw new ConflictException('MFA is already enabled');
    }

    // Generate MFA secret and backup codes
    const { secret, qrCode, backupCodes } = await this.mfaService.generateMfaSecret(
      user.email,
    );

    // Encrypt and store (but don't enable yet)
    const encryptedSecret = await this.mfaService.encryptSecret(secret);
    const encryptedBackupCodes = await this.mfaService.encryptBackupCodes(backupCodes);

    await this.prisma.users.update({
      where: { id: userId },
      data: {
        mfaSecret: encryptedSecret,
        mfaBackupCodes: encryptedBackupCodes,
      },
    });

    return {
      secret,
      qrCode,
      backupCodes,
    };
  }

  /**
   * Verify and enable MFA
   */
  async verifyAndEnableMfa(
    userId: string,
    code: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const user = await this.prisma.users.findUnique({ where: { id: userId } });

    if (!user || !user.mfaSecret) {
      throw new BadRequestException('MFA setup not initiated');
    }

    if (user.mfaEnabled) {
      throw new ConflictException('MFA is already enabled');
    }

    // Decrypt secret
    const decryptedSecret = await this.mfaService.decryptSecret(user.mfaSecret);

    // Verify code
    const isValid = this.mfaService.verifyTotpCode(decryptedSecret, code);

    if (!isValid) {
      throw new BadRequestException('Invalid MFA code');
    }

    // Enable MFA
    await this.prisma.users.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    // Send email notification
    await this.emailService.sendMFAEnabledEmail(user.email, user.username);

    // Log MFA enabled
    await this.auditService.log({
      userId,
      actorType: 'USER',
      action: 'MFA_ENABLED',
      resource: 'USER',
      resourceId: userId,
      description: 'MFA enabled successfully',
      ipAddress,
      userAgent,
      severity: 'INFO',
    });

    return { message: 'MFA enabled successfully' };
  }

  /**
   * Disable MFA
   */
  async disableMfa(
    userId: string,
    password: string,
    code: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const user = await this.prisma.users.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled');
    }

    // Verify password
    const isPasswordValid = await this.passwordService.verifyPassword(
      user.passwordHash,
      password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    // Decrypt secret
    const decryptedSecret = await this.mfaService.decryptSecret(user.mfaSecret!);

    // Try TOTP first
    let isValid = this.mfaService.verifyTotpCode(decryptedSecret, code);

    // Try backup code if TOTP fails
    if (!isValid) {
      const backupResult = await this.mfaService.verifyBackupCode(user.mfaBackupCodes, code);
      isValid = backupResult.valid;
    }

    if (!isValid) {
      throw new UnauthorizedException('Invalid MFA code');
    }

    // Disable MFA
    await this.prisma.users.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: [],
      },
    });

    // Log MFA disabled
    await this.auditService.log({
      userId,
      actorType: 'USER',
      action: 'MFA_DISABLED',
      resource: 'USER',
      resourceId: userId,
      description: 'MFA disabled',
      ipAddress,
      userAgent,
      severity: 'WARNING',
    });

    return { message: 'MFA disabled successfully' };
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(userId: string, ipAddress: string, userAgent: string) {
    const user = await this.prisma.users.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled');
    }

    // Generate new backup codes
    const backupCodes = this.mfaService.generateBackupCodes(10);
    const encryptedBackupCodes = await this.mfaService.encryptBackupCodes(backupCodes);

    // Update user
    await this.prisma.users.update({
      where: { id: userId },
      data: { mfaBackupCodes: encryptedBackupCodes },
    });

    // Log regeneration
    await this.auditService.log({
      userId,
      actorType: 'USER',
      action: 'BACKUP_CODES_REGENERATED',
      resource: 'USER',
      resourceId: userId,
      description: 'Backup codes regenerated',
      ipAddress,
      userAgent,
      severity: 'INFO',
    });

    return { backupCodes };
  }

  /**
   * Get user by ID with full details including role
   */
  async getUserById(userId: string) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        mfaEnabled: true,
        mustChangePassword: true,
        roles: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Transform 'roles' to 'role' for frontend compatibility
    return {
      ...user,
      role: user.roles,
      roles: undefined,
    };
  }
}
