import { Injectable, Logger } from '@nestjs/common';
import { SshExecutorService } from '../services/ssh-executor.service';

interface HealingContext {
  site: any;
  execution: any;
  diagnosisDetails: any;
}

interface HealingResult {
  success: boolean;
  action: string;
  details: any;
}

@Injectable()
export class MaintenanceHealerRunbook {
  private readonly logger = new Logger(MaintenanceHealerRunbook.name);

  constructor(private readonly sshService: SshExecutorService) {}

  /**
   * Execute maintenance mode healing
   */
  async execute(context: HealingContext): Promise<HealingResult> {
    const { site } = context;

    this.logger.log(`Executing maintenance healer for site ${site.domain}`);

    try {
      const maintenanceFile = `${site.path}/.maintenance`;

      // Remove .maintenance file
      await this.sshService.executeCommand(
        site.serverId,
        `rm -f ${maintenanceFile}`,
      );

      return {
        success: true,
        action: 'Removed stuck .maintenance file',
        details: { file: maintenanceFile },
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Maintenance healing failed: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Verify healing success
   */
  async verify(context: HealingContext): Promise<boolean> {
    const { site } = context;

    this.logger.log(`Verifying maintenance healing for site ${site.domain}`);

    try {
      // Check if .maintenance file is gone
      const maintenanceFile = `${site.path}/.maintenance`;
      const exists = await this.sshService.executeCommand(
        site.serverId,
        `test -f ${maintenanceFile} && echo "exists" || echo "not found"`,
      );

      return !exists.includes('exists');
    } catch {
      return false;
    }
  }
}
