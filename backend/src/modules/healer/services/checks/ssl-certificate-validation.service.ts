import { Injectable, Logger } from '@nestjs/common';
import { CheckResult, CheckStatus, IDiagnosisCheckService, CheckPriority } from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';
import { SSHExecutorService } from '../ssh-executor.service';

@Injectable()
export class SslCertificateValidationService implements IDiagnosisCheckService {
  private readonly logger = new Logger(SslCertificateValidationService.name);

  constructor(private readonly sshExecutor: SSHExecutorService) {}

  async check(serverId: string, sitePath: string, domain: string, config?: any): Promise<CheckResult> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Checking SSL certificate for site: ${domain}`);

      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      const results = [];

      // Check certificate validity
      const validityResult = await this.checkCertificateValidity(serverId, cleanDomain);
      results.push(validityResult);

      // Check certificate chain
      const chainResult = await this.checkCertificateChain(serverId, cleanDomain);
      results.push(chainResult);

      // Check certificate expiration
      const expirationResult = await this.checkCertificateExpiration(serverId, cleanDomain);
      results.push(expirationResult);

      // Determine overall status and score
      const hasFailures = results.some(r => r.status === CheckStatus.FAIL);
      const hasWarnings = results.some(r => r.status === CheckStatus.WARNING);
      
      let status = CheckStatus.PASS;
      let score = 100;
      
      if (hasFailures) {
        status = CheckStatus.FAIL;
        score = 20;
      } else if (hasWarnings) {
        status = CheckStatus.WARNING;
        score = 70;
      }

      return {
        checkType: this.getCheckType(),
        status,
        score,
        message: hasFailures 
          ? 'SSL certificate issues detected'
          : hasWarnings 
          ? 'SSL certificate has warnings'
          : 'SSL certificate is valid and properly configured',
        details: {
          domain: cleanDomain,
          results: results.map(r => ({
            type: r.checkType,
            status: r.status,
            message: r.message,
            data: r.details
          }))
        },
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`SSL certificate validation failed for ${domain}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        checkType: this.getCheckType(),
        status: CheckStatus.ERROR,
        score: 0,
        message: `SSL certificate validation failed: ${errorMessage}`,
        details: { error: errorMessage },
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.SSL_CERTIFICATE_VALIDATION;
  }

  getPriority(): CheckPriority {
    return CheckPriority.HIGH;
  }

  getName(): string {
    return 'SSL Certificate Validation';
  }

  getDescription(): string {
    return 'Validates SSL certificate validity, chain, and expiration';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.SSL_CERTIFICATE_VALIDATION;
  }

  private async checkCertificateValidity(serverId: string, domain: string): Promise<CheckResult> {
    try {
      const command = `echo | openssl s_client -servername ${domain} -connect ${domain}:443 2>/dev/null | openssl x509 -noout -dates`;
      const result = await this.sshExecutor.executeCommandDetailed(serverId, command);

      if (result.success && result.output && result.output.includes('notBefore') && result.output.includes('notAfter')) {
        const lines = result.output.trim().split('\n');
        const notBefore = lines.find(line => line.includes('notBefore'))?.replace('notBefore=', '');
        const notAfter = lines.find(line => line.includes('notAfter'))?.replace('notAfter=', '');

        if (!notAfter) {
          return {
            checkType: DiagnosisCheckType.SSL_CERTIFICATE_VALIDATION,
            status: CheckStatus.FAIL,
            score: 0,
            message: 'Unable to parse certificate expiration date',
            details: { error: 'notAfter field not found' },
            duration: 0,
            timestamp: new Date(),
          };
        }

        const now = new Date();
        const expiryDate = new Date(notAfter);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        return {
          checkType: DiagnosisCheckType.SSL_CERTIFICATE_VALIDATION,
          status: daysUntilExpiry > 0 ? CheckStatus.PASS : CheckStatus.FAIL,
          score: daysUntilExpiry > 0 ? 100 : 0,
          message: daysUntilExpiry > 0 
            ? `Certificate is valid (expires in ${daysUntilExpiry} days)`
            : 'Certificate has expired',
          details: { notBefore, notAfter, daysUntilExpiry },
          duration: 0,
          timestamp: new Date(),
        };
      } else {
        return {
          checkType: DiagnosisCheckType.SSL_CERTIFICATE_VALIDATION,
          status: CheckStatus.FAIL,
          score: 0,
          message: 'Unable to retrieve certificate information',
          details: { error: result.error },
          duration: 0,
          timestamp: new Date(),
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        checkType: DiagnosisCheckType.SSL_CERTIFICATE_VALIDATION,
        status: CheckStatus.FAIL,
        score: 0,
        message: `Certificate validity check failed: ${errorMessage}`,
        details: { error: errorMessage },
        duration: 0,
        timestamp: new Date(),
      };
    }
  }

  private async checkCertificateChain(serverId: string, domain: string): Promise<CheckResult> {
    try {
      const command = `echo | openssl s_client -servername ${domain} -connect ${domain}:443 -verify_return_error 2>&1 | grep -E "(Verify return code|verify error)"`;
      const result = await this.sshExecutor.executeCommandDetailed(serverId, command);

      if (result.success && result.output) {
        const output = result.output.trim();
        if (output.includes('Verify return code: 0 (ok)')) {
          return {
            checkType: DiagnosisCheckType.SSL_CERTIFICATE_VALIDATION,
            status: CheckStatus.PASS,
            score: 100,
            message: 'Certificate chain is valid',
            details: { chainValid: true },
            duration: 0,
            timestamp: new Date(),
          };
        } else if (output.includes('verify error')) {
          return {
            checkType: DiagnosisCheckType.SSL_CERTIFICATE_VALIDATION,
            status: CheckStatus.FAIL,
            score: 0,
            message: `Certificate chain validation failed: ${output}`,
            details: { chainValid: false, error: output },
            duration: 0,
            timestamp: new Date(),
          };
        }
      }

      return {
        checkType: DiagnosisCheckType.SSL_CERTIFICATE_VALIDATION,
        status: CheckStatus.WARNING,
        score: 70,
        message: 'Unable to verify certificate chain',
        details: { error: result.error },
        duration: 0,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        checkType: DiagnosisCheckType.SSL_CERTIFICATE_VALIDATION,
        status: CheckStatus.WARNING,
        score: 70,
        message: `Certificate chain check failed: ${errorMessage}`,
        details: { error: errorMessage },
        duration: 0,
        timestamp: new Date(),
      };
    }
  }

  private async checkCertificateExpiration(serverId: string, domain: string): Promise<CheckResult> {
    try {
      const command = `echo | openssl s_client -servername ${domain} -connect ${domain}:443 2>/dev/null | openssl x509 -noout -enddate`;
      const result = await this.sshExecutor.executeCommandDetailed(serverId, command);

      if (result.success && result.output && result.output.includes('notAfter=')) {
        const expiryString = result.output.replace('notAfter=', '').trim();
        const expiryDate = new Date(expiryString);
        const now = new Date();
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        let status = CheckStatus.PASS;
        let score = 100;
        let message = `Certificate expires in ${daysUntilExpiry} days`;

        if (daysUntilExpiry <= 0) {
          status = CheckStatus.FAIL;
          score = 0;
          message = 'Certificate has expired';
        } else if (daysUntilExpiry <= 7) {
          status = CheckStatus.FAIL;
          score = 20;
          message = `Certificate expires in ${daysUntilExpiry} days - URGENT renewal needed`;
        } else if (daysUntilExpiry <= 30) {
          status = CheckStatus.WARNING;
          score = 60;
          message = `Certificate expires in ${daysUntilExpiry} days - renewal recommended`;
        }

        return {
          checkType: DiagnosisCheckType.SSL_CERTIFICATE_VALIDATION,
          status,
          score,
          message,
          details: { expiryDate: expiryString, daysUntilExpiry },
          duration: 0,
          timestamp: new Date(),
        };
      } else {
        return {
          checkType: DiagnosisCheckType.SSL_CERTIFICATE_VALIDATION,
          status: CheckStatus.FAIL,
          score: 0,
          message: 'Unable to check certificate expiration',
          details: { error: result.error },
          duration: 0,
          timestamp: new Date(),
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        checkType: DiagnosisCheckType.SSL_CERTIFICATE_VALIDATION,
        status: CheckStatus.FAIL,
        score: 0,
        message: `Certificate expiration check failed: ${errorMessage}`,
        details: { error: errorMessage },
        duration: 0,
        timestamp: new Date(),
      };
    }
  }
}