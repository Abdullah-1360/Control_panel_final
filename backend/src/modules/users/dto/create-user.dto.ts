import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsUUID } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    example: 'user@opsmanager.local',
    description: 'User email address',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'johndoe',
    description: 'Username (3-50 characters)',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username!: string;

  @ApiProperty({
    example: 'John',
    description: 'First name',
    required: false,
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Last name',
    required: false,
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({
    example: 'role-cuid',
    description: 'Role ID (CUID)',
  })
  @IsString()
  roleId!: string;
}
