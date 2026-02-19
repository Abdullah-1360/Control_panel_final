import { Injectable, Logger } from '@nestjs/common';
import { DiagnosisType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

interface PatternMatch {
  pattern: any;
  confidence: number;
  matchScore: number;
}

interface CommandSuggestion {
  commands: string[];
  confidence: number;
  autoApprove: boolean;
  reasoning: string;
  patternId?: string;
}

@Injectable()
export class PatternLearningService {
  private readonly logger = new Logger(PatternLearningService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Learn from a successful healing execution
   */
  async learnFromExecution(executionId: string): Promise<void> {
    try {
      const execution = await this.prisma.healer_executions.findUnique({
        where: { id: executionId },
      });

      if (!execution) {
        this.logger.warn(`Execution ${executionId} not found`);
        return;
      }

      // Only learn from successful executions
      if (execution.status !== 'SUCCESS') {
        this.logger.debug(`Skipping learning from non-successful execution ${executionId}`);
        return;
      }

      // Extract scenario fingerprint
      const diagnosisDetails = JSON.parse(execution.diagnosisDetails);
      const commands = JSON.parse(execution.suggestedCommands);

      const fingerprint = {
        diagnosisType: execution.diagnosisType,
        errorType: diagnosisDetails.errorType,
        culprit: diagnosisDetails.culprit,
        errorPattern: this.extractErrorPattern(diagnosisDetails.errorMessage),
      };

      // Find or create pattern
      const pattern = await this.findOrCreatePattern(fingerprint, commands, execution.suggestedAction);

      // Update success count
      await this.updatePatternSuccess(pattern.id);

      this.logger.log(`Learned from execution ${executionId}, pattern ${pattern.id} now has ${pattern.successCount + 1} successes`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to learn from execution: ${err.message}`, err.stack);
    }
  }

  /**
   * Record a failed healing attempt
   */
  async recordFailure(executionId: string): Promise<void> {
    try {
      const execution = await this.prisma.healer_executions.findUnique({
        where: { id: executionId },
      });

      if (!execution) {
        return;
      }

      const diagnosisDetails = JSON.parse(execution.diagnosisDetails);
      const commands = JSON.parse(execution.suggestedCommands);

      // Find matching pattern
      const pattern = await this.findMatchingPattern({
        diagnosisType: execution.diagnosisType,
        errorType: diagnosisDetails.errorType,
        culprit: diagnosisDetails.culprit,
        errorPattern: this.extractErrorPattern(diagnosisDetails.errorMessage),
      }, commands);

      if (pattern) {
        await this.updatePatternFailure(pattern.id);
        this.logger.log(`Recorded failure for pattern ${pattern.id}`);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to record failure: ${err.message}`, err.stack);
    }
  }

  /**
   * Suggest commands based on learned patterns
   */
  async suggestCommands(diagnosis: any): Promise<CommandSuggestion[]> {
    try {
      const patterns = await this.findMatchingPatterns(diagnosis);

      if (patterns.length === 0) {
        this.logger.debug('No matching patterns found for diagnosis');
        return [];
      }

      return patterns.map((match) => ({
        commands: match.pattern.commands,
        confidence: match.pattern.confidence,
        autoApprove: match.pattern.autoApproved,
        reasoning: this.generateReasoning(match.pattern),
        patternId: match.pattern.id,
      }));
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to suggest commands: ${err.message}`, err.stack);
      return [];
    }
  }

  /**
   * Find or create a healing pattern
   */
  private async findOrCreatePattern(
    fingerprint: any,
    commands: string[],
    description: string,
  ): Promise<any> {
    // Try to find existing pattern
    const existing = await this.prisma.healing_patterns.findFirst({
      where: {
        diagnosisType: fingerprint.diagnosisType,
        errorType: fingerprint.errorType,
        culprit: fingerprint.culprit,
        commands: {
          equals: commands,
        },
      },
    });

    if (existing) {
      return existing;
    }

    // Create new pattern
    return this.prisma.healing_patterns.create({
      data: {
        diagnosisType: fingerprint.diagnosisType,
        errorType: fingerprint.errorType,
        culprit: fingerprint.culprit,
        errorPattern: fingerprint.errorPattern,
        commands,
        description,
        successCount: 0,
        failureCount: 0,
        confidence: 0.0,
        autoApproved: false,
      },
    });
  }

  /**
   * Find matching pattern
   */
  private async findMatchingPattern(fingerprint: any, commands: string[]): Promise<any> {
    return this.prisma.healing_patterns.findFirst({
      where: {
        diagnosisType: fingerprint.diagnosisType,
        errorType: fingerprint.errorType,
        culprit: fingerprint.culprit,
        commands: {
          equals: commands,
        },
      },
    });
  }

  /**
   * Find all matching patterns for a diagnosis
   */
  private async findMatchingPatterns(diagnosis: any): Promise<PatternMatch[]> {
    const patterns = await this.prisma.healing_patterns.findMany({
      where: {
        diagnosisType: diagnosis.diagnosisType,
        errorType: diagnosis.details?.errorType,
      },
      orderBy: {
        confidence: 'desc',
      },
    });

    // Calculate match scores
    const matches: PatternMatch[] = patterns.map((pattern) => {
      let matchScore = 1.0;

      // Exact culprit match
      if (pattern.culprit && diagnosis.details?.culprit) {
        matchScore = pattern.culprit === diagnosis.details.culprit ? 1.0 : 0.5;
      }

      // Error pattern match
      if (pattern.errorPattern && diagnosis.details?.errorMessage) {
        const regex = new RegExp(pattern.errorPattern, 'i');
        if (regex.test(diagnosis.details.errorMessage)) {
          matchScore *= 1.2;
        } else {
          matchScore *= 0.7;
        }
      }

      return {
        pattern,
        confidence: pattern.confidence,
        matchScore,
      };
    });

    // Filter and sort by match score
    return matches
      .filter((m) => m.matchScore > 0.5)
      .sort((a, b) => b.matchScore * b.confidence - a.matchScore * a.confidence);
  }

  /**
   * Update pattern success count and confidence
   */
  private async updatePatternSuccess(patternId: string): Promise<void> {
    const pattern = await this.prisma.healing_patterns.findUnique({
      where: { id: patternId },
    });

    if (!pattern) {
      return;
    }

    const successCount = pattern.successCount + 1;
    const totalAttempts = successCount + pattern.failureCount;
    const confidence = successCount / totalAttempts;

    // Auto-approve if confidence > 90% and at least 5 successes
    const autoApproved = confidence > 0.9 && successCount >= 5;

    await this.prisma.healing_patterns.update({
      where: { id: patternId },
      data: {
        successCount,
        confidence,
        autoApproved,
        lastSuccessAt: new Date(),
        lastUsedAt: new Date(),
      },
    });
  }

  /**
   * Update pattern failure count and confidence
   */
  private async updatePatternFailure(patternId: string): Promise<void> {
    const pattern = await this.prisma.healing_patterns.findUnique({
      where: { id: patternId },
    });

    if (!pattern) {
      return;
    }

    const failureCount = pattern.failureCount + 1;
    const totalAttempts = pattern.successCount + failureCount;
    const confidence = pattern.successCount / totalAttempts;

    // Disable auto-approval if confidence drops below 90%
    const autoApproved = confidence > 0.9 && pattern.successCount >= 5;

    await this.prisma.healing_patterns.update({
      where: { id: patternId },
      data: {
        failureCount,
        confidence,
        autoApproved,
        lastFailureAt: new Date(),
      },
    });
  }

  /**
   * Extract error pattern from error message
   */
  private extractErrorPattern(errorMessage?: string): string {
    if (!errorMessage) {
      return '.*';
    }

    // Remove specific file paths and line numbers to create a pattern
    let pattern = errorMessage
      .replace(/\/[^\s]+\.php/g, '/[PATH].php')
      .replace(/line \d+/gi, 'line [NUM]')
      .replace(/\d+/g, '[NUM]');

    // Escape special regex characters
    pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    return pattern;
  }

  /**
   * Generate reasoning text for a pattern suggestion
   */
  private generateReasoning(pattern: any): string {
    const total = pattern.successCount + pattern.failureCount;
    const percentage = Math.round(pattern.confidence * 100);

    if (pattern.autoApproved) {
      return `Auto-approved: This solution has worked ${pattern.successCount}/${total} times (${percentage}% success rate)`;
    }

    if (pattern.successCount === 0) {
      return 'New pattern - not yet tested';
    }

    if (pattern.successCount < 3) {
      return `Learning: This solution has worked ${pattern.successCount}/${total} times. Need more data for auto-approval.`;
    }

    return `Suggested: This solution has worked ${pattern.successCount}/${total} times (${percentage}% success rate). ${5 - pattern.successCount} more successes needed for auto-approval.`;
  }

  /**
   * Get all patterns for admin review
   */
  async getAllPatterns(page: number = 1, limit: number = 50): Promise<any> {
    const skip = (page - 1) * limit;

    const [patterns, total] = await Promise.all([
      this.prisma.healing_patterns.findMany({
        orderBy: [
          { confidence: 'desc' },
          { successCount: 'desc' },
        ],
        skip,
        take: limit,
      }),
      this.prisma.healing_patterns.count(),
    ]);

    return {
      data: patterns,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Delete a pattern (admin action)
   */
  async deletePattern(patternId: string): Promise<void> {
    await this.prisma.healing_patterns.delete({
      where: { id: patternId },
    });

    this.logger.log(`Deleted pattern ${patternId}`);
  }

  /**
   * Manually approve/disapprove a pattern (admin action)
   */
  async setPatternApproval(patternId: string, approved: boolean): Promise<void> {
    await this.prisma.healing_patterns.update({
      where: { id: patternId },
      data: { autoApproved: approved },
    });

    this.logger.log(`Set pattern ${patternId} auto-approval to ${approved}`);
  }
}
