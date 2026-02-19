import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sodium from 'libsodium-wrappers';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private masterKey!: Uint8Array;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // Ensure libsodium is fully initialized
    await sodium.ready;
    
    const masterKeyHex = this.configService.get<string>('SODIUM_MASTER_KEY');
    
    if (!masterKeyHex) {
      throw new Error('SODIUM_MASTER_KEY environment variable is required');
    }

    try {
      // Decode hex master key using Buffer
      this.masterKey = new Uint8Array(Buffer.from(masterKeyHex, 'hex'));
      
      // Verify key length (32 bytes for XSalsa20-Poly1305)
      if (this.masterKey.length !== 32) {
        throw new Error(`Master key must be 32 bytes (got ${this.masterKey.length} bytes)`);
      }

      this.logger.log('Encryption service initialized successfully');
    } catch (error: any) {
      this.logger.error('Failed to initialize encryption service:', error);
      throw new Error(`Invalid SODIUM_MASTER_KEY. Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))". Error: ${error?.message || 'Unknown'}`);
    }
  }

  /**
   * Encrypt a string value
   */
  async encrypt(plaintext: string): Promise<string> {
    if (!plaintext) {
      return plaintext;
    }

    try {
      // Ensure sodium is ready
      await sodium.ready;
      
      // Generate random nonce (24 bytes for XSalsa20-Poly1305)
      const NONCE_BYTES = 24;
      const nonce = crypto.randomBytes(NONCE_BYTES);
      const plaintextBytes = Buffer.from(plaintext, 'utf8');
      const ciphertext = Buffer.from(sodium.crypto_secretbox_easy(plaintextBytes, nonce, this.masterKey));

      // Combine nonce + ciphertext and encode as base64
      const combined = Buffer.concat([nonce, ciphertext]);

      return combined.toString('base64');
    } catch (error: any) {
      this.logger.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt a string value
   */
  async decrypt(ciphertext: string): Promise<string> {
    if (!ciphertext) {
      return ciphertext;
    }

    try {
      // Ensure sodium is ready
      await sodium.ready;
      
      const NONCE_BYTES = 24;
      const combined = Buffer.from(ciphertext, 'base64');
      
      const nonce = combined.subarray(0, NONCE_BYTES);
      const cipher = combined.subarray(NONCE_BYTES);

      const decrypted = sodium.crypto_secretbox_open_easy(cipher, nonce, this.masterKey);
      
      return Buffer.from(decrypted).toString('utf8');
    } catch (error: any) {
      this.logger.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt an array of strings
   */
  async encryptArray(plaintexts: string[]): Promise<string[]> {
    const results: string[] = [];
    for (const text of plaintexts) {
      results.push(await this.encrypt(text));
    }
    return results;
  }

  /**
   * Decrypt an array of strings
   */
  async decryptArray(ciphertexts: string[]): Promise<string[]> {
    const results: string[] = [];
    for (const text of ciphertexts) {
      results.push(await this.decrypt(text));
    }
    return results;
  }

  /**
   * Generate a random encryption key (for testing/setup)
   */
  static generateKey(): string {
    return Buffer.from(sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES)).toString('hex');
  }
}
