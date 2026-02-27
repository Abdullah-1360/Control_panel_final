import { Injectable } from '@nestjs/common';
import { servers as Server } from '@prisma/client';
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
      files: ['wp-content', 'wp-includes'],
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

  /**
   * Detect tech stack using a single SSH connection with comprehensive bash script
   * This is much faster than multiple SSH connections
   */
  async detectTechStack(
    server: Server,
    path: string,
  ): Promise<{
    techStack: string;
    version?: string;
    confidence: number;
    metadata?: Record<string, any>;
  }> {
    console.log(`[TechStackDetector] Detecting tech stack for path: ${path}`);
    
    // Single SSH connection with comprehensive detection script
    const detectionScript = `
#!/bin/bash
PATH="${path}"

# Output format: KEY=VALUE
echo "PATH_EXISTS=$([ -d "$PATH" ] && echo "1" || echo "0")"

# WordPress detection
echo "WP_CONTENT=$([ -d "$PATH/wp-content" ] && echo "1" || echo "0")"
echo "WP_INCLUDES=$([ -d "$PATH/wp-includes" ] && echo "1" || echo "0")"
echo "WP_LOGIN=$([ -f "$PATH/wp-login.php" ] && echo "1" || echo "0")"
echo "WP_ADMIN=$([ -d "$PATH/wp-admin" ] && echo "1" || echo "0")"
if [ -f "$PATH/wp-includes/version.php" ]; then
  WP_VERSION=$(grep "wp_version = " "$PATH/wp-includes/version.php" 2>/dev/null | cut -d "'" -f 2)
  echo "WP_VERSION=$WP_VERSION"
fi

# Laravel detection
echo "LARAVEL_ARTISAN=$([ -f "$PATH/artisan" ] && echo "1" || echo "0")"
echo "COMPOSER_JSON=$([ -f "$PATH/composer.json" ] && echo "1" || echo "0")"
if [ -f "$PATH/composer.json" ]; then
  LARAVEL_FRAMEWORK=$(grep -o '"laravel/framework"' "$PATH/composer.json" 2>/dev/null | wc -l)
  echo "LARAVEL_FRAMEWORK=$LARAVEL_FRAMEWORK"
fi

# Node.js detection
echo "PACKAGE_JSON=$([ -f "$PATH/package.json" ] && echo "1" || echo "0")"
echo "NEXT_CONFIG=$([ -f "$PATH/next.config.js" ] && echo "1" || echo "0")"
if [ -f "$PATH/package.json" ]; then
  HAS_NEXT=$(grep -o '"next"' "$PATH/package.json" 2>/dev/null | wc -l)
  HAS_EXPRESS=$(grep -o '"express"' "$PATH/package.json" 2>/dev/null | wc -l)
  echo "HAS_NEXT=$HAS_NEXT"
  echo "HAS_EXPRESS=$HAS_EXPRESS"
  PACKAGE_NAME=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' "$PATH/package.json" 2>/dev/null | head -1 | cut -d'"' -f4)
  echo "PACKAGE_NAME=$PACKAGE_NAME"
fi

# PHP detection
echo "INDEX_PHP=$([ -f "$PATH/index.php" ] && echo "1" || echo "0")"
PHP_FILES=$(find "$PATH" -maxdepth 1 -name "*.php" 2>/dev/null | head -1)
echo "HAS_PHP_FILES=$([ -n "$PHP_FILES" ] && echo "1" || echo "0")"

# Version detection (if needed)
if command -v node &> /dev/null; then
  NODE_VERSION=$(cd "$PATH" && node --version 2>/dev/null | sed 's/v//')
  echo "NODE_VERSION=$NODE_VERSION"
fi

if command -v php &> /dev/null; then
  PHP_VERSION=$(php -v 2>/dev/null | head -n 1 | cut -d ' ' -f 2)
  echo "PHP_VERSION=$PHP_VERSION"
  
  if [ -f "$PATH/artisan" ]; then
    LARAVEL_VERSION=$(cd "$PATH" && php artisan --version 2>/dev/null | grep -oP 'Laravel Framework \K[\d.]+')
    echo "LARAVEL_VERSION=$LARAVEL_VERSION"
  fi
fi
`;

    try {
      const result = await this.sshExecutor.executeCommand(server.id, detectionScript);
      
      // Parse the output
      const data: Record<string, string> = {};
      result.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value !== undefined) {
          data[key.trim()] = value.trim();
        }
      });

      console.log(`[TechStackDetector] Detection data:`, data);

      // Check if path exists
      if (data.PATH_EXISTS !== '1') {
        console.log(`[TechStackDetector] Directory does not exist: ${path}`);
        return { techStack: 'UNKNOWN', confidence: 0 };
      }

      // WordPress detection (highest priority)
      if (data.WP_CONTENT === '1' && data.WP_INCLUDES === '1' && 
          (data.WP_LOGIN === '1' || data.WP_ADMIN === '1')) {
        console.log(`[TechStackDetector] Detected WORDPRESS with confidence 0.95`);
        return {
          techStack: 'WORDPRESS',
          version: data.WP_VERSION || undefined,
          confidence: 0.95,
          metadata: { 
            phpVersion: data.PHP_VERSION,
            detectionMethod: 'single-script' 
          },
        };
      }

      // Laravel detection
      if (data.LARAVEL_ARTISAN === '1' && data.COMPOSER_JSON === '1' && 
          parseInt(data.LARAVEL_FRAMEWORK || '0') > 0) {
        console.log(`[TechStackDetector] Detected LARAVEL with confidence 0.95`);
        return {
          techStack: 'LARAVEL',
          version: data.LARAVEL_VERSION || undefined,
          confidence: 0.95,
          metadata: { 
            phpVersion: data.PHP_VERSION,
            detectionMethod: 'single-script' 
          },
        };
      }

      // Next.js detection
      if (data.PACKAGE_JSON === '1' && 
          (data.NEXT_CONFIG === '1' || parseInt(data.HAS_NEXT || '0') > 0)) {
        console.log(`[TechStackDetector] Detected NEXTJS with confidence 0.95`);
        return {
          techStack: 'NEXTJS',
          version: data.NODE_VERSION || undefined,
          confidence: 0.95,
          metadata: { 
            packageName: data.PACKAGE_NAME,
            detectionMethod: 'single-script' 
          },
        };
      }

      // Express detection
      if (data.PACKAGE_JSON === '1' && parseInt(data.HAS_EXPRESS || '0') > 0 && 
          parseInt(data.HAS_NEXT || '0') === 0) {
        console.log(`[TechStackDetector] Detected EXPRESS with confidence 0.85`);
        return {
          techStack: 'EXPRESS',
          version: data.NODE_VERSION || undefined,
          confidence: 0.85,
          metadata: { 
            packageName: data.PACKAGE_NAME,
            detectionMethod: 'single-script' 
          },
        };
      }

      // Generic Node.js detection
      if (data.PACKAGE_JSON === '1' && 
          parseInt(data.HAS_NEXT || '0') === 0 && 
          parseInt(data.HAS_EXPRESS || '0') === 0) {
        console.log(`[TechStackDetector] Detected NODEJS with confidence 0.90`);
        return {
          techStack: 'NODEJS',
          version: data.NODE_VERSION || undefined,
          confidence: 0.90,
          metadata: { 
            packageName: data.PACKAGE_NAME,
            detectionMethod: 'single-script' 
          },
        };
      }

      // Generic PHP detection
      if (data.INDEX_PHP === '1' && data.COMPOSER_JSON === '1') {
        console.log(`[TechStackDetector] Detected PHP_GENERIC with confidence 0.70`);
        return {
          techStack: 'PHP_GENERIC',
          version: data.PHP_VERSION || undefined,
          confidence: 0.70,
          metadata: { detectionMethod: 'single-script' },
        };
      }

      // Fallback: Any PHP files
      if (data.HAS_PHP_FILES === '1') {
        console.log(`[TechStackDetector] Found PHP files, marking as PHP_GENERIC`);
        return {
          techStack: 'PHP_GENERIC',
          version: data.PHP_VERSION || undefined,
          confidence: 0.5,
          metadata: { detectionMethod: 'fallback' },
        };
      }

      console.log(`[TechStackDetector] No tech stack detected for path: ${path}`);
      return {
        techStack: 'UNKNOWN',
        confidence: 0,
      };
    } catch (error: any) {
      console.error(`[TechStackDetector] Detection script failed:`, error.message);
      return {
        techStack: 'UNKNOWN',
        confidence: 0,
        metadata: { error: error.message },
      };
    }
  }
}
