import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, PermissionRequirement } from '@/common/decorators/permissions.decorator';
import { JwtPayload } from '@/common/decorators/current-user.decorator';
import { AuditService } from '@/modules/audit/audit.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private reflector: Reflector,
    private auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<PermissionRequirement>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermission) {
      // No permission requirement, allow access
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user has the required permission
    const hasPermission = this.checkPermission(
      user.permissions,
      requiredPermission.resource,
      requiredPermission.action,
    );

    if (!hasPermission) {
      // Log permission denial
      await this.auditService.log({
        userId: user.sub,
        actorType: 'USER',
        action: 'PERMISSION_DENIED',
        resource: requiredPermission.resource,
        description: `Permission denied: ${requiredPermission.resource}.${requiredPermission.action}`,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        severity: 'WARNING',
        metadata: {
          requiredPermission: `${requiredPermission.resource}.${requiredPermission.action}`,
          userPermissions: user.permissions,
        },
      });

      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredPermission.resource}.${requiredPermission.action}`,
      );
    }

    return true;
  }

  private checkPermission(
    userPermissions: string[],
    resource: string,
    action: string,
  ): boolean {
    // Check for wildcard permissions
    if (userPermissions.includes('*.*')) {
      return true; // SUPER_ADMIN has all permissions
    }

    // Check for resource wildcard (e.g., "users.*")
    if (userPermissions.includes(`${resource}.*`)) {
      return true;
    }

    // Check for action wildcard (e.g., "*.read")
    if (userPermissions.includes(`*.${action}`)) {
      return true;
    }

    // Check for exact permission match
    if (userPermissions.includes(`${resource}.${action}`)) {
      return true;
    }

    return false;
  }
}
