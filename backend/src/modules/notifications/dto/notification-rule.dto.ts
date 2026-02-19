import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsBoolean,
  IsInt,
  IsOptional,
  IsObject,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { NotificationTrigger, RecipientType } from '@prisma/client';

export class CreateNotificationRuleDto {
  @ApiProperty({ example: 'Welcome Email for New Users' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'Send welcome email when a new user is created', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ enum: NotificationTrigger, example: 'USER_CREATED' })
  @IsEnum(NotificationTrigger)
  trigger!: NotificationTrigger;

  @ApiProperty({ example: 'welcome_email' })
  @IsString()
  templateKey!: string;

  @ApiProperty({ enum: RecipientType, example: 'AFFECTED_USER' })
  @IsEnum(RecipientType)
  recipientType!: RecipientType;

  @ApiProperty({
    example: { userIds: [], roleIds: ['role-id'], emails: ['admin@example.com'] },
  })
  @IsObject()
  recipientValue!: {
    userIds?: string[];
    roleIds?: string[];
    emails?: string[];
  };

  @ApiProperty({
    example: { roleFilter: ['ADMIN'], timeFilter: {} },
    required: false,
  })
  @IsOptional()
  @IsObject()
  conditions?: Record<string, any>;

  @ApiProperty({ example: 5, minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  priority!: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  isActive!: boolean;
}

export class UpdateNotificationRuleDto {
  @ApiProperty({ example: 'Welcome Email for New Users', required: false })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @ApiProperty({ example: 'Send welcome email when a new user is created', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ enum: NotificationTrigger, example: 'USER_CREATED', required: false })
  @IsOptional()
  @IsEnum(NotificationTrigger)
  trigger?: NotificationTrigger;

  @ApiProperty({ example: 'welcome_email', required: false })
  @IsOptional()
  @IsString()
  templateKey?: string;

  @ApiProperty({ enum: RecipientType, example: 'AFFECTED_USER', required: false })
  @IsOptional()
  @IsEnum(RecipientType)
  recipientType?: RecipientType;

  @ApiProperty({
    example: { userIds: [], roleIds: ['role-id'], emails: ['admin@example.com'] },
    required: false,
  })
  @IsOptional()
  @IsObject()
  recipientValue?: {
    userIds?: string[];
    roleIds?: string[];
    emails?: string[];
  };

  @ApiProperty({
    example: { roleFilter: ['ADMIN'], timeFilter: {} },
    required: false,
  })
  @IsOptional()
  @IsObject()
  conditions?: Record<string, any>;

  @ApiProperty({ example: 5, minimum: 1, maximum: 10, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  priority?: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SendBulkEmailDto {
  @ApiProperty({ example: 'welcome_email' })
  @IsString()
  templateKey!: string;

  @ApiProperty({ example: ['user@example.com', 'admin@example.com'] })
  @IsString({ each: true })
  recipients!: string[];

  @ApiProperty({ example: { userName: 'John', appName: 'OpsManager' } })
  @IsObject()
  variables!: Record<string, string>;
}
