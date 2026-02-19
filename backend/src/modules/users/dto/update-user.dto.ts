import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateUserDto {
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
    required: false,
  })
  @IsOptional()
  @IsString()
  roleId?: string;

  @ApiProperty({
    example: true,
    description: 'Is user active',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AssignRoleDto {
  @ApiProperty({
    example: 'role-cuid',
    description: 'Role ID to assign (CUID)',
  })
  @IsString()
  roleId!: string;
}
