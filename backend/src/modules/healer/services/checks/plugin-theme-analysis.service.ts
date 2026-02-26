import { Injectable, Logger } from '@nestjs/common';
import {
  CheckResult,
  CheckStatus,
  CheckPriority,
  IDiagnosisCheckService,
} from '../../interfaces/diagnosis-check.interface';
import { DiagnosisCheckType } from '../../enums/diagnosis-profile.enum';
import { SSHExecutorService } from '../ssh-executor.service';
import { WpCliService } from '../wp-cli.service';

@Injectable()
export class PluginThemeAnalysisService implements IDiagnosisCheckService {
  private readonly logger = new Logger(PluginThemeAnalysisService.name);

  constructor(
    private readonly sshExecutor: SSHExecutorService,
    private readonly wpCli: WpCliService,
  ) {}

  async check(
    serverId: string,
    sitePath: string,
    domain: string,
  ): Promise<CheckResult> {
    const startTime = Date.now();
    const details: any = {};
    const recommendations: string[] = [];
    let score = 100;
    let status = CheckStatus.PASS;

    try {
      // Analyze error_log for plugin/theme issues
      const errorLogAnalysis = await this.analyzeErrorLog(serverId, sitePath);
      details.errorLogAnalysis = errorLogAnalysis;

      if (errorLogAnalysis.problematicPlugins.length > 0) {
        score -= errorLogAnalysis.problematicPlugins.length * 15;
        status = CheckStatus.FAIL;
        recommendations.push(
          `Critical: ${errorLogAnalysis.problematicPlugins.length} plugin(s) causing errors: ${errorLogAnalysis.problematicPlugins.join(', ')}`,
        );
      }

      if (errorLogAnalysis.problematicThemes.length > 0) {
        score -= errorLogAnalysis.problematicThemes.length * 15;
        status = CheckStatus.FAIL;
        recommendations.push(
          `Critical: ${errorLogAnalysis.problematicThemes.length} theme(s) causing errors: ${errorLogAnalysis.problematicThemes.join(', ')}`,
        );
      }

      // Check active vs inactive plugins
      const pluginStatus = await this.checkPluginStatus(serverId, sitePath);
      details.plugins = pluginStatus;

      if (pluginStatus.inactive > 0) {
        score -= Math.min(pluginStatus.inactive * 2, 10);
        recommendations.push(
          `Remove ${pluginStatus.inactive} inactive plugin(s) to reduce attack surface`,
        );
      }

      if (pluginStatus.total > 30) {
        score -= 5;
        recommendations.push(
          'Consider reducing plugin count (30+) for better performance',
        );
      }

      // Check for plugin conflicts
      const conflicts = await this.detectPluginConflicts(serverId, sitePath);
      details.conflicts = conflicts;

      if (conflicts.length > 0) {
        score -= conflicts.length * 10;
        if (status === CheckStatus.PASS) {
          status = CheckStatus.WARNING;
        }
        recommendations.push(
          `Resolve ${conflicts.length} potential plugin conflict(s)`,
        );
      }

      // Check theme status
      const themeStatus = await this.checkThemeStatus(serverId, sitePath);
      details.themes = themeStatus;

      if (themeStatus.inactive > 0) {
        score -= Math.min(themeStatus.inactive * 3, 10);
        recommendations.push(
          `Remove ${themeStatus.inactive} inactive theme(s) to reduce security risk`,
        );
      }

      // Check for unused plugins (installed but never activated)
      const unusedPlugins = await this.findUnusedPlugins(serverId, sitePath);
      details.unusedPlugins = unusedPlugins;

      if (unusedPlugins.length > 0) {
        score -= Math.min(unusedPlugins.length * 2, 10);
        recommendations.push(
          `Remove ${unusedPlugins.length} unused plugin(s)`,
        );
      }

      // Check for must-use plugins
      const muPlugins = await this.checkMustUsePlugins(serverId, sitePath);
      details.mustUsePlugins = muPlugins;

      score = Math.max(0, Math.min(100, score));

      if (score < 60) {
        status = CheckStatus.FAIL;
      } else if (score < 80 && status === CheckStatus.PASS) {
        status = CheckStatus.WARNING;
      }

      return {
        checkType: DiagnosisCheckType.PLUGIN_THEME_ANALYSIS,
        status,
        score,
        message: this.buildMessage(status, details),
        details,
        recommendations,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Plugin/Theme analysis failed for ${domain}: ${errorMessage}`,
      );
      return {
        checkType: DiagnosisCheckType.PLUGIN_THEME_ANALYSIS,
        status: CheckStatus.ERROR,
        score: 0,
        message: `Failed to analyze plugins/themes: ${errorMessage}`,
        details: { error: errorMessage },
        recommendations: ['Verify WP-CLI access and site permissions'],
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Analyze error_log to identify problematic plugins and themes
   */
  private async analyzeErrorLog(
    serverId: string,
    sitePath: string,
  ): Promise<{
    problematicPlugins: string[];
    problematicThemes: string[];
    errorCount: number;
    recentErrors: string[];
  }> {
    try {
      // Read error_log from multiple possible locations
      const errorLogLocations = [
        `${sitePath}/error_log`,
        `${sitePath}/public_html/error_log`,
        `${sitePath}/../error_log`,
        `${sitePath}/wp-content/debug.log`,
      ];

      let errorLogContent = '';
      for (const location of errorLogLocations) {
        try {
          const result = await this.sshExecutor.executeCommand(
            serverId,
            `tail -200 ${location} 2>/dev/null || echo ""`,
          );
          if (result && !result.includes('No such file')) {
            errorLogContent += result + '\n';
          }
        } catch (error) {
          // Continue to next location
        }
      }

      if (!errorLogContent || errorLogContent.trim() === '') {
        return {
          problematicPlugins: [],
          problematicThemes: [],
          errorCount: 0,
          recentErrors: [],
        };
      }

      const problematicPlugins = new Set<string>();
      const problematicThemes = new Set<string>();
      const recentErrors: string[] = [];
      let errorCount = 0;

      const lines = errorLogContent.split('\n');
      for (const line of lines) {
        // Check if line contains an error
        if (
          line.includes('Fatal error') ||
          line.includes('PHP Fatal error') ||
          line.includes('PHP Parse error') ||
          line.includes('Error') ||
          line.includes('Warning')
        ) {
          errorCount++;
          
          // Keep last 10 errors for details
          if (recentErrors.length < 10) {
            recentErrors.push(line.trim());
          }

          // Extract plugin names from error messages
          // Pattern: /wp-content/plugins/plugin-name/
          const pluginMatch = line.match(/\/wp-content\/plugins\/([^\/]+)\//);
          if (pluginMatch) {
            problematicPlugins.add(pluginMatch[1]);
          }

          // Extract theme names from error messages
          // Pattern: /wp-content/themes/theme-name/
          const themeMatch = line.match(/\/wp-content\/themes\/([^\/]+)\//);
          if (themeMatch) {
            problematicThemes.add(themeMatch[1]);
          }

          // Also check for plugin/theme names in error messages
          // Pattern: "Plugin Name" or 'Plugin Name'
          const quotedPluginMatch = line.match(/plugin[:\s]+['"]([^'"]+)['"]/i);
          if (quotedPluginMatch) {
            problematicPlugins.add(quotedPluginMatch[1]);
          }

          const quotedThemeMatch = line.match(/theme[:\s]+['"]([^'"]+)['"]/i);
          if (quotedThemeMatch) {
            problematicThemes.add(quotedThemeMatch[1]);
          }
        }
      }

      return {
        problematicPlugins: Array.from(problematicPlugins),
        problematicThemes: Array.from(problematicThemes),
        errorCount,
        recentErrors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to analyze error log: ${errorMessage}`);
      return {
        problematicPlugins: [],
        problematicThemes: [],
        errorCount: 0,
        recentErrors: [],
      };
    }
  }

