/**
 * Base class for all healing strategies
 * 
 * Provides common functionality for healing actions
 */

import { CheckCategory, RiskLevel } from '@prisma/client';
import { IHealingStrategy, HealingAction, CheckResult } from './interfaces';

export abstract class HealingStrategyBase implements IHealingStrategy {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly applicableTo: CheckCategory[];
  
  /**
   * Determine if this strategy can handle the given check result
   */
  abstract canHandle(check: CheckResult): boolean;
  
  /**
   * Get the healing action for the given check result
   */
  abstract getAction(check: CheckResult): HealingAction | null;
  
  /**
   * Execute the healing action
   */
  abstract execute(application: any, server: any, action: HealingAction): Promise<void>;
  
  /**
   * Helper method to create a healing action
   */
  protected createAction(
    name: string,
    description: string,
    commands: string[],
    riskLevel: RiskLevel,
    requiresBackup: boolean = true,
    estimatedDuration: number = 60,
  ): HealingAction {
    return {
      name,
      description,
      commands,
      requiresBackup,
      estimatedDuration,
      riskLevel,
    };
  }
}
