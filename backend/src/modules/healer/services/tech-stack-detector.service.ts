import { Injectable } from '@nestjs/common';
import { Server } from '@prisma/client';
import { SSHExecutorService } from './ssh-executor.service';

export interface DetectionSignature {
  files?: string[];
  confidence: number;
  versionCommand?: string;
  versionRegex?: RegExp;
  versionFile?: string;
  additionalChecks?: (result: any) => boolean;
}

@Injectable()
export class TechStackDetectorService {
  private readonly DETECTION_SIGNATURES: Record<string, DetectionSignature> = {
    WORDPRESS: {
      files: ['wp-config.php', 'wp-content', 'wp-includes'],
      confidence: 0.95,
      versionFile: 'wp-includes/version.php',
      versionRegex: /\$wp_version = '([^']+)'/,
    },
    NODEJS: {
      files: ['package.json'],
      confidence: 0.90,
      versionCommand: 'node --version',
    },
    LARAVEL: {
      files: ['artisan', 'composer.json'],
      confidence: 0.95,
      versionCommand: 'php artisan --version',
      versionRegex: /Laravel Framework (\d+\.\d+\.\d+)/,
    },
    NEXTJS: {
      files: ['package.json', 'next.config.js'],
      confidence: 0.95,
    },
    EXPRESS: {
      files: ['package.json'],
      confidence: 0.85,
    },
    PHP_GENERIC: {
      files: ['index.php', 'composer.json'],
      confidence: 0.70,
    },
  };

  constructor(private readonly sshExecutor: SSHExecutorService) {}

  async detectTechStack(
    server: Server,
    path: string,
  ): Promise<{
    techStack: string;
    version?: string;
    confidence: number;
    metadata?: Record<string, any>;
  }> {
    const results: Array<{
      techStack: string;
      version?: string;
      confidence: number;
      metadata?: Record<string, any>;
    }> = [];

    // Check each signature
    for (const [stack, signature] of Object.entries(this.DETECTION_SIGNATURES)) {
      const result = await this.checkSignature(server, path, stack, signature);
      if (result.confidence > 0) {
        results.push(result);
      }
    }

    // Sort by confidence and return highest
    results.sort((a, b) => b.confidence - a.confidence);

    if (results.length === 0) {
      return {
        techStack: 'UNKNOWN',
        confidence: 0,
      };
    }

    return results[0];
  }

  private async checkSignature(
    server: Server,
    path: string,
    techStack: string,
    signature: DetectionSignature,
  ): Promise<{
    techStack: string;
    version?: string;
    confidence: number;
    metadata?: Record<string, any>;
  }> {
    try {
      // Check for required files
      if (signature.files) {
        const filesExist = await this.checkFilesExist(server, path, signature.files);
        if (!filesExist) {
          return { techStack, confidence: 0 };
        }
      }

      // Get version if possible
      let version: string | undefined;
      const metadata: Record<string, any> = {};

      if (signature.versionCommand) {
        try {
          const versionOutput = await this.sshExecutor.executeCommand(
            server,
            `cd ${path} && ${signature.versionCommand}`,
          );
          
          if (signature.versionRegex) {
            const match = versionOutput.match(signature.versionRegex);
            version = match ? match[1] : undefined;
          } else {
            version = versionOutput.trim().replace(/^v/, '');
          }
        } catch (error) {
          // Version detection failed, but file exists
        }
      }

      if (signature.versionFile) {
        try {
          const fileContent = await this.sshExecutor.executeCommand(
            server,
            `cat ${path}/${signature.versionFile}`,
          );
          
          if (signature.versionRegex) {
            const match = fileContent.match(signature.versionRegex);
            version = match ? match[1] : undefined;
          }
        } catch (error) {
          // Version file not found
        }
      }

      // Special checks for specific tech stacks
      if (techStack === 'NODEJS' || techStack === 'NEXTJS' || techStack === 'EXPRESS') {
        const packageJson = await this.readPackageJson(server, path);
        if (packageJson) {
          metadata.packageName = packageJson.name;
          
          // Distinguish between Next.js, Express, and generic Node.js
          if (techStack === 'NEXTJS' && !packageJson.dependencies?.next) {
            return { techStack, confidence: 0 };
          }
          
          if (techStack === 'EXPRESS') {
            if (!packageJson.dependencies?.express || packageJson.dependencies?.next) {
              return { techStack, confidence: 0 };
            }
          }
          
          if (techStack === 'NODEJS') {
            // Generic Node.js - only if not Next.js or Express
            if (packageJson.dependencies?.next || packageJson.dependencies?.express) {
              return { techStack, confidence: 0 };
            }
          }
        }
      }

      if (techStack === 'LARAVEL') {
        const composerJson = await this.readComposerJson(server, path);
        if (composerJson && !composerJson.require?.['laravel/framework']) {
          return { techStack, confidence: 0 };
        }
      }

      return {
        techStack,
        version,
        confidence: signature.confidence,
        metadata,
      };
    } catch (error) {
      return { techStack, confidence: 0 };
    }
  }

  private async checkFilesExist(
    server: Server,
    path: string,
    files: string[],
  ): Promise<boolean> {
    try {
      const checkCommands = files.map(file => `[ -e "${path}/${file}" ]`).join(' && ');
      await this.sshExecutor.executeCommand(server, checkCommands);
      return true;
    } catch (error) {
      return false;
    }
  }

  private async readPackageJson(
    server: Server,
    path: string,
  ): Promise<any | null> {
    try {
      const content = await this.sshExecutor.executeCommand(
        server,
        `cat ${path}/package.json`,
      );
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  private async readComposerJson(
    server: Server,
    path: string,
  ): Promise<any | null> {
    try {
      const content = await this.sshExecutor.executeCommand(
        server,
        `cat ${path}/composer.json`,
      );
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }
}
