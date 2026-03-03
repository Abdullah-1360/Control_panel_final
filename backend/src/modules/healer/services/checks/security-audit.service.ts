import { Injectable, Logger } from '@nestjs/common';
import { SSHExecutorService } from '../ssh-executor.service';
import {
  IDiagnosisCheckService,
  CheckResult,
  CheckStatus,
  CheckPriority,
} from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';

/**
 * Security Audit Service
 * Audits file permissions, user roles, SSL, security headers, and vulnerabilities
 */
@Injectable()
export class SecurityAuditService implements IDiagnosisCheckService {
  private readonly logger = new Logger(SecurityAuditService.name);

  // Critical file permissions
  private readonly CRITICAL_FILES = {
    'wp-config.php': '640',
    '.htaccess': '644',
    'wp-content': '755',
    'wp-includes': '755',
    'wp-admin': '755',
  };

  // Security headers to check
  private readonly SECURITY_HEADERS = [
    'X-Frame-Options',
    'X-Content-Type-Options',
    'X-XSS-Protection',
    'Strict-Transport-Security',
    'Content-Security-Policy',
    'Referrer-Policy',
  ];

  constructor(private readonly sshExecutor: SSHExecutorService) {}

  async check(
    serverId: string,
    sitePath: string,
    domain: string,
    config?: any,
  ): Promise<CheckResult> {
    const startTime = Date.now();
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    try {
      this.logger.log(`Starting security audit for ${domain}`);

      // 1. Check file permissions
      const permissionIssues = await this.checkFilePermissions(serverId, sitePath);
      if (permissionIssues.length > 0) {
        issues.push(`${permissionIssues.length} file permission issues`);
        score -= Math.min(30, permissionIssues.length * 5);
        recommendations.push('Fix file permissions to recommended values');
        recommendations.push('Run: chmod 640 wp-config.php');
      }

      // 2. Check for debug mode enabled
      const debugEnabled = await this.checkDebugMode(serverId, sitePath);
      if (debugEnabled) {
        issues.push('WP_DEBUG is enabled in production');
        score -= 15;
        recommendations.push('Disable WP_DEBUG in wp-config.php');
      }

      // 3. Check SSL certificate
      const sslIssues = await this.checkSSL(domain);
      if (sslIssues.length > 0) {
        issues.push(`SSL issues: ${sslIssues.join(', ')}`);
        score -= Math.min(25, sslIssues.length * 10);
        recommendations.push('Fix SSL certificate issues');
        recommendations.push('Ensure HTTPS is properly configured');
      }

      // 4. Check security headers
      const missingHeaders = await this.checkSecurityHeaders(domain);
      if (missingHeaders.length > 0) {
        issues.push(`${missingHeaders.length} security headers missing`);
        score -= Math.min(20, missingHeaders.length * 3);
        recommendations.push('Add missing security headers to .htaccess or server config');
      }

      // 5. Check for exposed sensitive files
      const exposedFiles = await this.checkExposedFiles(serverId, sitePath);
      if (exposedFiles.length > 0) {
        issues.push(`${exposedFiles.length} sensitive files exposed`);
        score -= Math.min(25, exposedFiles.length * 5);
        recommendations.push('Block access to sensitive files via .htaccess');
      }

      // 6. Check database prefix
      const weakDbPrefix = await this.checkDatabasePrefix(serverId, sitePath);
      if (weakDbPrefix) {
        issues.push('Using default database prefix (wp_)');
        score -= 10;
        recommendations.push('Change database prefix for better security');
      }

      // 7. Check for file editing enabled
      const fileEditingEnabled = await this.checkFileEditing(serverId, sitePath);
      if (fileEditingEnabled) {
        issues.push('File editing enabled in WordPress admin');
        score -= 10;
        recommendations.push('Disable file editing: define(\'DISALLOW_FILE_EDIT\', true)');
      }

      // 8. Check for XML-RPC enabled
      const xmlRpcEnabled = await this.checkXmlRpc(serverId, sitePath);
      if (xmlRpcEnabled) {
        issues.push('XML-RPC is enabled (DDoS risk)');
        score -= 10;
        recommendations.push('Disable XML-RPC if not needed');
      }

      // 9. PHASE 1 - LAYER 2: Verify core file checksums
      const checksumResults = await this.verifyCoreFileChecksums(serverId, sitePath);
      if (checksumResults.modifiedFiles.length > 0) {
        issues.push(`${checksumResults.modifiedFiles.length} core files modified`);
        score -= Math.min(40, checksumResults.modifiedFiles.length * 5);
        recommendations.push('Restore modified core files from official WordPress release');
        recommendations.push('Run: wp core download --force --skip-content');
      }
      if (checksumResults.missingFiles.length > 0) {
        issues.push(`${checksumResults.missingFiles.length} core files missing`);
        score -= Math.min(30, checksumResults.missingFiles.length * 3);
        recommendations.push('Reinstall WordPress core files');
      }

      // 10. PHASE 1 - LAYER 2: Scan for malware signatures
      const malwareScan = await this.scanForMalwareSignatures(serverId, sitePath);
      if (malwareScan.suspiciousFiles.length > 0) {
        const highConfidence = malwareScan.suspiciousFiles.filter(f => f.confidence === 'HIGH').length;
        issues.push(`${malwareScan.suspiciousFiles.length} suspicious files detected (${highConfidence} high confidence)`);
        score -= Math.min(50, highConfidence * 10 + (malwareScan.suspiciousFiles.length - highConfidence) * 3);
        recommendations.push('Quarantine and review suspicious files immediately');
        recommendations.push('Scan with professional malware scanner (Wordfence, Sucuri)');
      }

      // 11. PHASE 1 - LAYER 2: Validate .htaccess security
      const htaccessSecurity = await this.validateHtaccessSecurity(serverId, sitePath);
      if (!htaccessSecurity.isClean) {
        const critical = htaccessSecurity.issues.filter(i => i.severity === 'CRITICAL').length;
        issues.push(`${htaccessSecurity.issues.length} .htaccess security issues (${critical} critical)`);
        score -= Math.min(40, critical * 15 + (htaccessSecurity.issues.length - critical) * 5);
        recommendations.push('Review and clean .htaccess file immediately');
        recommendations.push('Backup current .htaccess before making changes');
      }

      // Determine status
      let status: CheckStatus;
      if (score >= 85) {
        status = CheckStatus.PASS;
      } else if (score >= 65) {
        status = CheckStatus.WARNING;
      } else {
        status = CheckStatus.FAIL;
      }

      const message =
        issues.length === 0
          ? 'Security audit passed - no critical issues found'
          : `Security issues detected: ${issues.join(', ')}`;

      return {
        checkType: this.getCheckType(),
        status,
        score: Math.max(0, score),
        message,
        details: {
          permissionIssues,
          debugEnabled,
          sslIssues,
          missingHeaders,
          exposedFiles,
          weakDbPrefix,
          fileEditingEnabled,
          xmlRpcEnabled,
          // Phase 1 - Layer 2 additions
          checksumResults,
          malwareScan,
          htaccessSecurity,
          issues,
        },
        recommendations,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Security audit failed: ${err.message}`);

      return {
        checkType: this.getCheckType(),
        status: CheckStatus.ERROR,
        score: 0,
        message: `Security audit failed: ${err.message}`,
        details: { error: err.message },
        recommendations: ['Retry security audit', 'Check server connectivity'],
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Check file permissions
   */
  private async checkFilePermissions(
    serverId: string,
    sitePath: string,
  ): Promise<any[]> {
    const issues: any[] = [];

    try {
      for (const [file, expectedPerm] of Object.entries(this.CRITICAL_FILES)) {
        const filePath = file.startsWith('/') ? file : `${sitePath}/${file}`;
        const command = `stat -c '%a' ${filePath} 2>/dev/null || echo "NOT_FOUND"`;

        const result = await this.sshExecutor.executeCommand(serverId, command, 10000);
        const actualPerm = result.trim();

        if (actualPerm === 'NOT_FOUND') {
          continue; // File doesn't exist, skip
        }

        if (actualPerm !== expectedPerm) {
          issues.push({
            file,
            expected: expectedPerm,
            actual: actualPerm,
            severity: this.getPermissionSeverity(file, actualPerm),
          });
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to check file permissions: ${(error as Error).message}`);
    }

    return issues;
  }

