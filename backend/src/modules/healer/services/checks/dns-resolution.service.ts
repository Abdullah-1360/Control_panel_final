import { Injectable, Logger } from '@nestjs/common';
import { CheckResult, CheckStatus, IDiagnosisCheckService, CheckPriority } from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';
import { SSHExecutorService } from '../ssh-executor.service';

@Injectable()
export class DnsResolutionService implements IDiagnosisCheckService {
  private readonly logger = new Logger(DnsResolutionService.name);

  constructor(private readonly sshExecutor: SSHExecutorService) {}

  async check(serverId: string, sitePath: string, domain: string, config?: any): Promise<CheckResult> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Checking DNS resolution for site: ${domain}`);

      const results = [];
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

      // Check A record resolution
      const aRecordResult = await this.checkARecord(serverId, cleanDomain);
      results.push(aRecordResult);

      // Check AAAA record (IPv6) if available
      const aaaaRecordResult = await this.checkAAAARecord(serverId, cleanDomain);
      results.push(aaaaRecordResult);

      // Check CNAME resolution if applicable
      const cnameResult = await this.checkCNAME(serverId, cleanDomain);
      results.push(cnameResult);

      // Check MX records for email functionality
      const mxResult = await this.checkMXRecords(serverId, cleanDomain);
      results.push(mxResult);

      // Determine overall status and score
      const hasFailures = results.some(r => r.status === CheckStatus.FAIL);
      const hasWarnings = results.some(r => r.status === CheckStatus.WARNING);
      
      let status = CheckStatus.PASS;
      let score = 100;
      
      if (hasFailures) {
        status = CheckStatus.FAIL;
        score = 30;
      } else if (hasWarnings) {
        status = CheckStatus.WARNING;
        score = 70;
      }

      return {
        checkType: this.getCheckType(),
        status,
        score,
        message: hasFailures 
          ? 'DNS resolution issues detected'
          : hasWarnings 
          ? 'DNS configuration has warnings'
          : 'DNS resolution working correctly',
        details: {
          domain: cleanDomain,
          results: results.map(r => ({
            type: r.checkType,
            status: r.status,
            message: r.message,
            details: r.details
          }))
        },
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`DNS resolution check failed for ${domain}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        checkType: this.getCheckType(),
        status: CheckStatus.ERROR,
        score: 0,
        message: `DNS resolution check failed: ${errorMessage}`,
        details: { error: errorMessage },
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.DNS_RESOLUTION;
  }

  getPriority(): CheckPriority {
    return CheckPriority.HIGH;
  }

  getName(): string {
    return 'DNS Resolution Check';
  }

  getDescription(): string {
    return 'Verifies DNS resolution for A, AAAA, CNAME, and MX records';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.DNS_RESOLUTION;
  }

  private async checkARecord(serverId: string, domain: string): Promise<CheckResult> {
    try {
      const command = `nslookup ${domain} | grep -A 2 "Name:" | grep "Address:"`;
      const result = await this.sshExecutor.executeCommandDetailed(serverId, command);

      if (result.success && result.output && result.output.trim()) {
        const addresses = result.output.trim().split('\n')
          .map(line => line.replace(/Address:\s*/, '').trim())
          .filter(addr => addr && !addr.includes('#'));

        return {
          checkType: DiagnosisCheckType.DNS_RESOLUTION,
          status: CheckStatus.PASS,
          score: 100,
          message: `A record resolved to: ${addresses.join(', ')}`,
          details: { addresses },
          duration: 0,
          timestamp: new Date(),
        };
      } else {
        return {
          checkType: DiagnosisCheckType.DNS_RESOLUTION,
          status: CheckStatus.FAIL,
          score: 0,
          message: 'A record resolution failed',
          details: { error: result.error },
          duration: 0,
          timestamp: new Date(),
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        checkType: DiagnosisCheckType.DNS_RESOLUTION,
        status: CheckStatus.FAIL,
        score: 0,
        message: `A record check failed: ${errorMessage}`,
        details: { error: errorMessage },
        duration: 0,
        timestamp: new Date(),
      };
    }
  }

  private async checkAAAARecord(serverId: string, domain: string): Promise<CheckResult> {
    try {
      const command = `nslookup -type=AAAA ${domain} | grep -A 1 "has AAAA address"`;
      const result = await this.sshExecutor.executeCommandDetailed(serverId, command);

      if (result.success && result.output && result.output.trim()) {
        const addresses = result.output.trim().split('\n')
          .map(line => line.replace(/.*has AAAA address\s*/, '').trim())
          .filter(addr => addr);

        return {
          checkType: DiagnosisCheckType.DNS_RESOLUTION,
          status: CheckStatus.PASS,
          score: 100,
          message: `AAAA record resolved to: ${addresses.join(', ')}`,
          details: { addresses },
          duration: 0,
          timestamp: new Date(),
        };
      } else {
        return {
          checkType: DiagnosisCheckType.DNS_RESOLUTION,
          status: CheckStatus.WARNING,
          score: 80,
          message: 'No IPv6 (AAAA) records found',
          details: { note: 'IPv6 not configured, not critical for most sites' },
          duration: 0,
          timestamp: new Date(),
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        checkType: DiagnosisCheckType.DNS_RESOLUTION,
        status: CheckStatus.WARNING,
        score: 80,
        message: `AAAA record check failed: ${errorMessage}`,
        details: { error: errorMessage },
        duration: 0,
        timestamp: new Date(),
      };
    }
  }

  private async checkCNAME(serverId: string, domain: string): Promise<CheckResult> {
    try {
      const command = `nslookup -type=CNAME ${domain} | grep -A 1 "canonical name"`;
      const result = await this.sshExecutor.executeCommandDetailed(serverId, command);

      if (result.success && result.output && result.output.trim()) {
        const cname = result.output.trim()
          .replace(/.*canonical name = /, '')
          .replace(/\.$/, '');

        return {
          checkType: DiagnosisCheckType.DNS_RESOLUTION,
          status: CheckStatus.PASS,
          score: 100,
          message: `CNAME points to: ${cname}`,
          details: { cname },
          duration: 0,
          timestamp: new Date(),
        };
      } else {
        return {
          checkType: DiagnosisCheckType.DNS_RESOLUTION,
          status: CheckStatus.PASS,
          score: 100,
          message: 'No CNAME record (direct A record)',
          details: { note: 'Domain uses direct A record, not CNAME' },
          duration: 0,
          timestamp: new Date(),
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        checkType: DiagnosisCheckType.DNS_RESOLUTION,
        status: CheckStatus.WARNING,
        score: 80,
        message: `CNAME check failed: ${errorMessage}`,
        details: { error: errorMessage },
        duration: 0,
        timestamp: new Date(),
      };
    }
  }

  private async checkMXRecords(serverId: string, domain: string): Promise<CheckResult> {
    try {
      const command = `nslookup -type=MX ${domain} | grep "mail exchanger"`;
      const result = await this.sshExecutor.executeCommandDetailed(serverId, command);

      if (result.success && result.output && result.output.trim()) {
        const mxRecords = result.output.trim().split('\n')
          .map(line => line.replace(/.*mail exchanger = /, '').trim())
          .filter(mx => mx);

        return {
          checkType: DiagnosisCheckType.DNS_RESOLUTION,
          status: CheckStatus.PASS,
          score: 100,
          message: `MX records found: ${mxRecords.join(', ')}`,
          details: { mxRecords },
          duration: 0,
          timestamp: new Date(),
        };
      } else {
        return {
          checkType: DiagnosisCheckType.DNS_RESOLUTION,
          status: CheckStatus.WARNING,
          score: 80,
          message: 'No MX records found - email functionality may be impaired',
          details: { note: 'Consider setting up MX records for email delivery' },
          duration: 0,
          timestamp: new Date(),
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        checkType: DiagnosisCheckType.DNS_RESOLUTION,
        status: CheckStatus.WARNING,
        score: 80,
        message: `MX record check failed: ${errorMessage}`,
        details: { error: errorMessage },
        duration: 0,
        timestamp: new Date(),
      };
    }
  }
}