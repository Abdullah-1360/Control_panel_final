import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Hash password using Argon2id
   * Target time: ~250ms
   */
  async hashPassword(password: string): Promise<string> {
    try {
      return await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536, // 64 MB
        timeCost: 3,
        parallelism: 4,
      });
    } catch (error) {
      this.logger.error('Password hashing failed', error);
      throw new BadRequestException('Failed to hash password');
    }
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch (error) {
      this.logger.error('Password verification failed', error);
      return false;
    }
  }

  /**
   * Validate password against policy
   * - Minimum 12 characters
   * - At least one uppercase letter
   * - At least one lowercase letter
   * - At least one number
   * - At least one special character
   */
  validatePasswordPolicy(password: string): void {
    if (password.length < 12) {
      throw new BadRequestException(
        'Password must be at least 12 characters long',
      );
    }

    if (!/[A-Z]/.test(password)) {
      throw new BadRequestException(
        'Password must contain at least one uppercase letter',
      );
    }

    if (!/[a-z]/.test(password)) {
      throw new BadRequestException(
        'Password must contain at least one lowercase letter',
      );
    }

    if (!/[0-9]/.test(password)) {
      throw new BadRequestException(
        'Password must contain at least one number',
      );
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      throw new BadRequestException(
        'Password must contain at least one special character',
      );
    }
  }

  /**
   * Check if password was used in history (last 3 passwords)
   */
  async checkPasswordHistory(
    userId: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { passwordHistory: true },
    });

    if (!user || !user.passwordHistory) {
      return;
    }

    // Check against last 3 passwords
    const history = user.passwordHistory.slice(0, 3);
    for (const oldHash of history) {
      const isMatch = await this.verifyPassword(oldHash, newPassword);
      if (isMatch) {
        throw new BadRequestException(
          'Password was used recently. Please choose a different password.',
        );
      }
    }
  }

  /**
   * Generate random password
   */
  generateRandomPassword(length: number = 16): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const all = uppercase + lowercase + numbers + special;

    let password = '';
    
    // Ensure at least one of each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += all[Math.floor(Math.random() * all.length)];
    }

    // Shuffle the password
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }

  /**
   * Generate password reset token
   */
  generateResetToken(): string {
    return require('crypto').randomBytes(32).toString('hex');
  }

  /**
   * Hash reset token for storage
   */
  hashResetToken(token: string): string {
    return require('crypto').createHash('sha256').update(token).digest('hex');
  }
}