  /**
   * Get permission severity
   */
  private getPermissionSeverity(file: string, perm: string): string {
    // wp-config.php with 777 or 666 is critical
    if (file === 'wp-config.php' && (perm === '777' || perm === '666')) {
      return 'CRITICAL';
    }
    // Any file with 777 is high risk
    if (perm === '777') {
      return 'HIGH';
    }
    return 'MEDIUM';
  }

  /**
   * Check if debug mode is enabled
   */
  private async checkDebugMode(serverId: string, sitePath: string): Promise<boolean> {
    try {
      const command = `grep -i "define.*WP_DEBUG.*true" ${sitePath}/wp-config.php 2>/dev/null`;
      const result = await this.sshExecutor.executeCommand(serverId, command, 10000);
      return result.trim() !== '';
    } catch (error) {
      return false; // grep returns 1 if not found
    }
  }

  /**
   * Check SSL certificate
   */
  private async checkSSL(domain: string): Promise<string[]> {
    const issues: string[] = [];

    try {
      // Check if site is accessible via HTTPS using axios
      const axios = require('axios');
      try {
        const response = await axios.get(`https://${domain}`, {
          timeout: 10000,
          validateStatus: () => true,
          maxRedirects: 0,
        });
        
        if (response.status >= 500) {
          issues.push('HTTPS not accessible');
        }
      } catch (error) {
        issues.push('HTTPS not accessible');
      }

      // Check SSL certificate expiry (simplified - would need openssl in production)
      // This is a placeholder - actual implementation would use openssl s_client
    } catch (error) {
      issues.push('Unable to verify SSL');
    }

    return issues;
  }

