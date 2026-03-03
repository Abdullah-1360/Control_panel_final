import { Injectable, Logger } from '@nestjs/common';
import { SSHExecutorService } from '../ssh-executor.service';
import { WpCliService } from '../wp-cli.service';
import {
  IDiagnosisCheckService,
  CheckResult,
  CheckStatus,
  CheckPriority,
} from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';

/**
 * Database Connection Service
 * Checks if WordPress can connect to the database
 */
@Injectable()
export class DatabaseConnectionService implements IDiagnosisCheckService {
  private readonly logger = new Logger(DatabaseConnectionService.name);

  constructor(
    private readonly sshExecutor: SSHExecutorService,
    private readonly wpCli: WpCliService,
  ) {}

  async check(
    serverId: string,
    sitePath: string,
    domain: string,
    config?: any,
  ): Promise<CheckResult> {
    const startTime = Date.now();
    const recommendations: string[] = [];

    try {
      this.logger.log(`Checking database connection for ${domain}`);

      // Test database connection using WP-CLI
      const connectionTest = await this.wpCli.execute(
        serverId,
        sitePath,
        'db check',
      );

      const connected = !connectionTest.toLowerCase().includes('error');

      let status: CheckStatus;
      let message: string;
      let score = 100;

      if (connected) {
        status = CheckStatus.PASS;
        message = 'Database connection successful';
      } else {
        status = CheckStatus.FAIL;
        score = 0;
        message = 'Database connection failed';
        recommendations.push('Check wp-config.php database credentials');
        recommendations.push('Verify MySQL/MariaDB service is running');
        recommendations.push('Check database server connectivity');
        recommendations.push('Verify database user permissions');
      }

      return {
        checkType: this.getCheckType(),
        status,
        score,
        message,
        details: {
          connected,
          connectionTest: connectionTest.substring(0, 500),
        },
        recommendations,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Database connection check failed: ${err.message}`);

      return {
        checkType: this.getCheckType(),
        status: CheckStatus.FAIL,
        score: 0,
        message: `Database connection failed: ${err.message}`,
        details: { error: err.message },
        recommendations: [
          'Check wp-config.php database credentials',
          'Verify MySQL/MariaDB service is running',
          'Check database server connectivity',
        ],
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.DATABASE_CONNECTION;
  }

  getPriority(): CheckPriority {
    return CheckPriority.CRITICAL;
  }

  getName(): string {
    return 'Database Connection';
  }

  getDescription(): string {
    return 'Checks if WordPress can connect to the database';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.DATABASE_CONNECTION;
  }
}
