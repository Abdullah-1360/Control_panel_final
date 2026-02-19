import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'OldPassword123!',
    description: 'Current password',
  })
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiProperty({
    example: 'NewPassword123!',
    description: 'New password (min 12 chars, must include uppercase, lowercase, number, special char)',
  })
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/, {
    message: 'Password must contain uppercase, lowercase, number, and special character',
  })
  newPassword!: string;

  @ApiProperty({
    example: 'NewPassword123!',
    description: 'Confirm new password',
  })
  @IsString()
  confirmPassword!: string;
}

export class RequestPasswordResetDto {
  @ApiProperty({
    example: 'user@opsmanager.local',
    description: 'Email address for password reset',
  })
  @IsString()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    example: 'abc123def456...',
    description: 'Password reset token from email',
  })
  @IsString()
  token!: string;

  @ApiProperty({
    example: 'NewPassword123!',
    description: 'New password',
  })
  @IsString()
  @MinLength(12)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/, {
    message: 'Password must contain uppercase, lowercase, number, and special character',
  })
  newPassword!: string;

  @ApiProperty({
    example: 'NewPassword123!',
    description: 'Confirm new password',
  })
  @IsString()
  confirmPassword!: string;
}
