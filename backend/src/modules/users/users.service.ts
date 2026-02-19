import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { EmailService } from '@/modules/email/email.service';
import { PasswordService } from '@/modules/auth/password.service';
import { SessionService } from '@/modules/auth/session.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private emailService: EmailService,
    private passwordService: PasswordService,
    private sessionService: SessionService,
  ) {}

  /**
   * Create a new user
   */
  async create(
    createUserDto: CreateUserDto,
    creatorId: string,
    ipAddress: string,
    userAgent: string,
  ) {
    // Check if email already exists
    const existingEmail = await this.prisma.users.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    // Check if username already exists
    const existingUsername = await this.prisma.users.findUnique({
      where: { username: createUserDto.username },
    });

    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    // Check if role exists
    const role = await this.prisma.roles.findUnique({
      where: { id: createUserDto.roleId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Generate temporary password
    const temporaryPassword = this.passwordService.generateRandomPassword(16);
    const passwordHash = await this.passwordService.hashPassword(temporaryPassword);

    // Create user
    const user = await this.prisma.users.create({
      data: {
        email: createUserDto.email,
        username: createUserDto.username,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        passwordHash,
        roleId: createUserDto.roleId,
        mustChangePassword: true,
      },
      include: {
        roles: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
    });

    // Send welcome email
    await this.emailService.sendWelcomeEmail(
      user.email,
      user.username,
      temporaryPassword,
    );

    // Log user creation
    await this.auditService.log({
      userId: creatorId,
      actorType: 'USER',
      action: 'USER_CREATED',
      resource: 'USER',
      resourceId: user.id,
      description: `User created: ${user.email}`,
      ipAddress,
      userAgent,
      severity: 'INFO',
      metadata: {
        email: user.email,
        username: user.username,
        roleId: user.roleId,
      },
    });

    // Return user with temporary password (only shown once)
    return {
      ...user,
      temporaryPassword,
      passwordHash: undefined,
      passwordHistory: undefined,
      mfaSecret: undefined,
      mfaBackupCodes: undefined,
    };
  }

  /**
   * Find all users with pagination
   */
  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    roleId?: string;
    isActive?: boolean;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.search) {
      where.OR = [
        { email: { contains: params.search, mode: 'insensitive' } },
        { username: { contains: params.search, mode: 'insensitive' } },
        { firstName: { contains: params.search, mode: 'insensitive' } },
        { lastName: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (params.roleId) {
      where.roleId = params.roleId;
    }

    if (params.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    const [users, total] = await Promise.all([
      this.prisma.users.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          isActive: true,
          isLocked: true,
          mfaEnabled: true,
          lastLoginAt: true,
          createdAt: true,
          roles: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
        },
      }),
      this.prisma.users.count({ where }),
    ]);

    return {
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find user by ID
   */
  async findOne(id: string) {
    const user = await this.prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        isActive: true,
        isLocked: true,
        lockoutUntil: true,
        mfaEnabled: true,
        lastLoginAt: true,
        lastLoginIp: true,
        passwordChangedAt: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
        roles: {
          select: {
            id: true,
            name: true,
            displayName: true,
            description: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Update user
   */
  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    updaterId: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const user = await this.prisma.users.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If changing role, verify it exists
    if (updateUserDto.roleId) {
      const role = await this.prisma.roles.findUnique({
        where: { id: updateUserDto.roleId },
      });

      if (!role) {
        throw new NotFoundException('Role not found');
      }

      // Invalidate user sessions if role changed
      if (updateUserDto.roleId !== user.roleId) {
        await this.sessionService.invalidateAllUserSessions(id);
      }
    }

    const updatedUser = await this.prisma.users.update({
      where: { id },
      data: updateUserDto,
      include: {
        roles: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
    });

    // Log update
    await this.auditService.log({
      userId: updaterId,
      actorType: 'USER',
      action: 'USER_UPDATED',
      resource: 'USER',
      resourceId: id,
      description: `User updated: ${updatedUser.email}`,
      ipAddress,
      userAgent,
      severity: 'INFO',
      metadata: updateUserDto,
    });

    return {
      ...updatedUser,
      passwordHash: undefined,
      passwordHistory: undefined,
      mfaSecret: undefined,
      mfaBackupCodes: undefined,
    };
  }

  /**
   * Delete user (soft delete)
   */
  async remove(
    id: string,
    deleterId: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const user = await this.prisma.users.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Cannot delete yourself
    if (id === deleterId) {
      throw new BadRequestException('Cannot delete your own account');
    }

    // Soft delete
    await this.prisma.users.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    // Invalidate all sessions
    await this.sessionService.invalidateAllUserSessions(id);

    // Log deletion
    await this.auditService.log({
      userId: deleterId,
      actorType: 'USER',
      action: 'USER_DELETED',
      resource: 'USER',
      resourceId: id,
      description: `User deleted: ${user.email}`,
      ipAddress,
      userAgent,
      severity: 'WARNING',
    });

    return { message: 'User deleted successfully' };
  }

  /**
   * Activate user
   */
  async activate(
    id: string,
    activatorId: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const user = await this.prisma.users.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.users.update({
      where: { id },
      data: { isActive: true },
    });

    await this.auditService.log({
      userId: activatorId,
      actorType: 'USER',
      action: 'USER_ACTIVATED',
      resource: 'USER',
      resourceId: id,
      description: `User activated: ${user.email}`,
      ipAddress,
      userAgent,
      severity: 'INFO',
    });

    return { message: 'User activated successfully' };
  }

  /**
   * Deactivate user
   */
  async deactivate(
    id: string,
    deactivatorId: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const user = await this.prisma.users.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Cannot deactivate yourself
    if (id === deactivatorId) {
      throw new BadRequestException('Cannot deactivate your own account');
    }

    await this.prisma.users.update({
      where: { id },
      data: { isActive: false },
    });

    // Invalidate all sessions
    await this.sessionService.invalidateAllUserSessions(id);

    await this.auditService.log({
      userId: deactivatorId,
      actorType: 'USER',
      action: 'USER_DEACTIVATED',
      resource: 'USER',
      resourceId: id,
      description: `User deactivated: ${user.email}`,
      ipAddress,
      userAgent,
      severity: 'WARNING',
    });

    return { message: 'User deactivated successfully' };
  }

  /**
   * Unlock user account
   */
  async unlock(
    id: string,
    unlockerId: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const user = await this.prisma.users.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.users.update({
      where: { id },
      data: {
        isLocked: false,
        lockoutUntil: null,
        failedLoginAttempts: 0,
      },
    });

    await this.auditService.log({
      userId: unlockerId,
      actorType: 'USER',
      action: 'USER_UNLOCKED',
      resource: 'USER',
      resourceId: id,
      description: `User unlocked: ${user.email}`,
      ipAddress,
      userAgent,
      severity: 'INFO',
    });

    return { message: 'User unlocked successfully' };
  }

  /**
   * Assign role to user
   */
  async assignRole(
    userId: string,
    roleId: string,
    actorId: string,
    ipAddress: string,
    userAgent: string,
  ) {
    // Get the user
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      include: {
        roles: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.deletedAt) {
      throw new BadRequestException('Cannot assign role to deleted user');
    }

    // Get the actor (person making the change)
    const actor = await this.prisma.users.findUnique({
      where: { id: actorId },
      include: {
        roles: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!actor) {
      throw new UnauthorizedException('Actor not found');
    }

    // Check if actor is trying to change their own role
    if (userId === actorId) {
      throw new BadRequestException('Cannot change your own role');
    }

    // Get the new role
    const newRole = await this.prisma.roles.findUnique({
      where: { id: roleId },
    });

    if (!newRole) {
      throw new NotFoundException('Role not found');
    }

    // Check if actor is ADMIN trying to assign SUPER_ADMIN role
    if (actor.roles.name === 'ADMIN' && newRole.name === 'SUPER_ADMIN') {
      throw new ForbiddenException('ADMIN cannot assign SUPER_ADMIN role');
    }

    // Check if trying to change the last SUPER_ADMIN
    if (user.roles.name === 'SUPER_ADMIN' && newRole.name !== 'SUPER_ADMIN') {
      const superAdminCount = await this.prisma.users.count({
        where: {
          roles: {
            name: 'SUPER_ADMIN',
          },
          isActive: true,
          deletedAt: null,
        },
      });

      if (superAdminCount <= 1) {
        throw new BadRequestException(
          'Cannot change role of the last active SUPER_ADMIN',
        );
      }
    }

    const oldRoleName = user.roles.displayName;

    // Update user role
    const updatedUser = await this.prisma.users.update({
      where: { id: userId },
      data: {
        roleId,
      },
      include: {
        roles: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
    });

    // Invalidate all user sessions (force re-login with new permissions)
    await this.sessionService.invalidateAllUserSessions(userId);

    // Send email notification
    await this.emailService.sendEmail({
      to: user.email,
      subject: 'Your Role Has Been Changed',
      html: `
        <h2>Role Change Notification</h2>
        <p>Hello ${user.username},</p>
        <p>Your role has been changed from <strong>${oldRoleName}</strong> to <strong>${newRole.displayName}</strong>.</p>
        <p>You will need to log in again for the changes to take effect.</p>
        <hr>
        <p><small>If you did not expect this change, please contact your administrator immediately.</small></p>
      `,
      text: `
        Role Change Notification
        
        Hello ${user.username},
        
        Your role has been changed from ${oldRoleName} to ${newRole.displayName}.
        You will need to log in again for the changes to take effect.
        
        If you did not expect this change, please contact your administrator immediately.
      `,
    });

    // Log role assignment
    await this.auditService.log({
      userId: actorId,
      actorType: 'USER',
      action: 'user.roles.assign',
      resource: 'user',
      resourceId: userId,
      description: `Role changed from ${oldRoleName} to ${newRole.displayName}`,
      metadata: {
        oldRoleId: user.roleId,
        newRoleId: roleId,
        oldRoleName,
        newRoleName: newRole.displayName,
      },
      ipAddress,
      userAgent,
      severity: 'HIGH',
    });

    this.logger.log(
      `User ${userId} role changed from ${oldRoleName} to ${newRole.displayName} by ${actorId}`,
    );

    // Return updated user without sensitive data
    const { passwordHash, mfaSecret, mfaBackupCodes, passwordHistory, ...userWithoutSensitiveData } = updatedUser;

    return {
      message: 'Role assigned successfully. User must log in again.',
      user: userWithoutSensitiveData,
    };
  }
}
