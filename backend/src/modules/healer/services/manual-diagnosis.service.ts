import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SshExecutorService } from './ssh-executor.service';
import { PatternLearningService } from './pattern-learning.service';
import { Prisma } from '@prisma/client';

export interface CommandExecution {
  command: string;
  output: string;
  timestamp: string;
  wasSuccessful: boolean;
  duration: number;
}

export interface CommandSuggestion {
  command: string;
  description: string;
  confidence?: number;
  patternId?: string;
  isVerified?: boolean;
}

@Injectable()
export class ManualDiagnosisService {
  private readonly logger = new Logger(ManualDiagnosisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sshExecutor: SshExecutorService,
    private readonly patternLearning: PatternLearningService,
  ) {}

  /**
   * Start a new manual diagnosis session (with optional subdomain)
   */
  async startManualDiagnosis(siteId: string, startedBy?: string, subdomain?: string): Promise<any> {
    this.logger.log(`Starting manual diagnosis for site ${siteId}${subdomain ? ` (subdomain: ${subdomain})` : ''}`);

    const site = await this.prisma.wp_sites.findUnique({
      where: { id: siteId },
      include: { servers: true },
    });

    if (!site) {
      throw new NotFoundException(`Site ${siteId} not found`);
    }

    // Determine the path to diagnose
    let diagnosisPath = site.path;
    let diagnosisDomain = site.domain;

    if (subdomain) {
      // Find the subdomain in availableSubdomains
      const subdomains = (site.availableSubdomains as any) || [];
      const subdomainInfo = subdomains.find((s: any) => s.subdomain === subdomain);

      if (subdomainInfo) {
        diagnosisPath = subdomainInfo.path;
        diagnosisDomain = subdomain;
        this.logger.log(`Using subdomain path: ${diagnosisPath}`);
      } else {
        throw new Error(`Subdomain ${subdomain} not found for site ${siteId}`);
      }
    }

    // Create session with subdomain info
    const session = await this.prisma.manual_diagnosis_sessions.create({
      data: {
        siteId,
        startedBy,
        status: 'ACTIVE',
        commands: [],
      },
    });

    // Get initial command suggestions
    const suggestions = await this.getInitialSuggestions(site);

    return {
      sessionId: session.id,
      site: {
        id: site.id,
        domain: diagnosisDomain,
        path: diagnosisPath,
      },
      subdomain: subdomain || null,
      suggestions,
    };
  }

