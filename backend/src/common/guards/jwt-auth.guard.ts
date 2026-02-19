import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as jose from 'jose';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { JwtPayload } from '@/common/decorators/current-user.decorator';

// Extend Express Request type to include user
declare module 'express' {
  interface Request {
    user?: JwtPayload;
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private jwtSecret: Uint8Array;

  constructor(
    private reflector: Reflector,
    private configService: ConfigService,
  ) {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }
    this.jwtSecret = new TextEncoder().encode(secret);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Access token is required');
    }

    try {
      // Verify JWT token
      const { payload } = await jose.jwtVerify(token, this.jwtSecret, {
        algorithms: ['HS256'],
      });

      // Attach user to request
      request.user = payload as JwtPayload;

      return true;
    } catch (error: any) {
      this.logger.warn(`JWT verification failed: ${error?.message || 'Unknown error'}`);
      
      if (error?.code === 'ERR_JWT_EXPIRED') {
        throw new UnauthorizedException('Access token has expired');
      }
      
      throw new UnauthorizedException('Invalid access token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
