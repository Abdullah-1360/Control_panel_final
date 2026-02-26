/**
 * Healing Strategy Engine
 * 
 * Determines healing approach based on diagnostic results and healing mode
 */

import { Injectable, Logger } from '@nestjs/common';
import { HealingMode, RiskLevel, CheckStatus } from '@prisma/client';
import { CheckResult, HealingPlan, HealingAction } from '../core/interfaces';
import { PluginRegistryService } from './plugin-registry.service';

@Injectable()
export class HealingStrategyEngineService {
  private readonly logger = new Logger(HealingStrategyEngineService.name);
  
  constructor(private readonly pluginRegistry: PluginRegistryService) {}
  
  /**
   * Determine healing approach based on diagnostic results and healing mode
   */
  async determineHealingPlan(
    application: any,
    diagnosticResults: CheckResult[],
    healingMode: HealingMode,
  ): Promise<HealingPlan> {
    this.logger.log(
      `Determining healing plan for application ${application.id} in ${healingMode} mode`,
    );
    
    // Get the plugin for this tech stack
    const plugin = this.pluginRegistry.getPlugin(application.techStack);
    if (!plugin) {
      throw new Error(`Plugin for ${application.techStack} not available`);
    }
    
    // Get healing strategies from the plugin
    const strategies = plugin.getHealingStrategies();
    
    // Filter failed checks
    const failedChecks = diagnosticResults.filter(
      (result) => result.status === CheckStatus.FAIL,
    );
    
    const plan: HealingPlan = {
      autoHeal: [],
      requireApproval: [],
      cannotHeal: [],
    };
    
    // Process each failed check
    for (const check of failedChecks) {
      // Find a strategy that can handle this check
      const strategy = strategies.find((s) => s.canHandle(check));
      
      if (!strategy) {
        this.logger.warn(`No healing strategy found for check: ${check.checkName}`);
        plan.cannotHeal.push(check);
        continue;
      }
      
      // Get the healing action
      const action = strategy.getAction(check);
      
      if (!action) {
        this.logger.warn(`Strategy ${strategy.name} returned no action for check: ${check.checkName}`);
        plan.cannotHeal.push(check);
        continue;
      }
      
      // Determine if this can be auto-healed based on mode and risk level
      if (this.canAutoHeal(healingMode, action.riskLevel)) {
        plan.autoHeal.push({ check, action });
        this.logger.debug(`Auto-heal: ${check.checkName} with ${action.name}`);
      } else {
        plan.requireApproval.push({ check, action });
        this.logger.debug(`Requires approval: ${check.checkName} with ${action.name}`);
      }
    }
    
    this.logger.log(
      `Healing plan: ${plan.autoHeal.length} auto-heal, ${plan.requireApproval.length} require approval, ${plan.cannotHeal.length} cannot heal`,
    );
    
    return plan;
  }
  
  /**
   * Determine if an action can be auto-healed based on mode and risk level
   */
  private canAutoHeal(mode: HealingMode, riskLevel: RiskLevel): boolean {
    switch (mode) {
      case HealingMode.MANUAL:
        // Never auto-heal in manual mode
        return false;
        
      case HealingMode.SUPERVISED:
        // Only auto-heal LOW risk actions
        return riskLevel === RiskLevel.LOW;
        
      case HealingMode.AUTO:
        // Auto-heal LOW and MEDIUM risk actions
        return riskLevel === RiskLevel.LOW || riskLevel === RiskLevel.MEDIUM;
        
      default:
        return false;
    }
  }
  
  /**
   * Validate that a healing plan is safe to execute
   */
  validateHealingPlan(plan: HealingPlan): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[];
    
    // Check for conflicting actions
    const actionNames = new Set<string>();
    for (const item of [...plan.autoHeal, ...plan.requireApproval]) {
      if (actionNames.has(item.action.name)) {
        errors.push(`Duplicate action: ${item.action.name}`);
      }
      actionNames.add(item.action.name);
    }
    
    // Check for high-risk actions in auto-heal
    const highRiskAutoHeal = plan.autoHeal.filter(
      (item) => item.action.riskLevel === RiskLevel.HIGH || item.action.riskLevel === RiskLevel.CRITICAL,
    );
    
    if (highRiskAutoHeal.length > 0) {
      errors.push(
        `High/Critical risk actions should not be auto-healed: ${highRiskAutoHeal.map((i) => i.action.name).join(', ')}`,
      );
    }
    
    // Warn about actions requiring backup
    const backupRequired = [...plan.autoHeal, ...plan.requireApproval].filter(
      (item) => item.action.requiresBackup,
    );
    
    if (backupRequired.length > 0) {
      warnings.push(
        `${backupRequired.length} actions require backup before execution`,
      );
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
