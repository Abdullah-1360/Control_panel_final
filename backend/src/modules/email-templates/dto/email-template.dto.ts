import { IsString, IsArray, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEmailTemplateDto {
  @ApiProperty({ example: 'custom_notification' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  key!: string;

  @ApiProperty({ example: 'Custom Notification' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'Important Notification for {{userName}}' })
  @IsString()
  subject!: string;

  @ApiProperty({ example: '<h1>Hello {{userName}}</h1><p>{{message}}</p>' })
  @IsString()
  htmlBody!: string;

  @ApiProperty({ example: 'Hello {{userName}}\n\n{{message}}' })
  @IsString()
  textBody!: string;

  @ApiProperty({ example: ['userName', 'message'] })
  @IsArray()
  @IsString({ each: true })
  variables!: string[];
}

export class UpdateEmailTemplateDto {
  @ApiProperty({ example: 'Custom Notification', required: false })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @ApiProperty({ example: 'Important Notification for {{userName}}', required: false })
  @IsString()
  subject?: string;

  @ApiProperty({ example: '<h1>Hello {{userName}}</h1><p>{{message}}</p>', required: false })
  @IsString()
  htmlBody?: string;

  @ApiProperty({ example: 'Hello {{userName}}\n\n{{message}}', required: false })
  @IsString()
  textBody?: string;

  @ApiProperty({ example: ['userName', 'message'], required: false })
  @IsArray()
  @IsString({ each: true })
  variables?: string[];
}
