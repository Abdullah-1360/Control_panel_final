import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { EncryptionService } from '@/modules/encryption/encryption.service';

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);

  constructor(
    private configService: ConfigService,
    private encryptionService: EncryptionService,
  ) {}

  /**
   * Generate TOTP secret and QR code
   */
  async generateMfaSecret(email: string): Promise<{
    secret: string;
    qrCode: string;
    backupCodes: string[];
  }> {
    try {
      // Generate TOTP secret
      const secret = speakeasy.generateSecret({
        name: `OpsManager (${email})`,
        issuer: 'OpsManager',
        length: 32,
      });

      // Generate QR code
      const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

      // Generate backup codes
      const backupCodes = this.generateBackupCodes(10);

      return {
        secret: secret.base32,
        qrCode,
        backupCodes,
      };
    } catch (error) {
      this.logger.error('Failed to generate MFA secret:', error);
      throw new BadRequestException('Failed to generate MFA secret');
    }
  }

  /**
   * Verify TOTP code
   */
  verifyTotpCode(secret: string, code: string): boolean {
    try {
      return speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token: code,
        window: 1, // Allow 1 step before/after for clock skew
      });
    } catch (error) {
      this.logger.error('TOTP verification failed:', error);
      return false;
    }
  }

  /**
   * Verify backup code
   */
  async verifyBackupCode(encryptedCodes: string[], code: string): Promise<{
    valid: boolean;
    remainingCodes?: string[];
  }> {
    try {
      // Decrypt backup codes
      const decryptedCodes = await this.encryptionService.decryptArray(encryptedCodes);

      // Check if code exists
      const index = decryptedCodes.indexOf(code);
      if (index === -1) {
        return { valid: false };
      }

      // Remove used code
      decryptedCodes.splice(index, 1);

      // Re-encrypt remaining codes
      const remainingCodes = await this.encryptionService.encryptArray(decryptedCodes);

      return {
        valid: true,
        remainingCodes,
      };
    } catch (error) {
      this.logger.error('Backup code verification failed:', error);
      return { valid: false };
    }
  }

  /**
   * Generate backup codes
   */
  generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    
    for (let i = 0; i < count; i++) {
      // Generate 8-digit backup code
      const code = crypto.randomInt(10000000, 99999999).toString();
      codes.push(code);
    }

    return codes;
  }

  /**
   * Encrypt MFA secret
   */
  async encryptSecret(secret: string): Promise<string> {
    return await this.encryptionService.encrypt(secret);
  }

  /**
   * Decrypt MFA secret
   */
  async decryptSecret(encryptedSecret: string): Promise<string> {
    return await this.encryptionService.decrypt(encryptedSecret);
  }

  /**
   * Encrypt backup codes
   */
  async encryptBackupCodes(codes: string[]): Promise<string[]> {
    return await this.encryptionService.encryptArray(codes);
  }

  /**
   * Decrypt backup codes
   */
  async decryptBackupCodes(encryptedCodes: string[]): Promise<string[]> {
    return await this.encryptionService.decryptArray(encryptedCodes);
  }
}