  private async checkPluginStatus(
    serverId: string,
    sitePath: string,
  ): Promise<any> {
    try {
      const result = await this.wpCli.execute(
        serverId,
        sitePath,
        'plugin list --format=json',
      );

      const plugins = JSON.parse(result);
      const active = plugins.filter((p: any) => p.status === 'active').length;
      const inactive = plugins.filter((p: any) => p.status === 'inactive').length;

      return {
        total: plugins.length,
        active,
        inactive,
        list: plugins.map((p: any) => ({
          name: p.name,
          status: p.status,
          update: p.update,
          version: p.version,
        })),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to check plugin status: ${errorMessage}`);
      return { total: 0, active: 0, inactive: 0, list: [] };
    }
  }

  private async detectPluginConflicts(
    serverId: string,
    sitePath: string,
  ): Promise<any[]> {
    const conflicts: any[] = [];

    try {
      // Check for common conflicting plugin combinations
      const result = await this.wpCli.execute(
        serverId,
        sitePath,
        'plugin list --status=active --format=json',
      );

      const activePlugins = JSON.parse(result);
      const pluginNames = activePlugins.map((p: any) => p.name.toLowerCase());

      // Known conflicting pairs
      const conflictPairs = [
        ['wp-super-cache', 'w3-total-cache'],
        ['yoast-seo', 'all-in-one-seo-pack'],
        ['jetpack', 'akismet'], // Can conflict if both handle spam
        ['wordfence', 'sucuri-scanner'], // Multiple security plugins
      ];

      for (const [plugin1, plugin2] of conflictPairs) {
        if (pluginNames.includes(plugin1) && pluginNames.includes(plugin2)) {
          conflicts.push({
            type: 'duplicate_functionality',
            plugins: [plugin1, plugin2],
            severity: 'medium',
            description: `${plugin1} and ${plugin2} may conflict`,
          });
        }
      }

      // Check for too many caching plugins
      const cachingPlugins = pluginNames.filter((name: string) =>
        ['cache', 'speed', 'optimize', 'performance'].some((keyword) =>
          name.includes(keyword),
        ),
      );

      if (cachingPlugins.length > 2) {
        conflicts.push({
          type: 'multiple_caching',
          plugins: cachingPlugins,
          severity: 'high',
          description: 'Multiple caching plugins detected',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to detect plugin conflicts: ${errorMessage}`);
    }

    return conflicts;
  }

