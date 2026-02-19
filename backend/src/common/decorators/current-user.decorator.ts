import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtPayload {
  sub: string; // user ID
  email: string;
  username: string;
  roleId: string;
  permissions: string[];
  iat?: number;
  exp?: number;
  [key: string]: any; // Index signature for jose compatibility
}

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    return data ? user?.[data] : user;
  },
);
