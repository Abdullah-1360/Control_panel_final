import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get all roles
   */
  async findAll() {
    return this.prisma.roles.findMany({
      include: {
        permissions: true,
        _count: {
          select: { users: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get role by ID
   */
  async findOne(id: string) {
    return this.prisma.roles.findUnique({
      where: { id },
      include: {
        permissions: true,
        _count: {
          select: { users: true },
        },
      },
    });
  }

  /**
   * Get role permissions
   */
  async getPermissions(id: string) {
    const role = await this.prisma.roles.findUnique({
      where: { id },
      include: {
        permissions: true,
      },
    });

    return role?.permissions || [];
  }
}
