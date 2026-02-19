import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const IpAddress = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    
    // Check for IP in various headers (for proxy/load balancer scenarios)
    const ip =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (request.headers['x-real-ip'] as string) ||
      request.socket.remoteAddress ||
      'unknown';

    return ip;
  },
);
