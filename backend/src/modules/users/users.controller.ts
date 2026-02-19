import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Put,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator';
import { IpAddress } from '@/common/decorators/ip-address.decorator';
import { UserAgent } from '@/common/decorators/user-agent.decorator';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions('users', 'create')
  @ApiOperation({ summary: 'Create a new user' })
  async create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() user: JwtPayload,
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ) {
    return this.usersService.create(createUserDto, user.sub, ipAddress, userAgent);
  }

  @Get()
  @RequirePermissions('users', 'read')
  @ApiOperation({ summary: 'Get all users with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'roleId', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('roleId') roleId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.usersService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      roleId,
      isActive: isActive ? isActive === 'true' : undefined,
    });
  }

  @Get(':id')
  @RequirePermissions('users', 'read')
  @ApiOperation({ summary: 'Get user by ID' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('users', 'update')
  @ApiOperation({ summary: 'Update user' })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: JwtPayload,
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ) {
    return this.usersService.update(id, updateUserDto, user.sub, ipAddress, userAgent);
  }

  @Delete(':id')
  @RequirePermissions('users', 'delete')
  @ApiOperation({ summary: 'Delete user (soft delete)' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ) {
    return this.usersService.remove(id, user.sub, ipAddress, userAgent);
  }

  @Put(':id/activate')
  @RequirePermissions('users', 'update')
  @ApiOperation({ summary: 'Activate user' })
  async activate(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ) {
    return this.usersService.activate(id, user.sub, ipAddress, userAgent);
  }

  @Put(':id/deactivate')
  @RequirePermissions('users', 'update')
  @ApiOperation({ summary: 'Deactivate user' })
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ) {
    return this.usersService.deactivate(id, user.sub, ipAddress, userAgent);
  }

  @Put(':id/unlock')
  @RequirePermissions('users', 'update')
  @ApiOperation({ summary: 'Unlock user account' })
  async unlock(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ) {
    return this.usersService.unlock(id, user.sub, ipAddress, userAgent);
  }

  @Put(':id/role')
  @RequirePermissions('users', 'update')
  @ApiOperation({ summary: 'Assign role to user' })
  async assignRole(
    @Param('id') id: string,
    @Body() body: { roleId: string },
    @CurrentUser() user: JwtPayload,
    @IpAddress() ipAddress: string,
    @UserAgent() userAgent: string,
  ) {
    return this.usersService.assignRole(id, body.roleId, user.sub, ipAddress, userAgent);
  }
}
