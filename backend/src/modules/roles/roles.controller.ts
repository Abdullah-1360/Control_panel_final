import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';

@ApiTags('Roles')
@ApiBearerAuth('JWT-auth')
@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('roles', 'read')
  @ApiOperation({ summary: 'Get all roles' })
  async findAll() {
    const roles = await this.rolesService.findAll();
    return {
      data: roles.map(role => ({
        id: role.id,
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        userCount: role._count.users,
      })),
    };
  }

  @Get(':id')
  @RequirePermissions('roles', 'read')
  @ApiOperation({ summary: 'Get role by ID' })
  async findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Get(':id/permissions')
  @RequirePermissions('roles', 'read')
  @ApiOperation({ summary: 'Get role permissions' })
  async getPermissions(@Param('id') id: string) {
    return this.rolesService.getPermissions(id);
  }
}
