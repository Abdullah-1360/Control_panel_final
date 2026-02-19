import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
  Res,
  Req,
  HttpException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator';
import { IpAddress } from '@/common/decorators/ip-address.decorator';
import { UserAgent } from '@/common/decorators/user-agent.decorator';
import {
  LoginDto,
  LoginResponseDto,
} from './dto/login.dto';
import {
  ChangePasswordDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
} from './dto/password.dto';
import {
  SetupMfaResponseDto,
  VerifyMfaDto,
  DisableMfaDto,
} from './dto/mfa.dto';
import {
  RefreshTokenDto,
  RefreshTokenResponseDto,
} from './dto/refresh.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 423, description: 'Account locked' })
  async login(
    @Body() loginDto: LoginDto,
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(
      loginDto.email,
      loginDto.password,
      loginDto.mfaCode,
      ipAddress,
      userAgent,
    );

    // Set refresh token in HTTP-only cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    // Return access token and user (don't expose refresh token)
    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'User logout' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(
    @CurrentUser() user: JwtPayload,
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Get refresh token from cookie
    const refreshToken = req.cookies?.refreshToken;
    
    if (refreshToken) {
      await this.authService.logout(refreshToken, user.sub, ipAddress, userAgent);
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    return { message: 'Logged out successfully' };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed',
    type: RefreshTokenResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Get refresh token from HTTP-only cookie
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new HttpException('Refresh token not found', HttpStatus.UNAUTHORIZED);
    }

    const result = await this.authService.refreshTokens(
      refreshToken,
      ipAddress,
      userAgent,
    );

    // Set new refresh token in HTTP-only cookie (token rotation)
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    // Return only access token (refresh token is in cookie)
    return {
      accessToken: result.accessToken,
    };
  }

  @Post('password/change')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Change password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid password' })
  @ApiResponse({ status: 401, description: 'Current password incorrect' })
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() changePasswordDto: ChangePasswordDto,
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ) {
    return this.authService.changePassword(
      user.sub,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
      changePasswordDto.confirmPassword,
      ipAddress,
      userAgent,
    );
  }

  @Public()
  @Post('password/reset/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 attempts per 5 minutes
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent if account exists',
  })
  async requestPasswordReset(
    @Body() requestDto: RequestPasswordResetDto,
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ) {
    return this.authService.requestPasswordReset(
      requestDto.email,
      ipAddress,
      userAgent,
    );
  }

  @Public()
  @Post('password/reset/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(
    @Body() resetDto: ResetPasswordDto,
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ) {
    return this.authService.resetPassword(
      resetDto.token,
      resetDto.newPassword,
      resetDto.confirmPassword,
      ipAddress,
      userAgent,
    );
  }

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Setup MFA (generate secret and QR code)' })
  @ApiResponse({
    status: 200,
    description: 'MFA setup initiated',
    type: SetupMfaResponseDto,
  })
  @ApiResponse({ status: 409, description: 'MFA already enabled' })
  async setupMfa(@CurrentUser() user: JwtPayload) {
    return this.authService.setupMfa(user.sub);
  }

  @Post('mfa/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Verify MFA code and enable MFA' })
  @ApiResponse({ status: 200, description: 'MFA enabled successfully' })
  @ApiResponse({ status: 400, description: 'Invalid MFA code' })
  async verifyMfa(
    @CurrentUser() user: JwtPayload,
    @Body() verifyDto: VerifyMfaDto,
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ) {
    return this.authService.verifyAndEnableMfa(
      user.sub,
      verifyDto.code,
      ipAddress,
      userAgent,
    );
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Disable MFA' })
  @ApiResponse({ status: 200, description: 'MFA disabled successfully' })
  @ApiResponse({ status: 400, description: 'Invalid credentials' })
  async disableMfa(
    @CurrentUser() user: JwtPayload,
    @Body() disableDto: DisableMfaDto,
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ) {
    return this.authService.disableMfa(
      user.sub,
      disableDto.password,
      disableDto.code,
      ipAddress,
      userAgent,
    );
  }

  @Post('mfa/backup-codes/regenerate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Regenerate MFA backup codes' })
  @ApiResponse({
    status: 200,
    description: 'Backup codes regenerated',
    schema: {
      properties: {
        backupCodes: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  })
  async regenerateBackupCodes(
    @CurrentUser() user: JwtPayload,
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ) {
    return this.authService.regenerateBackupCodes(user.sub, ipAddress, userAgent);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user info' })
  @ApiResponse({ status: 200, description: 'Current user information' })
  async getCurrentUser(@CurrentUser() user: JwtPayload) {
    // Fetch full user details including role
    const fullUser = await this.authService.getUserById(user.sub);
    return { user: fullUser };
  }
}