  private async checkThemeStatus(
    serverId: string,
    sitePath: string,
  ): Promise<any> {
    try {
      const result = await this.wpCli.execute(
        serverId,
        sitePath,
        'theme list --format=json',
      );

      const themes = JSON.parse(result);
      const active = themes.filter((t: any) => t.status === 'active').length;
      const inactive = themes.filter((t: any) => t.status === 'inactive').length;

      return {
        total: themes.length,
        active,
        inactive,
        list: themes.map((t: any) => ({
          name: t.name,
          status: t.status,
          update: t.update,
          version: t.version,
        })),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to check theme status: ${errorMessage}`);
      return { total: 0, active: 0, inactive: 0, list: [] };
    }
  }

  private async findUnusedPlugins(
    serverId: string,
    sitePath: string,
  ): Promise<string[]> {
    try {
      // Plugins that are inactive and have never been activated
      // This is a simplified check - in production, you'd track activation history
      const result = await this.wpCli.execute(
        serverId,
        sitePath,
        'plugin list --status=inactive --format=json',
      );

      const inactivePlugins = JSON.parse(result);

      // Consider plugins unused if they're inactive and not recently updated
      return inactivePlugins
        .filter((p: any) => p.update === 'none')
        .map((p: any) => p.name);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to find unused plugins: ${errorMessage}`);
      return [];
    }
  }

  private async checkMustUsePlugins(
    serverId: string,
    sitePath: string,
  ): Promise<any> {
    try {
      const command = `ls -la ${sitePath}/wp-content/mu-plugins 2>/dev/null | grep -E '\\.php$' | wc -l || echo "0"`;
      const result = await this.sshExecutor.executeCommand(serverId, command);

      const count = parseInt(result.trim(), 10) || 0;

      return {
        count,
        enabled: count > 0,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to check must-use plugins: ${errorMessage}`);
      return { count: 0, enabled: false };
    }
  }

  private buildMessage(status: CheckStatus, details: any): string {
    const { plugins, themes, conflicts } = details;

    if (status === CheckStatus.PASS) {
      return `Plugin/theme configuration is healthy: ${plugins.active} active plugins, ${themes.active} active theme`;
    }

    if (status === CheckStatus.WARNING) {
      return `Plugin/theme issues detected: ${conflicts.length} conflicts, ${plugins.inactive} inactive plugins`;
    }

    return `Critical plugin/theme issues: ${conflicts.length} conflicts, ${plugins.inactive + themes.inactive} inactive items`;
  }

  getCheckType(): DiagnosisCheckType {
    return DiagnosisCheckType.PLUGIN_THEME_ANALYSIS;
  }

  getPriority(): CheckPriority {
    return CheckPriority.MEDIUM;
  }

  getName(): string {
    return 'Plugin & Theme Analysis';
  }

  getDescription(): string {
    return 'Analyzes active/inactive plugins and themes, detects conflicts, and identifies unused items';
  }

  canHandle(checkType: DiagnosisCheckType): boolean {
    return checkType === DiagnosisCheckType.PLUGIN_THEME_ANALYSIS;
  }
}