  /**
   * Check security headers
   */
  private async checkSecurityHeaders(domain: string): Promise<string[]> {
    const missing: string[] = [];

    try {
      const axios = require('axios');
      let headers: any = {};
      
      try {
        const response = await axios.get(`https://${domain}`, {
          timeout: 10000,
          validateStatus: () => true,
        });
        headers = response.headers;
      } catch (httpsError) {
        // Try HTTP fallback
        const response = await axios.get(`http://${domain}`, {
          timeout: 10000,
          validateStatus: () => true,
        });
        headers = response.headers;
      }

      for (const header of this.SECURITY_HEADERS) {
        const headerLower = header.toLowerCase();
        const hasHeader = Object.keys(headers).some(h => h.toLowerCase() === headerLower);
        if (!hasHeader) {
          missing.push(header);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to check security headers: ${(error as Error).message}`);
    }

    return missing;
  }

  /**
   * Check for exposed sensitive files
   */
  private async checkExposedFiles(
    serverId: string,
    sitePath: string,
  ): Promise<string[]> {
    const exposed: string[] = [];
    const sensitiveFiles = [
      'wp-config.php.bak',
      'wp-config.php~',
      '.git',
      '.env',
      'error_log',
      'debug.log',
      'readme.html',
      'license.txt',
    ];

    try {
      for (const file of sensitiveFiles) {
        const command = `test -f ${sitePath}/${file} && echo "EXISTS" || echo "NOT_FOUND"`;
        const result = await this.sshExecutor.executeCommand(serverId, command, 10000);

        if (result.trim() === 'EXISTS') {
          exposed.push(file);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to check exposed files: ${(error as Error).message}`);
    }

    return exposed;
  }

  /**
   * Verify WordPress core file checksums against wordpress.org API
   * Phase 1 - Layer 2: Core Integrity Enhancement
   */
  private async verifyCoreFileChecksums(
    serverId: string,
    sitePath: string,
  ): Promise<{
    modifiedFiles: string[];
    missingFiles: string[];
    extraFiles: string[];
    totalChecked: number;
  }> {
    try {
      // 1. Detect WordPress version
      const versionCommand = `grep "wp_version = " ${sitePath}/wp-includes/version.php | cut -d "'" -f 2`;
      const versionResult = await this.sshExecutor.executeCommand(serverId, versionCommand, 10000);
      const wpVersion = versionResult.trim();

      if (!wpVersion) {
        throw new Error('Could not detect WordPress version');
      }

      this.logger.log(`Detected WordPress version: ${wpVersion}`);

      // 2. Fetch official checksums from wordpress.org API
      const checksumUrl = `https://api.wordpress.org/core/checksums/1.0/?version=${wpVersion}`;
      const response = await fetch(checksumUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch checksums: ${response.statusText}`);
      }

      const data = await response.json();
      const checksums = data.checksums || {};

      if (Object.keys(checksums).length === 0) {
        throw new Error(`No checksums available for WordPress ${wpVersion}`);
      }

      // 3. Compare MD5 hashes of core files
      const modifiedFiles: string[] = [];
      const missingFiles: string[] = [];
      let totalChecked = 0;

      for (const [file, expectedHash] of Object.entries(checksums)) {
        totalChecked++;
        
        // Calculate MD5 hash of local file
        const hashCommand = `md5sum ${sitePath}/${file} 2>/dev/null | awk '{print $1}' || echo "MISSING"`;
        const actualHash = (await this.sshExecutor.executeCommand(serverId, hashCommand, 10000)).trim();

        if (actualHash === 'MISSING') {
          missingFiles.push(file);
        } else if (actualHash !== expectedHash) {
          modifiedFiles.push(file);
        }
      }

      // 4. Check for extra PHP files in wp-includes and wp-admin (potential backdoors)
      const extraFiles: string[] = [];
      const extraFilesCommand = `find ${sitePath}/wp-includes ${sitePath}/wp-admin -name "*.php" -type f 2>/dev/null | wc -l`;
      const extraFilesResult = await this.sshExecutor.executeCommand(serverId, extraFilesCommand, 15000);
      const actualFileCount = parseInt(extraFilesResult.trim());
      const expectedFileCount = Object.keys(checksums).filter(f => f.endsWith('.php')).length;

      if (actualFileCount > expectedFileCount + 10) {
        // More than 10 extra PHP files is suspicious
        this.logger.warn(`Found ${actualFileCount - expectedFileCount} extra PHP files`);
      }

      return {
        modifiedFiles,
        missingFiles,
        extraFiles,
        totalChecked,
      };
    } catch (error) {
      this.logger.error(`Checksum verification failed: ${(error as Error).message}`);
      return {
        modifiedFiles: [],
        missingFiles: [],
        extraFiles: [],
        totalChecked: 0,
      };
    }
  }

  /**
   * Scan for malware signatures in WordPress files
   * Phase 1 - Layer 2: Enhanced Malware Detection
   */
  private async scanForMalwareSignatures(
    serverId: string,
    sitePath: string,
  ): Promise<{
    suspiciousFiles: Array<{
      file: string;
      reason: string;
      confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    }>;
    totalScanned: number;
  }> {
    try {
      const suspiciousFiles: Array<{
        file: string;
        reason: string;
        confidence: 'HIGH' | 'MEDIUM' | 'LOW';
      }> = [];

      // 1. Scan for suspicious patterns in PHP files
      const suspiciousPatterns = [
        { pattern: 'base64_decode', confidence: 'MEDIUM' as const },
        { pattern: 'eval\\(', confidence: 'HIGH' as const },
        { pattern: 'system\\(', confidence: 'HIGH' as const },
        { pattern: 'exec\\(', confidence: 'HIGH' as const },
        { pattern: 'shell_exec', confidence: 'HIGH' as const },
        { pattern: 'gzinflate', confidence: 'MEDIUM' as const },
        { pattern: 'str_rot13', confidence: 'MEDIUM' as const },
        { pattern: 'assert\\(', confidence: 'MEDIUM' as const },
        { pattern: 'preg_replace.*\/e', confidence: 'HIGH' as const },
        { pattern: 'create_function', confidence: 'MEDIUM' as const },
      ];

      for (const { pattern, confidence } of suspiciousPatterns) {
        const command = `grep -rl "${pattern}" ${sitePath}/wp-content/plugins ${sitePath}/wp-content/themes ${sitePath}/wp-content/uploads 2>/dev/null | head -20`;
        const result = await this.sshExecutor.executeCommand(serverId, command, 30000);
        
        const files = result.trim().split('\n').filter(f => f);
        for (const file of files) {
          suspiciousFiles.push({
            file: file.replace(sitePath + '/', ''),
            reason: `Contains suspicious pattern: ${pattern}`,
            confidence,
          });
        }
      }

      // 2. Check for files with double extensions (file.php.jpg)
      const doubleExtCommand = `find ${sitePath}/wp-content -type f -name "*.php.*" 2>/dev/null`;
      const doubleExtResult = await this.sshExecutor.executeCommand(serverId, doubleExtCommand, 15000);
      
      const doubleExtFiles = doubleExtResult.trim().split('\n').filter(f => f);
      for (const file of doubleExtFiles) {
        suspiciousFiles.push({
          file: file.replace(sitePath + '/', ''),
          reason: 'Double extension (potential disguised PHP file)',
          confidence: 'HIGH',
        });
      }

      // 3. Scan wp-content/uploads for unexpected PHP files
      const uploadsPhpCommand = `find ${sitePath}/wp-content/uploads -name "*.php" -type f 2>/dev/null`;
      const uploadsPhpResult = await this.sshExecutor.executeCommand(serverId, uploadsPhpCommand, 15000);
      
      const uploadsPhpFiles = uploadsPhpResult.trim().split('\n').filter(f => f);
      for (const file of uploadsPhpFiles) {
        suspiciousFiles.push({
          file: file.replace(sitePath + '/', ''),
          reason: 'PHP file in uploads directory (should not exist)',
          confidence: 'HIGH',
        });
      }

      // 4. Check for high entropy files (often obfuscated malware)
      // This is a simplified check - production would use more sophisticated entropy calculation
      const highEntropyCommand = `find ${sitePath}/wp-content -name "*.php" -type f -exec wc -c {} \\; 2>/dev/null | awk '$1 > 100000 {print $2}' | head -10`;
      const highEntropyResult = await this.sshExecutor.executeCommand(serverId, highEntropyCommand, 30000);
      
      const highEntropyFiles = highEntropyResult.trim().split('\n').filter(f => f);
      for (const file of highEntropyFiles) {
        // Check if file contains suspicious patterns
        const contentCheck = `grep -l "base64_decode\\|eval\\|gzinflate" ${file} 2>/dev/null`;
        const hasPattern = await this.sshExecutor.executeCommand(serverId, contentCheck, 10000);
        
        if (hasPattern.trim()) {
          suspiciousFiles.push({
            file: file.replace(sitePath + '/', ''),
            reason: 'Large file with suspicious patterns (potential obfuscated malware)',
            confidence: 'HIGH',
          });
        }
      }

      // Count total files scanned
      const totalCommand = `find ${sitePath}/wp-content -name "*.php" -type f 2>/dev/null | wc -l`;
      const totalResult = await this.sshExecutor.executeCommand(serverId, totalCommand, 30000);
      const totalScanned = parseInt(totalResult.trim()) || 0;

      return {
        suspiciousFiles,
        totalScanned,
      };
    } catch (error) {
      this.logger.error(`Malware scan failed: ${(error as Error).message}`);
      return {
        suspiciousFiles: [],
        totalScanned: 0,
      };
    }
  }

  /**
   * Validate .htaccess for malware patterns
   * Phase 1 - Layer 2: Advanced .htaccess Security Check
   */
  private async validateHtaccessSecurity(
    serverId: string,
    sitePath: string,
  ): Promise<{
    issues: Array<{
      line: string;
      reason: string;
      severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
    }>;
    isClean: boolean;
  }> {
    try {
      const issues: Array<{
        line: string;
        reason: string;
        severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
      }> = [];

      // Read .htaccess file
      const command = `cat ${sitePath}/.htaccess 2>/dev/null || echo "NOT_FOUND"`;
      const content = await this.sshExecutor.executeCommand(serverId, command, 10000);

      if (content.trim() === 'NOT_FOUND') {
        return { issues: [], isClean: true };
      }

      const lines = content.split('\n');

      // 1. Check for redirect rules to external domains (often base64 encoded)
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Check for base64 encoded redirects
        if (line.includes('RewriteRule') && line.includes('base64')) {
          issues.push({
            line: `Line ${i + 1}: ${line}`,
            reason: 'Base64 encoded redirect (common malware pattern)',
            severity: 'CRITICAL',
          });
        }

        // Check for redirects to external domains
        if (line.includes('RewriteRule') && /https?:\/\//.test(line)) {
          const urlMatch = line.match(/https?:\/\/([^\/\s]+)/);
          if (urlMatch) {
            issues.push({
              line: `Line ${i + 1}: ${line}`,
              reason: `Redirect to external domain: ${urlMatch[1]}`,
              severity: 'HIGH',
            });
          }
        }

        // Check for user agent cloaking (RewriteCond %{HTTP_USER_AGENT})
        if (line.includes('RewriteCond') && line.includes('HTTP_USER_AGENT')) {
          issues.push({
            line: `Line ${i + 1}: ${line}`,
            reason: 'User agent cloaking detected (potential SEO spam)',
            severity: 'HIGH',
          });
        }

        // Check for AddType allowing PHP execution in images
        if (line.includes('AddType') && line.includes('application/x-httpd-php') && /\.(jpg|jpeg|png|gif)/.test(line)) {
          issues.push({
            line: `Line ${i + 1}: ${line}`,
            reason: 'Allows PHP execution in image files (backdoor)',
            severity: 'CRITICAL',
          });
        }

        // Check for suspicious auto_prepend_file or auto_append_file
        if ((line.includes('auto_prepend_file') || line.includes('auto_append_file')) && line.includes('php_value')) {
          issues.push({
            line: `Line ${i + 1}: ${line}`,
            reason: 'Auto prepend/append file directive (potential code injection)',
            severity: 'CRITICAL',
          });
        }
      }

      return {
        issues,
        isClean: issues.length === 0,
      };
    } catch (error) {
      this.logger.error(`.htaccess security validation failed: ${(error as Error).message}`);
      return {
        issues: [],
        isClean: true,
      };
    }
  }

  /**
   * Check database prefix
   */
  private async checkDatabasePrefix(
    serverId: string,
    sitePath: string,
  ): Promise<boolean> {
    try {
      const command = `grep "table_prefix" ${sitePath}/wp-config.php | grep "wp_" 2>/dev/null`;
      const result = await this.sshExecutor.executeCommand(serverId, command, 10000);
      return result.trim() !== '';
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if file editing is enabled
   */
  private async checkFileEditing(serverId: string, sitePath: string): Promise<boolean> {
    try {
      const command = `grep -i "DISALLOW_FILE_EDIT.*true" ${sitePath}/wp-config.php 2>/dev/null`;
      const result = await this.sshExecutor.executeCommand(serverId, command, 10000);
      return result.trim() === ''; // If not found, editing is enabled
    } catch (error) {
      return true; // Assume enabled if can't check
    }
  }

  /**
   * Check if XML-RPC is enabled
   */
  private async checkXmlRpc(serverId: string, sitePath: string): Promise<boolean> {
    try {
      const command = `test -f ${sitePath}/xmlrpc.php && echo "EXISTS" || echo "NOT_FOUND"`;
      const result = await this.sshExecutor.executeCommand(serverId, command, 10000);
      return result.trim() === 'EXISTS';
    } catch (error) {
      return false;
    }
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.SECURITY_AUDIT;
  }

  getPriority(): CheckPriority {
    return CheckPriority.HIGH;
  }

  getName(): string {
    return 'Security Audit';
  }

  getDescription(): string {
    return 'Audits file permissions, SSL, security headers, and WordPress security settings';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.SECURITY_AUDIT;
  }
}