  /**
   * Execute a command in the manual diagnosis session
   */
  async executeCommand(
    sessionId: string,
    command: string,
  ): Promise<any> {
    this.logger.log(`Executing command in session ${sessionId}: ${command}`);

    const session = await this.prisma.manual_diagnosis_sessions.findUnique({
      where: { id: sessionId },
      include: { wp_sites: { include: { servers: true } } },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    if (session.status !== 'ACTIVE' && session.status !== 'AUTO_MODE') {
      throw new Error(`Session ${sessionId} is not active`);
    }

    const site = session.wp_sites;
    const startTime = Date.now();

    try {
      // Prepend cd to site path to ensure command runs in correct directory
      // Unless the command already starts with cd
      let fullCommand = command;
      if (!command.trim().startsWith('cd ')) {
        fullCommand = `cd ${site.path} && ${command}`;
      }

      this.logger.log(`Executing scoped command: ${fullCommand}`);

      // Execute command via SSH
      const output = await this.sshExecutor.executeCommand(
        site.servers.id,
        fullCommand,
      );

      const duration = Date.now() - startTime;

      // Store command execution (store original command, not the cd-prefixed version)
      const commands = (session.commands as unknown) as CommandExecution[];
      commands.push({
        command,
        output,
        timestamp: new Date().toISOString(),
        wasSuccessful: true,
        duration,
      });

      await this.prisma.manual_diagnosis_sessions.update({
        where: { id: sessionId },
        data: { commands: commands as any },
      });

      // Get next suggestions based on output
      const nextSuggestions = await this.suggestNextCommand(
        sessionId,
        command,
        output,
      );

      return {
        success: true,
        output,
        duration,
        nextSuggestions,
      };
    } catch (error) {
      const err = error as Error;
      const duration = Date.now() - startTime;

      // Store failed command
      const commands = (session.commands as unknown) as CommandExecution[];
      commands.push({
        command,
        output: err.message,
        timestamp: new Date().toISOString(),
        wasSuccessful: false,
        duration,
      });

      await this.prisma.manual_diagnosis_sessions.update({
        where: { id: sessionId },
        data: { commands: commands as any },
      });

      return {
        success: false,
        output: err.message,
        duration,
        error: err.message,
      };
    }
  }

  /**
   * Get command suggestions for the current state
   */
  async suggestNextCommand(
    sessionId: string,
    lastCommand: string,
    lastOutput: string,
  ): Promise<CommandSuggestion[]> {
    const session = await this.prisma.manual_diagnosis_sessions.findUnique({
      where: { id: sessionId },
      include: { wp_sites: true },
    });

    if (!session) {
      return [];
    }

    const suggestions: CommandSuggestion[] = [];

    // Analyze last output to determine next steps
    const analysis = this.analyzeOutput(lastCommand, lastOutput);

    // Get learned patterns
    const patterns = await this.getRelevantPatterns(session.wp_sites, analysis);

    // Add pattern-based suggestions (top 3)
    for (const pattern of patterns.slice(0, 3)) {
      const nextCommand = this.getNextCommandFromPattern(
        pattern,
        (session.commands as unknown) as CommandExecution[],
      );

      if (nextCommand) {
        suggestions.push({
          command: nextCommand,
          description: pattern.description,
          confidence: pattern.confidence,
          patternId: pattern.id,
          isVerified: pattern.verified,
        });
      }
    }

    // Add rule-based suggestions if no patterns found
    if (suggestions.length === 0) {
      suggestions.push(...this.getRuleBasedSuggestions(lastCommand, lastOutput, session.wp_sites));
    }

    return suggestions;
  }

  /**
   * Switch session to auto mode
   */
  async switchToAutoMode(sessionId: string): Promise<any> {
    this.logger.log(`Switching session ${sessionId} to auto mode`);

    const session = await this.prisma.manual_diagnosis_sessions.findUnique({
      where: { id: sessionId },
      include: { wp_sites: { include: { servers: true } } },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    // Update status
    await this.prisma.manual_diagnosis_sessions.update({
      where: { id: sessionId },
      data: { status: 'AUTO_MODE' },
    });

    // Get remaining commands from best pattern
    const commands = (session.commands as unknown) as CommandExecution[];
    const lastCommand = commands[commands.length - 1];

    const suggestions = await this.suggestNextCommand(
      sessionId,
      lastCommand?.command || '',
      lastCommand?.output || '',
    );

    // Execute remaining commands automatically
    const results = [];
    for (const suggestion of suggestions) {
      const result = await this.executeCommand(sessionId, suggestion.command);
      results.push(result);

      if (!result.success) {
        break; // Stop on first failure
      }
    }

    return {
      sessionId,
      status: 'AUTO_MODE',
      results,
    };
  }

  /**
   * Complete manual diagnosis and learn from it
   */
  async completeManualDiagnosis(
    sessionId: string,
    findings: any,
  ): Promise<any> {
    this.logger.log(`Completing manual diagnosis session ${sessionId}`);

    const session = await this.prisma.manual_diagnosis_sessions.findUnique({
      where: { id: sessionId },
      include: { wp_sites: true },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    // Update session
    await this.prisma.manual_diagnosis_sessions.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        findings,
        completedAt: new Date(),
      },
    });

    // Learn from this session
    const pattern = await this.learnFromSession(session, findings);

    return {
      sessionId,
      status: 'COMPLETED',
      learnedPattern: pattern ? {
        id: pattern.id,
        confidence: pattern.confidence,
        verified: pattern.verified,
      } : null,
    };
  }

  /**
   * Get initial command suggestions
   */
  private async getInitialSuggestions(site: any): Promise<CommandSuggestion[]> {
    const suggestions: CommandSuggestion[] = [];

    // Check for learned patterns first
    const patterns = await this.prisma.healing_patterns.findMany({
      where: {
        verified: true, // Prioritize verified patterns
      },
      orderBy: [
        { confidence: 'desc' },
        { successCount: 'desc' },
      ],
      take: 3,
    });

    for (const pattern of patterns) {
      if (pattern.commandSequence.length > 0) {
        suggestions.push({
          command: pattern.commandSequence[0],
          description: `Verified: ${pattern.description}`,
          confidence: pattern.confidence,
          patternId: pattern.id,
          isVerified: true,
        });
      }
    }

    // Add default suggestions if no patterns
    // Use RELATIVE paths since commands are auto-scoped to site directory
    if (suggestions.length === 0) {
      suggestions.push(
        {
          command: `tail -100 wp-content/debug.log`,
          description: 'Check WordPress debug log for errors',
        },
        {
          command: `tail -100 /var/log/apache2/error.log`,
          description: 'Check Apache error log (absolute path)',
        },
        {
          command: `tail -100 /var/log/httpd/error_log`,
          description: 'Check httpd error log (absolute path)',
        },
      );
    }

    return suggestions;
  }

  /**
   * Analyze command output to determine next steps
   */
  private analyzeOutput(command: string, output: string): any {
    const analysis: any = {
      hasError: false,
      errorType: null,
      keywords: [],
    };

    // Check for common error patterns
    if (output.includes('Fatal error') || output.includes('PHP Fatal error')) {
      analysis.hasError = true;
      analysis.errorType = 'FATAL_ERROR';
      analysis.keywords.push('fatal');
    }

    if (output.includes('database') || output.includes('MySQL')) {
      analysis.hasError = true;
      analysis.errorType = 'DB_ERROR';
      analysis.keywords.push('database');
    }

    if (output.includes('.maintenance')) {
      analysis.hasError = true;
      analysis.errorType = 'MAINTENANCE';
      analysis.keywords.push('maintenance');
    }

    if (output.includes('memory') || output.includes('Allowed memory size')) {
      analysis.hasError = true;
      analysis.errorType = 'MEMORY_EXHAUSTION';
      analysis.keywords.push('memory');
    }

    return analysis;
  }

  /**
   * Get relevant patterns based on analysis
   */
  private async getRelevantPatterns(site: any, analysis: any): Promise<any[]> {
    if (!analysis.errorType) {
      return [];
    }

    return this.prisma.healing_patterns.findMany({
      where: {
        OR: [
          { errorType: analysis.errorType },
          { diagnosisType: analysis.errorType },
        ],
      },
      orderBy: [
        { verified: 'desc' }, // Verified patterns first
        { confidence: 'desc' },
        { successCount: 'desc' },
      ],
      take: 5,
    });
  }

  /**
   * Get next command from pattern based on current progress
   */
  private getNextCommandFromPattern(
    pattern: any,
    executedCommands: CommandExecution[],
  ): string | null {
    const commandSequence = pattern.commandSequence || pattern.commands;
    const executedCommandStrings = executedCommands.map((c) => c.command);

    // Find first command in sequence that hasn't been executed
    for (const cmd of commandSequence) {
      if (!executedCommandStrings.includes(cmd)) {
        return cmd;
      }
    }

    return null;
  }

  /**
   * Get rule-based suggestions when no patterns match
   */
  private getRuleBasedSuggestions(
    lastCommand: string,
    lastOutput: string,
    site: any,
  ): CommandSuggestion[] {
    const suggestions: CommandSuggestion[] = [];

    // If we just checked debug.log and found errors
    if (lastCommand.includes('debug.log')) {
      if (lastOutput.includes('Fatal error')) {
        suggestions.push({
          command: `grep -i "plugin" wp-content/debug.log | tail -20`,
          description: 'Check for plugin-related errors',
        });
        suggestions.push({
          command: `grep -i "theme" wp-content/debug.log | tail -20`,
          description: 'Check for theme-related errors',
        });
      } else if (lastOutput.includes('No such file')) {
        suggestions.push({
          command: `ls -la wp-content/`,
          description: 'List wp-content directory',
        });
      }
    }

    // If we just checked error logs
    if (lastCommand.includes('error.log') || lastCommand.includes('error_log')) {
      if (lastOutput.includes('PHP Fatal error') || lastOutput.includes('Fatal error')) {
        suggestions.push({
          command: `tail -100 wp-content/debug.log`,
          description: 'Check WordPress debug log',
        });
      }
    }

    // If we found maintenance mode
    if (lastCommand.includes('.maintenance')) {
      if (!lastOutput.includes('No such file')) {
        suggestions.push({
          command: `rm -f .maintenance`,
          description: 'Remove maintenance mode file',
        });
      } else {
        suggestions.push({
          command: `ls -la | grep -E "wp-config|index"`,
          description: 'Check for WordPress core files',
        });
      }
    }

    // If we found database errors
    if (lastOutput.includes('database') || lastOutput.includes('MySQL') || lastOutput.includes('Connection refused')) {
      suggestions.push({
        command: `cat wp-config.php | grep DB_`,
        description: 'Check database configuration',
      });
      suggestions.push({
        command: `mysql -h localhost -e "SELECT 1" 2>&1`,
        description: 'Test MySQL connection',
      });
    }

    // If file not found, suggest listing directory
    if (lastOutput.includes('No such file') || lastOutput.includes('cannot open')) {
      suggestions.push({
        command: `ls -la`,
        description: 'List files in current directory',
      });
      suggestions.push({
        command: `pwd`,
        description: 'Show current directory path',
      });
    }

    // If we listed directory, suggest checking specific files
    if (lastCommand.includes('ls -la') || lastCommand.includes('ls -l')) {
      if (lastOutput.includes('wp-config.php')) {
        suggestions.push({
          command: `tail -100 wp-content/debug.log`,
          description: 'Check WordPress debug log',
        });
        suggestions.push({
          command: `cat wp-config.php | grep WP_DEBUG`,
          description: 'Check if debug mode is enabled',
        });
      }
    }

    // If we checked wp-config, suggest next steps
    if (lastCommand.includes('wp-config.php')) {
      if (lastOutput.includes('WP_DEBUG')) {
        suggestions.push({
          command: `tail -100 wp-content/debug.log`,
          description: 'Check debug log for errors',
        });
      }
      if (lastOutput.includes('DB_')) {
        suggestions.push({
          command: `mysql -h localhost -e "SHOW DATABASES" 2>&1`,
          description: 'List available databases',
        });
      }
    }

    // If we checked plugins/themes
    if (lastCommand.includes('plugin') || lastCommand.includes('theme')) {
      suggestions.push({
        command: `ls -la wp-content/plugins/`,
        description: 'List installed plugins',
      });
      suggestions.push({
        command: `ls -la wp-content/themes/`,
        description: 'List installed themes',
      });
    }

    // Default: check HTTP status if no other suggestions
    if (suggestions.length === 0) {
      suggestions.push({
        command: `curl -I https://${site.domain} 2>&1 | head -5`,
        description: 'Check HTTP status of the site',
      });
      suggestions.push({
        command: `tail -100 wp-content/debug.log`,
        description: 'Check WordPress debug log',
      });
      suggestions.push({
        command: `ls -la | grep -E "wp-config|index"`,
        description: 'Verify WordPress installation',
      });
    }

    return suggestions.slice(0, 3); // Return top 3 suggestions
  }

  /**
   * Learn from completed manual diagnosis session
   */
  private async learnFromSession(session: any, findings: any): Promise<any> {
    const commands = (session.commands as unknown) as CommandExecution[];

    // Only learn from successful sessions
    const successfulCommands = commands.filter((c) => c.wasSuccessful);
    if (successfulCommands.length === 0) {
      return null;
    }

    // Extract command sequence
    const commandSequence = successfulCommands.map((c) => c.command);

    // Determine diagnosis type from findings
    const diagnosisType = findings.diagnosisType || 'UNKNOWN';
    const errorType = findings.errorType;
    const culprit = findings.culprit;

    // Create or update pattern
    const pattern = await this.prisma.healing_patterns.create({
      data: {
        diagnosisType,
        errorType,
        culprit,
        errorPattern: findings.errorPattern || '.*',
        commands: commandSequence,
        commandSequence,
        description: findings.description || 'Manual diagnosis pattern',
        verified: true, // Manual diagnosis patterns are verified
        verifiedBy: session.startedBy,
        verifiedAt: new Date(),
        confidence: 0.8, // Start at 80% confidence for verified patterns
        successCount: 1, // Start with 1 success
      },
    });

    // Link pattern to session
    await this.prisma.manual_diagnosis_sessions.update({
      where: { id: session.id },
      data: { learnedPatternId: pattern.id },
    });

    this.logger.log(`Created verified pattern ${pattern.id} from manual diagnosis session ${session.id}`);

    return pattern;
  }

  /**
   * Get session details
   */
  async getSession(sessionId: string): Promise<any> {
    const session = await this.prisma.manual_diagnosis_sessions.findUnique({
      where: { id: sessionId },
      include: {
        wp_sites: {
          include: {
            servers: {
              select: {
                id: true,
                host: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    return session;
  }
}
